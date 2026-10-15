import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Not, Repository } from 'typeorm';
import { Role, RolePermission } from './role.entity.js';
import { CreateRoleDto, GrantDto, UpdateRoleDto } from './role.dto.js';
import { AGENT_GRANTS, PERMISSIONS, SCOPED_KEYS, type PermissionGrant } from './permissions.js';
import { tenantId } from '../tenants/tenant-context.js';

/** Gives a new company its Admin role and a starter Agent role, the one new staff get by default. */
export async function seedRoles(manager: EntityManager, tenant: string) {
    const admin = await manager.save(
        manager.create(Role, { tenant_id: tenant, name: 'Admin', description: 'Full access to everything in the company', is_system: true }),
    );
    const agent = await manager.save(
        manager.create(Role, {
            tenant_id: tenant,
            name: 'Agent',
            description: 'Works their own leads and clients',
            is_default: true,
            permissions: AGENT_GRANTS.map((grant) => manager.create(RolePermission, grant)),
        }),
    );
    return { admin, agent };
}

@Injectable()
export class RolesService {
    constructor(
        @InjectRepository(Role)
        private roleRepository: Repository<Role>,
    ) { }

    /** The catalogue a role is built from, grouped by module. */
    catalogue() {
        const modules = [...new Set(PERMISSIONS.map((permission) => permission.module))];
        return modules.map((module) => ({
            module,
            permissions: PERMISSIONS.filter((permission) => permission.module === module),
        }));
    }

    async findAll() {
        const roles = await this.roleRepository.find({
            where: { tenant_id: tenantId() },
            relations: { permissions: true },
            order: { is_system: 'DESC', name: 'ASC' },
        });
        const counts = await this.userCounts();
        return roles.map((role) => this.serialize(role, counts.get(role.id) ?? 0));
    }

    async findOne(id: string) {
        const role = await this.find(id);
        return this.serialize(role, (await this.userCounts()).get(id) ?? 0);
    }

    async create(dto: CreateRoleDto) {
        await this.assertNameIsFree(dto.name);
        const grants = this.toGrants(dto.permissions);
        const role = await this.roleRepository.manager.transaction(async (manager) => {
            if (dto.is_default) await this.clearDefault(manager);
            return manager.save(
                manager.create(Role, {
                    name: dto.name.trim(),
                    description: dto.description?.trim() || null,
                    is_default: dto.is_default ?? false,
                    permissions: grants.map((grant) => manager.create(RolePermission, grant)),
                }),
            );
        });
        return this.findOne(role.id);
    }

    async update(id: string, dto: UpdateRoleDto) {
        const role = await this.find(id);
        if (role.is_system && (dto.name !== undefined || dto.permissions !== undefined)) {
            throw new BadRequestException('The Admin role always has full access and keeps its name');
        }
        if (dto.is_default === false && role.is_default) {
            throw new BadRequestException('Make another role the default instead');
        }
        if (dto.name !== undefined) await this.assertNameIsFree(dto.name, id);
        const grants = dto.permissions ? this.toGrants(dto.permissions) : null;

        await this.roleRepository.manager.transaction(async (manager) => {
            if (dto.is_default) await this.clearDefault(manager);
            await manager.update(Role, { id }, {
                ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
                ...(dto.description !== undefined ? { description: dto.description.trim() || null } : {}),
                ...(dto.is_default ? { is_default: true } : {}),
            });
            if (grants) {
                await manager.delete(RolePermission, { role_id: id });
                if (grants.length > 0) await manager.insert(RolePermission, grants.map((grant) => ({ ...grant, role_id: id })));
            }
        });
        return this.findOne(id);
    }

    async remove(id: string) {
        const role = await this.find(id);
        if (role.is_system) throw new BadRequestException('The Admin role cannot be deleted');
        if (role.is_default) throw new BadRequestException('Make another role the default before deleting this one');
        const users = (await this.userCounts()).get(id) ?? 0;
        if (users > 0) throw new ConflictException(`${users} staff member${users === 1 ? ' holds' : 's hold'} this role. Move them to another role first`);
        await this.roleRepository.delete({ id });
    }

    private async find(id: string) {
        const role = await this.roleRepository.findOne({ where: { id, tenant_id: tenantId() }, relations: { permissions: true } });
        if (!role) throw new NotFoundException('Role not found');
        return role;
    }

    /** Checks each grant has a scope exactly when its permission takes one. */
    private toGrants(grants: GrantDto[]): PermissionGrant[] {
        return grants.map(({ permission, scope }) => {
            const scoped = SCOPED_KEYS.has(permission);
            if (scoped && !scope) throw new BadRequestException(`${permission} needs a scope: own, team or all`);
            if (!scoped && scope) throw new BadRequestException(`${permission} doesn't take a scope`);
            return { permission, scope: (scope as PermissionGrant['scope']) ?? null };
        });
    }

    private async clearDefault(manager: EntityManager) {
        await manager.update(Role, { tenant_id: tenantId(), is_default: true }, { is_default: false });
    }

    private async assertNameIsFree(name: string, excludeId?: string) {
        const taken = await this.roleRepository.exists({
            where: { tenant_id: tenantId(), name: name.trim(), ...(excludeId ? { id: Not(excludeId) } : {}) },
        });
        if (taken) throw new ConflictException('A role with this name already exists');
    }

    private async userCounts() {
        const rows: { role_id: string; count: string }[] = await this.roleRepository.query(
            `SELECT role_id, COUNT(*) AS count FROM "user" WHERE tenant_id = $1 AND role_id IS NOT NULL GROUP BY role_id`,
            [tenantId()],
        );
        return new Map(rows.map((row) => [row.role_id, Number(row.count)]));
    }

    private serialize(role: Role, userCount: number) {
        return {
            id: role.id,
            name: role.name,
            description: role.description,
            is_system: role.is_system,
            is_default: role.is_default,
            user_count: userCount,
            // The Admin role's permissions are implied rather than stored.
            permissions: role.is_system
                ? PERMISSIONS.map(({ key, scoped }) => ({ permission: key, scope: scoped ? 'all' : null }))
                : role.permissions.map(({ permission, scope }) => ({ permission, scope })),
            created_at: role.created_at,
            updated_at: role.updated_at,
        };
    }
}
