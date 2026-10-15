import { EntityManager } from 'typeorm';
import { Role } from './role.entity.js';
import { PERMISSIONS, type Scope } from './permissions.js';

/** The role a user holds and the permissions it gives, resolved from the database on every request. */
export async function loadAccess(manager: EntityManager, roleId: string | null) {
    const role = roleId ? await manager.findOne(Role, { where: { id: roleId }, relations: { permissions: true } }) : null;
    const permissions: Record<string, Scope | true> = {};
    if (role?.is_system) {
        for (const { key, scoped } of PERMISSIONS) permissions[key] = scoped ? 'all' : true;
    } else {
        for (const grant of role?.permissions ?? []) permissions[grant.permission] = (grant.scope as Scope | null) ?? true;
    }
    return { role, permissions };
}
