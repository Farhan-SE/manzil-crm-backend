import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, In, Not, Repository } from 'typeorm';
import { Team } from './team.entity.js';
import { User } from '../auth/user.entity.js';
import { FindTeamsDto, TEAM_TABS, TeamDto, type TeamTab } from './team.dto.js';

type TeamLoad = { members: number; allocated_leads: number; project_assignments: number };

const NO_LOAD: TeamLoad = { members: 0, allocated_leads: 0, project_assignments: 0 };

@Injectable()
export class TeamsService {
    constructor(
        @InjectRepository(Team)
        private teamRepository: Repository<Team>,
        @InjectRepository(User)
        private userRepository: Repository<User>,
    ) { }

    async findAll() {
        const teams = await this.teamRepository.find({ order: { name: 'ASC' } });
        return this.serializeMany(teams);
    }

    /** The teams register: paged, with a count per status tab and each team's lead and project load. */
    async findOverview(query: FindTeamsDto) {
        const page = query.page ?? 1;
        const limit = query.limit ?? 10;

        const inTab = (tab: TeamTab) => {
            const qb = this.teamRepository.createQueryBuilder('team');
            if (tab !== 'all') qb.andWhere('team.is_active = :isActive', { isActive: tab === 'active' });
            if (query.department) qb.andWhere('team.department = :department', { department: query.department });
            if (query.region) qb.andWhere('team.region = :region', { region: query.region });
            if (query.lead_id) qb.andWhere('team.lead_id = :leadId', { leadId: query.lead_id });
            if (query.starred === 'true') qb.andWhere('team.is_starred = true');
            if (query.search) {
                // "TEAM-01", "team1" and "1" all find the team by its number.
                const teamNo = /^(?:team-?)?0*(\d{1,9})$/i.exec(query.search.trim())?.[1];
                qb.andWhere('(team.name ILIKE :search OR team.team_no = :teamNo)', {
                    search: `%${query.search}%`,
                    teamNo: teamNo ? Number(teamNo) : -1,
                });
            }
            return qb;
        };

        const [[teams, total], counts, departments, regions] = await Promise.all([
            inTab(query.status ?? 'active')
                .orderBy('team.team_no', query.sort === 'desc' ? 'DESC' : 'ASC')
                .skip((page - 1) * limit)
                .take(limit)
                .getManyAndCount(),
            // Counted per tab with the other filters applied, so the tabs match the search.
            Promise.all(TEAM_TABS.map((tab) => inTab(tab).getCount())),
            this.distinct('department'),
            this.distinct('region'),
        ]);

        return {
            data: await this.serializeMany(teams),
            total,
            page,
            limit,
            status_counts: Object.fromEntries(TEAM_TABS.map((tab, i) => [tab, counts[i]])),
            departments,
            regions,
        };
    }

    async create(dto: TeamDto) {
        await this.assertNameIsFree(dto.name);
        if (dto.lead_id != null) await this.assertUserExists(dto.lead_id);

        const team = await this.teamRepository.save(
            this.teamRepository.create({
                name: dto.name.trim(),
                lead_id: dto.lead_id ?? null,
                department: dto.department?.trim() || null,
                region: dto.region?.trim() || null,
                office: dto.office?.trim() || null,
                is_active: dto.is_active ?? true,
            }),
        );
        if (dto.member_ids) await this.setMembers(team, dto.member_ids);
        return (await this.serializeMany([team]))[0];
    }

    async update(id: string, dto: TeamDto) {
        const team = await this.teamRepository.findOne({ where: { id } });
        if (!team) throw new NotFoundException('Team not found');
        await this.assertNameIsFree(dto.name, id);
        if (dto.lead_id != null) await this.assertUserExists(dto.lead_id);

        team.name = dto.name.trim();
        if (dto.lead_id !== undefined) team.lead_id = dto.lead_id;
        if (dto.department !== undefined) team.department = dto.department.trim() || null;
        if (dto.region !== undefined) team.region = dto.region.trim() || null;
        if (dto.office !== undefined) team.office = dto.office.trim() || null;
        if (dto.is_active !== undefined) team.is_active = dto.is_active;
        await this.teamRepository.save(team);
        // user.team is a copy of the name that lists read without a join — keep it matching.
        await this.userRepository.update({ team_id: id }, { team: team.name });
        if (dto.member_ids) await this.setMembers(team, dto.member_ids);
        return (await this.serializeMany([team]))[0];
    }

    async setActive(id: string, isActive: boolean) {
        const result = await this.teamRepository.update({ id }, { is_active: isActive });
        if (!result.affected) throw new NotFoundException('Team not found');
        return { id, is_active: isActive };
    }

    async setStarred(id: string, isStarred: boolean) {
        const result = await this.teamRepository.update({ id }, { is_starred: isStarred });
        if (!result.affected) throw new NotFoundException('Team not found');
        return { id, is_starred: isStarred };
    }

    /** Members are kept; they just end up without a team. */
    async remove(id: string) {
        const team = await this.teamRepository.findOne({ where: { id } });
        if (!team) throw new NotFoundException('Team not found');
        await this.userRepository.update({ team_id: id }, { team_id: null, team: null });
        await this.teamRepository.remove(team);
    }

    /** Makes the team's membership exactly `memberIds` — anyone else in it is left without a team. */
    private async setMembers(team: Team, memberIds: number[]) {
        await this.userRepository.update(
            { team_id: team.id, ...(memberIds.length > 0 ? { id: Not(In(memberIds)) } : {}) },
            { team_id: null, team: null },
        );
        if (memberIds.length > 0) {
            await this.userRepository.update({ id: In(memberIds) }, { team_id: team.id, team: team.name });
        }
    }

    private async assertNameIsFree(name: string, excludeId?: string) {
        const existing = await this.teamRepository.findOne({
            where: { name: ILike(name.trim().replace(/[%_\\]/g, '\\$&')), ...(excludeId ? { id: Not(excludeId) } : {}) },
        });
        if (existing) throw new ConflictException('A team with this name already exists');
    }

    private async assertUserExists(id: number) {
        const user = await this.userRepository.findOne({ where: { id } });
        if (!user) throw new BadRequestException('lead_id does not match an existing user');
    }

    private async distinct(column: 'department' | 'region') {
        const rows = await this.teamRepository
            .createQueryBuilder('team')
            .select(`DISTINCT team.${column}`, 'value')
            .where(`team.${column} IS NOT NULL`)
            .orderBy('value', 'ASC')
            .getRawMany<{ value: string }>();
        return rows.map((row) => row.value);
    }

    /** Adds what each team's members add up to, and who leads it. */
    private async serializeMany(teams: Team[]) {
        if (teams.length === 0) return [];

        const leadIds = [...new Set(teams.map((team) => team.lead_id).filter((id) => id !== null))];
        const [rows, leads] = await Promise.all([
            this.teamRepository.query(
                `SELECT u.team_id,
                        COUNT(DISTINCT u.id) AS members,
                        COUNT(l.id) AS allocated_leads,
                        COUNT(DISTINCT l.project_id) AS project_assignments
                 FROM "user" u
                 LEFT JOIN "lead" l ON l.assigned_to_id = u.id
                 WHERE u.team_id = ANY($1::uuid[])
                 GROUP BY u.team_id`,
                [teams.map((team) => team.id)],
            ) as Promise<{ team_id: string; members: string; allocated_leads: string; project_assignments: string }[]>,
            leadIds.length > 0 ? this.userRepository.find({ where: { id: In(leadIds) } }) : [],
        ]);

        const loadByTeam = new Map<string, TeamLoad>(
            rows.map((row) => [
                row.team_id,
                {
                    members: Number(row.members),
                    allocated_leads: Number(row.allocated_leads),
                    project_assignments: Number(row.project_assignments),
                },
            ]),
        );
        const leadById = new Map(leads.map((lead) => [lead.id, lead]));

        return teams.map((team) => {
            const load = loadByTeam.get(team.id) ?? NO_LOAD;
            const lead = team.lead_id ? leadById.get(team.lead_id) : undefined;
            return {
                id: team.id,
                team_no: team.team_no,
                name: team.name,
                lead_id: team.lead_id,
                lead: lead
                    ? {
                        id: lead.id,
                        first_name: lead.first_name,
                        last_name: lead.last_name,
                        designation: lead.designation,
                    }
                    : null,
                department: team.department,
                region: team.region,
                office: team.office,
                is_active: team.is_active,
                is_starred: team.is_starred,
                member_count: load.members,
                allocated_leads: load.allocated_leads,
                project_assignments: load.project_assignments,
                created_at: team.created_at,
            };
        });
    }
}
