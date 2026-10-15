import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../auth/user.entity.js'
import { Tenant } from '../tenants/tenant.entity.js'
import { loadAccess } from '../access/load-access.js'
import type { Requester } from '../access/access.js'

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) throw new Error('JWT_SECRET is missing');

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: any): Promise<Requester> {
    const user = await this.userRepo.findOne({ where: { id: payload.id } });

    if (!user) throw new UnauthorizedException();

    if (user.blocked) throw new UnauthorizedException('Account blocked');

    if (user.suspended) throw new UnauthorizedException('Account suspended');

    if (user.tenant_id) {
      const tenant = await this.userRepo.manager.findOne(Tenant, { where: { id: user.tenant_id } });
      if (tenant?.status !== 'active') throw new UnauthorizedException('Company account suspended');
    }

    const { role, permissions } = await loadAccess(this.userRepo.manager, user.role_id);
    return {
      userId:      user.id,
      email:       user.email,
      role:        user.user_role,
      tenantId:    user.tenant_id,
      roleId:      role?.id ?? null,
      roleName:    role?.name ?? null,
      permissions,
    };
  }
}
