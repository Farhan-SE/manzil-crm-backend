import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { Customers } from './customer.entity.js';
import { User } from '../auth/user.entity.js';
import { Source } from '../sources/source.entity.js';
import { Lead } from '../leads/lead.entity.js';
import { PartnerProject } from '../partner-projects/partner-project.entity.js';
import { CustomerService } from './customer.service.js';
import { CustomerController } from './customer.controller.js';
import { CustomerImport } from './customer-import.entity.js';
import { CustomerImportService } from './customer-import.service.js';
import { CustomerImportController } from './customer-import.controller.js';

@Module({
    imports: [
        TypeOrmModule.forFeature([Customers, User, Source, Lead, PartnerProject, CustomerImport]),
        PassportModule.register({ defaultStrategy: 'jwt' }),
    ],
    providers: [CustomerService, CustomerImportService],
    controllers: [CustomerController, CustomerImportController],
    exports: [CustomerService],
})
export class CustomerModule { }
