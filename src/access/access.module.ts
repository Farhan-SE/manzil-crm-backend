import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { Role, RolePermission } from './role.entity.js';
import { RolesService } from './roles.service.js';
import { RolesController } from './roles.controller.js';

@Module({
    imports: [
        TypeOrmModule.forFeature([Role, RolePermission]),
        PassportModule.register({ defaultStrategy: 'jwt' }),
    ],
    providers: [RolesService],
    controllers: [RolesController],
})
export class AccessModule { }
