import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, In, Not, Repository } from 'typeorm';
import { Team } from './team.entity.js';
import { User } from '../auth/user.entity.js';

@Injectable()
export class TeamsService {
    constructor(
        @InjectRepository(Team)
        private teamRepository: Repository<Team>,
        @InjectRepository(User)
        private userRepository: Repository<User>,
    ) { }

    async findAll() {
        const [teams, counts] = await Promise.all([
            this.teamRepository.find({ order: { name: 'ASC' } }),
            this.userRepository
                .createQueryBuilder('user')
                .select('user.team_id', 'team_id')
                .addSelect('COUNT(*)', 'count')
                .where('user.team_id IS NOT NULL')
                .groupBy('user.team_id')
                .getRawMany<{ team_id: string; count: string }>(),
        ]);
        const countByTeam = new Map(counts.map((row) => [row.team_id, Number(row.count)]));
        return teams.map((team) => this.serialize(team, countByTeam.get(team.id) ?? 0));
    }

    async create(name: string, memberIds?: number[]) {
        await this.assertNameIsFree(name);
        const team = await this.teamRepository.save(this.teamRepository.create({ name: name.trim() }));
        if (memberIds) await this.setMembers(team, memberIds);
        return this.serialize(team, await this.userRepository.count({ where: { team_id: team.id } }));
    }

    async update(id: string, name: string, memberIds?: number[]) {
        const team = await this.teamRepository.findOne({ where: { id } });
        if (!team) throw new NotFoundException('Team not found');
        await this.assertNameIsFree(name, id);

        team.name = name.trim();
        await this.teamRepository.save(team);
        // user.team is a copy of the name that lists read without a join — keep it matching.
        await this.userRepository.update({ team_id: id }, { team: team.name });
        if (memberIds) await this.setMembers(team, memberIds);
        return this.serialize(team, await this.userRepository.count({ where: { team_id: id } }));
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

    private serialize(team: Team, memberCount: number) {
        return { id: team.id, name: team.name, member_count: memberCount, created_at: team.created_at };
    }
}
