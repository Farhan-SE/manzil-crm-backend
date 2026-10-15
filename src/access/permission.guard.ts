import { applyDecorators, CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata, UseGuards } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { can, type Requester } from './access.js';

const REQUIRED = 'required_permissions';

@Injectable()
export class PermissionGuard implements CanActivate {
    constructor(private readonly reflector: Reflector) { }

    canActivate(context: ExecutionContext): boolean {
        const required = this.reflector.getAllAndOverride<string[]>(REQUIRED, [context.getHandler(), context.getClass()]) ?? [];
        const user = context.switchToHttp().getRequest().user as Requester | undefined;
        if (!user || !required.every((permission) => can(user, permission))) {
            throw new ForbiddenException("Your role doesn't allow this");
        }
        return true;
    }
}

/** Lets the route through only for roles holding every listed permission. Goes after JwtAuthGuard. */
export const Can = (...permissions: string[]) => applyDecorators(SetMetadata(REQUIRED, permissions), UseGuards(PermissionGuard));
