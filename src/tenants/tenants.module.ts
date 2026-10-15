import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { Tenant } from './tenant.entity.js';
import { TenantsService } from './tenants.service.js';
import { CompanyLogoController, TenantsController } from './tenants.controller.js';

@Module({
    imports: [
        TypeOrmModule.forFeature([Tenant]),
        PassportModule.register({ defaultStrategy: 'jwt' }),
    ],
    providers: [TenantsService],
    controllers: [TenantsController, CompanyLogoController],
})
export class TenantsModule { }
