import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { Customers } from './customer.entity.js';
import { User } from '../auth/user.entity.js';
import { Source } from '../sources/source.entity.js';
import { Lead } from '../leads/lead.entity.js';
import { CustomerService } from './customer.service.js';
import { CustomerController } from './customer.controller.js';

@Module({
    imports: [
        TypeOrmModule.forFeature([Customers, User, Source, Lead]),
        PassportModule.register({ defaultStrategy: 'jwt' }),
    ],
    providers: [CustomerService],
    controllers: [CustomerController],
    exports: [CustomerService],
})
export class CustomerModule { }
