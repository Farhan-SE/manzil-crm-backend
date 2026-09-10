import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { Lead } from './lead.entity.js';
import { User } from '../auth/user.entity.js';
import { Interest } from '../interests/interest.entity.js';
import { Category } from '../categories/category.entity.js';
import { Source } from '../sources/source.entity.js';
import { LeadsService } from './leads.service.js';
import { LeadsController } from './leads.controller.js';

@Module({
    imports: [
        TypeOrmModule.forFeature([Lead, User, Interest, Category, Source]),
        PassportModule.register({ defaultStrategy: 'jwt' }),
    ],
    providers: [LeadsService],
    controllers: [LeadsController],
    exports: [LeadsService],
})
export class LeadsModule { }
