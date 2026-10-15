import { ForbiddenException } from '@nestjs/common';
import { EntityManager, In, type ObjectLiteral, type SelectQueryBuilder } from 'typeorm';
import type { Scope } from './permissions.js';

/** The signed-in user as every handler sees it: who they are and what their role lets them do. */
export type Requester = {
    userId: number;
    email: string;
    /** 'super_admin', or the legacy 'admin' / 'agent' mirror of the role. Not used for access checks. */
    role: string;
    tenantId: string | null;
    roleId: string | null;
    roleName: string | null;
    /** Scope for scoped permissions, true for plain ones. A missing key means not allowed. */
    permissions: Record<string, Scope | true>;
    /** The user and the people they lead, looked up once per request when a `team` scope needs it. */
    teamUserIds?: Promise<number[]>;
};

export function can(requester: Requester, permission: string) {
    return permission in requester.permissions;
}

export function assertCan(requester: Requester, permission: string) {
    if (!can(requester, permission)) throw new ForbiddenException("Your role doesn't allow this");
}

/**
 * Whose records a scoped permission reaches: null means everyone in the company, otherwise the
 * user ids. Throws when the role doesn't have the permission at all.
 */
export async function scopedUserIds(manager: EntityManager, requester: Requester, permission: string): Promise<number[] | null> {
    const scope = requester.permissions[permission];
    if (!scope) throw new ForbiddenException("Your role doesn't allow this");
    if (scope === 'all' || scope === true) return null;
    if (scope === 'own') return [requester.userId];
    requester.teamUserIds ??= teamOf(manager, requester);
    return requester.teamUserIds;
}

/** Whether a record owned by `ownerId` is within the requester's reach for this permission. */
export async function reaches(manager: EntityManager, requester: Requester, permission: string, ownerId: number | null | undefined) {
    if (!can(requester, permission)) return false;
    const ids = await scopedUserIds(manager, requester, permission);
    return ids === null || (ownerId != null && ids.includes(ownerId));
}

export async function assertReaches(manager: EntityManager, requester: Requester, permission: string, ownerId: number | null | undefined, message: string) {
    if (!(await reaches(manager, requester, permission, ownerId))) throw new ForbiddenException(message);
}

/**
 * A where value for an owner id column: everyone in scope, or the one person a filter asks for when
 * they are in scope. -1 matches nobody. Undefined means nothing narrows the query.
 */
export function ownerFilter(owners: number[] | null, requested?: number) {
    if (owners === null) return requested;
    if (requested !== undefined) return owners.includes(requested) ? requested : -1;
    return In(owners);
}

/** ownerFilter for a query builder: narrows `column` to the owners in scope, or the one asked for. */
export function narrowToOwners<T extends ObjectLiteral>(qb: SelectQueryBuilder<T>, column: string, owners: number[] | null, requested?: number) {
    const owner = ownerFilter(owners, requested);
    if (owner === undefined) return qb;
    if (typeof owner === 'number') return qb.andWhere(`${column} = :scopeOwnerId`, { scopeOwnerId: owner });
    return qb.andWhere(`${column} IN (:...scopeOwnerIds)`, { scopeOwnerIds: owners });
}

/** The user, everyone in a team they lead, and everyone who reports to them. */
async function teamOf(manager: EntityManager, requester: Requester) {
    const rows: { id: number }[] = await manager.query(
        `SELECT u.id FROM "user" u
         WHERE u.tenant_id = $2
           AND (u.id = $1 OR u.manager_id = $1
                OR u.team_id IN (SELECT t.id FROM "team" t WHERE t.lead_id = $1 AND t.tenant_id = $2))`,
        [requester.userId, requester.tenantId],
    );
    return rows.map((row) => row.id);
}
