import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { User } from "./user.entity.js";
import { Team } from "../teams/team.entity.js";
import { LoginDto } from "./login.dto.js";
import { AddUserDto } from "./add-user.dto.js";
import { FindStaffDto, STAFF_TABS, UpdateStaffProfileDto, type StaffTab } from "./staff.dto.js";
import { ChangePasswordDto } from "./change-password.dto.js";
import { In, Repository } from "typeorm";
import * as bcrypt from 'bcrypt';
import { JwtService } from "@nestjs/jwt";
import * as crypto from 'crypto';
import { sendResetEmail } from "../mailer/mailer.js";

@Injectable()
export class AuthService {
    constructor(
        @InjectRepository(User)
        private userRepository: Repository<User>,
        @InjectRepository(Team)
        private teamRepository: Repository<Team>,
        private jwtService: JwtService,
    ) { }

    private generatePassword(length = 12): string {
        const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
        const lower = 'abcdefghijkmnopqrstuvwxyz';
        const digits = '23456789';
        const special = '!@#$%^&*()_+-=';
        const all = upper + lower + digits + special;

        const pick = (chars: string) => chars[crypto.randomInt(chars.length)];

        const required = [pick(upper), pick(lower), pick(digits), pick(special)];
        const rest = Array.from({ length: length - required.length }, () => pick(all));
        const passwordChars = [...required, ...rest];

        for (let i = passwordChars.length - 1; i > 0; i--) {
            const j = crypto.randomInt(i + 1);
            [passwordChars[i], passwordChars[j]] = [passwordChars[j], passwordChars[i]];
        }

        return passwordChars.join('');
    }
    private safeUser(user: User) {
        return {
            id: user.id,
            first_name: user.first_name,
            last_name: user.last_name,
            email: user.email,
            user_role: user.user_role,
            team_id: user.team_id,
            team: user.team,
            designation: user.designation,
            department: user.department,
            region: user.region,
            office: user.office,
            manager_id: user.manager_id,
            joined_on: user.joined_on,
            blocked: user.blocked,
            suspended: user.suspended,
            is_starred: user.is_starred,
            password_changed: user.password_changed,
            created_at: user.created_at,
            updated_at: user.updated_at,
        };
    }

    async login(dto: LoginDto) {
        const user = await this.userRepository.findOne({
            where: { email: dto.email }
        });
        if (!user) {
            throw new NotFoundException('User not found');
        }
        const isPasswordValid = await bcrypt.compare(dto.password, user.password);
        if (!isPasswordValid) {
            throw new BadRequestException('Invalid Credentials');
        }
        if (user.blocked) {
            throw new ForbiddenException('Your account has been blocked please contact your admin.');
        }
        if (user.suspended) {
            throw new ForbiddenException('Your account has been suspended please contact your admin.');
        }
        const payload = {
            id: user.id,
            email: user.email,
            role: user.user_role,
            first_name: user.first_name,
            last_name: user.last_name,
            // Drives the first-login welcome flow — the client reads it straight off the token.
            password_changed: user.password_changed,
        };
        return {
            access_token: this.jwtService.sign(payload),
        };
    }
    
    async addUser(dto: AddUserDto) {
        const existing = await this.userRepository.findOne({ where: { email: dto.email } });
        if (existing) {
            throw new BadRequestException('A user with this email already exists');
        }

        const team = dto.team_id ? await this.findTeam(dto.team_id) : null;

        const plainPassword = this.generatePassword();
        const hashedPassword = await bcrypt.hash(plainPassword, 10);

        const user = this.userRepository.create({
            first_name: dto.first_name,
            last_name: dto.last_name,
            email: dto.email,
            password: hashedPassword,
            user_role:dto.user_role,
            team_id: team?.id ?? null,
            team: team?.name ?? null,
        });
        await this.userRepository.save(user);

        return { user: this.safeUser(user), password: plainPassword };
    }

    async changePassword(userId: number, dto: ChangePasswordDto) {
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user) throw new NotFoundException('User not found');

        const isPasswordValid = await bcrypt.compare(dto.current_password, user.password);
        if (!isPasswordValid) throw new BadRequestException('Current password is incorrect');

        if (dto.current_password === dto.new_password) {
            throw new BadRequestException('New password must be different from the current one');
        }

        user.password = await bcrypt.hash(dto.new_password, 10);
        user.password_changed = true;
        await this.userRepository.save(user);

        return { status: 'Success', message: 'Password changed' };
    }

    async setBlocked(id: number, blocked: boolean, requesterId: number) {
        // Without this an admin can lock themselves out of the only admin account.
        if (id === requesterId) throw new BadRequestException('You cannot block your own account');

        const user = await this.userRepository.findOne({ where: { id } });
        if (!user) throw new NotFoundException('User not found');

        user.blocked = blocked;
        await this.userRepository.save(user);
        return this.safeUser(user);
    }

    async setRole(id: number, userRole: string, requesterId: number) {
        if (id === requesterId) throw new BadRequestException('You cannot change your own role');

        const user = await this.userRepository.findOne({ where: { id } });
        if (!user) throw new NotFoundException('User not found');

        // Demoting the last admin would leave nobody able to administer the CRM.
        if (user.user_role === 'admin' && userRole !== 'admin') {
            const adminCount = await this.userRepository.count({
                where: { user_role: 'admin', blocked: false },
            });
            if (adminCount <= 1) throw new BadRequestException('The last admin cannot be demoted');
        }

        user.user_role = userRole;
        await this.userRepository.save(user);
        return this.safeUser(user);
    }

    async setSuspended(id: number, suspended: boolean, requesterId: number) {
        if (id === requesterId) throw new BadRequestException('You cannot suspend your own account');

        const user = await this.userRepository.findOne({ where: { id } });
        if (!user) throw new NotFoundException('User not found');

        user.suspended = suspended;
        await this.userRepository.save(user);
        return this.safeUser(user);
    }

    async setStarred(id: number, isStarred: boolean) {
        const result = await this.userRepository.update({ id }, { is_starred: isStarred });
        if (!result.affected) throw new NotFoundException('User not found');
        return { id, is_starred: isStarred };
    }

    async updateProfile(id: number, dto: UpdateStaffProfileDto) {
        const user = await this.userRepository.findOne({ where: { id } });
        if (!user) throw new NotFoundException('User not found');

        if (dto.manager_id != null) {
            if (dto.manager_id === id) throw new BadRequestException('A member cannot be their own line manager');
            const manager = await this.userRepository.findOne({ where: { id: dto.manager_id } });
            if (!manager) throw new BadRequestException('manager_id does not match an existing user');
        }

        if (dto.designation !== undefined) user.designation = dto.designation.trim() || null;
        if (dto.department !== undefined) user.department = dto.department.trim() || null;
        if (dto.region !== undefined) user.region = dto.region.trim() || null;
        if (dto.office !== undefined) user.office = dto.office.trim() || null;
        if (dto.manager_id !== undefined) user.manager_id = dto.manager_id;
        if (dto.joined_on !== undefined) user.joined_on = dto.joined_on;

        await this.userRepository.save(user);
        return this.safeUser(user);
    }

    /** The staff register: paged, with a count per status tab and each member's lead and project load. */
    async listStaff(query: FindStaffDto) {
        const page = query.page ?? 1;
        const limit = query.limit ?? 10;
        const tabSql: Record<StaffTab, string> = {
            active: 'user.blocked = false AND user.suspended = false',
            suspended: 'user.blocked = false AND user.suspended = true',
            blocked: 'user.blocked = true',
        };

        const inTab = (tab: StaffTab) => {
            const qb = this.userRepository.createQueryBuilder('user').where(tabSql[tab]);
            if (query.department) qb.andWhere('user.department = :department', { department: query.department });
            if (query.designation) qb.andWhere('user.designation = :designation', { designation: query.designation });
            if (query.region) qb.andWhere('user.region = :region', { region: query.region });
            if (query.manager_id) qb.andWhere('user.manager_id = :managerId', { managerId: query.manager_id });
            if (query.team_id) qb.andWhere('user.team_id = :teamId', { teamId: query.team_id });
            if (query.starred === 'true') qb.andWhere('user.is_starred = true');

            if (query.search) {
                const search = `%${query.search}%`;
                // Capped at 9 digits so a long number typed into search can't overflow the int column.
                const employeeId = /^\d{1,9}$/.test(query.search) ? Number(query.search) : -1;
                const byName = "(user.first_name || ' ' || user.last_name) ILIKE :search";
                if (query.search_by === 'employee_id') qb.andWhere('user.id = :employeeId', { employeeId });
                else if (query.search_by === 'name') qb.andWhere(byName, { search });
                else qb.andWhere(`(${byName} OR user.email ILIKE :search OR user.id = :employeeId)`, { search, employeeId });
            }
            return qb;
        };

        const [[users, total], counts, departments, designations, regions] = await Promise.all([
            inTab(query.status ?? 'active')
                .orderBy('user.id', query.sort === 'desc' ? 'DESC' : 'ASC')
                .skip((page - 1) * limit)
                .take(limit)
                .getManyAndCount(),
            // Counted per tab with the other filters applied, so the tabs match the search.
            Promise.all(STAFF_TABS.map((tab) => inTab(tab).getCount())),
            this.distinctStaffValues('department'),
            this.distinctStaffValues('designation'),
            this.distinctStaffValues('region'),
        ]);

        const managerIds = [...new Set(users.map((user) => user.manager_id).filter((id) => id !== null))];
        const [load, managers] = await Promise.all([
            this.leadLoad(users.map((user) => user.id)),
            managerIds.length > 0 ? this.userRepository.find({ where: { id: In(managerIds) } }) : [],
        ]);
        const managerById = new Map(managers.map((manager) => [manager.id, manager]));

        return {
            data: users.map((user) => {
                const manager = user.manager_id ? managerById.get(user.manager_id) : undefined;
                return {
                    ...this.safeUser(user),
                    manager: manager
                        ? { id: manager.id, first_name: manager.first_name, last_name: manager.last_name }
                        : null,
                    ...(load.get(user.id) ?? { allocated_leads: 0, direct_leads: 0, projects_allocated: 0 }),
                };
            }),
            total,
            page,
            limit,
            status_counts: Object.fromEntries(STAFF_TABS.map((tab, i) => [tab, counts[i]])),
            departments,
            designations,
            regions,
        };
    }

    private async distinctStaffValues(column: 'department' | 'designation' | 'region') {
        const rows = await this.userRepository
            .createQueryBuilder('user')
            .select(`DISTINCT user.${column}`, 'value')
            .where(`user.${column} IS NOT NULL`)
            .orderBy('value', 'ASC')
            .getRawMany<{ value: string }>();
        return rows.map((row) => row.value);
    }

    /** Leads each member holds, how many of those they brought in themselves, and the projects those leads span. */
    private async leadLoad(userIds: number[]) {
        const load = new Map<number, { allocated_leads: number; direct_leads: number; projects_allocated: number }>();
        if (userIds.length === 0) return load;

        const rows: { user_id: number; allocated: string; direct: string; projects: string }[] =
            await this.userRepository.query(
                `SELECT l.assigned_to_id AS user_id,
                        COUNT(*) AS allocated,
                        COUNT(*) FILTER (WHERE l.created_by_id = l.assigned_to_id) AS direct,
                        COUNT(DISTINCT l.project_id) AS projects
                 FROM "lead" l
                 WHERE l.assigned_to_id = ANY($1::int[])
                 GROUP BY l.assigned_to_id`,
                [userIds],
            );

        for (const row of rows) {
            load.set(row.user_id, {
                allocated_leads: Number(row.allocated),
                direct_leads: Number(row.direct),
                projects_allocated: Number(row.projects),
            });
        }
        return load;
    }

    private async findTeam(id: string) {
        const team = await this.teamRepository.findOne({ where: { id } });
        if (!team) throw new BadRequestException('team_id does not match an existing team');
        return team;
    }

    async setTeam(id: number, teamId: string | null) {
        const user = await this.userRepository.findOne({ where: { id } });
        if (!user) throw new NotFoundException('User not found');

        const team = teamId ? await this.findTeam(teamId) : null;
        user.team_id = team?.id ?? null;
        user.team = team?.name ?? null;
        await this.userRepository.save(user);
        return this.safeUser(user);
    }

    /** The whole team — admins included — for the team page. listAgents() stays assignment-only. */
    async listUsers() {
        const users = await this.userRepository.find({
            order: { created_at: 'DESC' },
        });
        return users.map((user) => this.safeUser(user));
    }

    async listAgents() {
        const agents = await this.userRepository.find({
            where: { user_role: 'agent', blocked: false, suspended: false },
            order: { first_name: 'ASC' },
        });
        return agents.map((agent) => ({
            id: agent.id,
            first_name: agent.first_name,
            last_name: agent.last_name,
        }));
    }

    async forgotPassword(email: string) {
        const user = await this.userRepository.findOne({ where: { email } });
        if (!user) {
            throw new NotFoundException('User not found');
        }

        const token = crypto.randomBytes(32).toString('hex');
        user.reset_token = token;
        user.reset_token_expires = new Date(Date.now() + 3600 * 1000);
        await this.userRepository.save(user);

        const frontendUrl = process.env.FRONTEND_URL;
        const resetLink = `${frontendUrl}/reset-password?token=${token}&email=${user.email}`;
        await sendResetEmail({ to: user.email, resetLink, name: user.first_name });

        return { status: 'Success', message: 'Reset link sent to email' };
    }

    async resetPassword(token: string, newPassword: string) {
        if (!token || !newPassword) {
            throw new BadRequestException('Token and new password are required');
        }

        const user = await this.userRepository.findOne({ where: { reset_token: token } });
        if (!user) {
            throw new BadRequestException('Invalid token');
        }

        if (!user.reset_token_expires || user.reset_token_expires.getTime() < Date.now()) {
            user.reset_token = null;
            user.reset_token_expires = null;
            await this.userRepository.save(user);
            throw new BadRequestException('Token has expired');
        }

        user.password = await bcrypt.hash(newPassword, 10);
        user.password_changed = true;
        user.reset_token = null;
        user.reset_token_expires = null;
        await this.userRepository.save(user);

        return { status: 'Success', message: 'Password reset successfully' };
    }
}



