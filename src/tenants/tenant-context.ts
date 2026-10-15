import { AsyncLocalStorage } from 'node:async_hooks';
import { ForbiddenException } from '@nestjs/common';

const storage = new AsyncLocalStorage<{ tenantId: string | null }>();

export function runInTenant<T>(tenantId: string | null, fn: () => T): T {
    return storage.run({ tenantId }, fn);
}

/** The company the current request acts for. Throws rather than let a query run unscoped. */
export function tenantId(): string {
    const id = storage.getStore()?.tenantId;
    if (!id) throw new ForbiddenException('This action needs a company account');
    return id;
}

export function currentTenantId(): string | null {
    return storage.getStore()?.tenantId ?? null;
}
