import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { runInTenant } from './tenant-context.js';

/** Runs each handler inside its user's company, so services can read it without it being passed down. */
@Injectable()
export class TenantInterceptor implements NestInterceptor {
    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
        const tenant = context.switchToHttp().getRequest().user?.tenantId ?? null;
        // Subscribing inside the store matters: the handler only starts running on subscribe.
        return new Observable((subscriber) => runInTenant(tenant, () => next.handle().subscribe(subscriber)));
    }
}
