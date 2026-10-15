import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest().user;

    if (!user || user.role !== 'super_admin') {
      throw new ForbiddenException('Platform admin access only');
    }
    return true;
  }
}
