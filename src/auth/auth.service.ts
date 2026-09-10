import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { User } from "./user.entity.js";
import { LoginDto } from "./login.dto.js";
import { AddUserDto } from "./add-user.dto.js";
import { ChangePasswordDto } from "./change-password.dto.js";
import { Repository } from "typeorm";
import * as bcrypt from 'bcrypt';
import { JwtService } from "@nestjs/jwt";
import * as crypto from 'crypto';
import { sendResetEmail } from "../mailer/mailer.js";

@Injectable()
export class AuthService {
    constructor(
        @InjectRepository(User)
        private userRepository: Repository<User>,
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
            blocked: user.blocked,
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

        const plainPassword = this.generatePassword();
        const hashedPassword = await bcrypt.hash(plainPassword, 10);

        const user = this.userRepository.create({
            first_name: dto.first_name,
            last_name: dto.last_name,
            email: dto.email,
            password: hashedPassword,
            user_role:dto.user_role,
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

    /** The whole team — admins included — for the team page. listAgents() stays assignment-only. */
    async listUsers() {
        const users = await this.userRepository.find({
            order: { created_at: 'DESC' },
        });
        return users.map((user) => this.safeUser(user));
    }

    async listAgents() {
        const agents = await this.userRepository.find({
            where: { user_role: 'agent', blocked: false },
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



