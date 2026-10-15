import { EntitySubscriberInterface, EventSubscriber, InsertEvent } from 'typeorm';
import { currentTenantId } from './tenant-context.js';

/** Stamps new rows with the request's company. The column is NOT NULL, so a row inserted outside one fails. */
@EventSubscriber()
export class TenantSubscriber implements EntitySubscriberInterface {
    beforeInsert(event: InsertEvent<any>) {
        if (!event.entity || !event.metadata.findColumnWithPropertyName('tenant_id')) return;
        if (event.entity.tenant_id === undefined) event.entity.tenant_id = currentTenantId();
    }
}
