import { BadRequestException } from '@nestjs/common';
import { EntityManager, EntityTarget, ObjectLiteral } from 'typeorm';
import { tenantId } from './tenant-context.js';

/** Rejects an id sent in a request unless it names a record of the caller's own company. */
export async function assertOwned(
    manager: EntityManager,
    entity: EntityTarget<ObjectLiteral>,
    id: string | number | null | undefined,
    field: string,
) {
    if (id === null || id === undefined) return;
    const found = await manager.exists(entity, { where: { id, tenant_id: tenantId() } });
    if (!found) throw new BadRequestException(`${field} does not match an existing record`);
}
