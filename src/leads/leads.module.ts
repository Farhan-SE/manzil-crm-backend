import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { Lead } from './lead.entity.js';
import { User } from '../auth/user.entity.js';
import { LeadsService } from './leads.service.js';
import { LeadsController } from './leads.controller.js';

@Module({
    imports: [
        TypeOrmModule.forFeature([Lead, User]),
        PassportModule.register({ defaultStrategy: 'jwt' }),
    ],
    providers: [LeadsService],
    controllers: [LeadsController],
    exports: [LeadsService],
})
export class LeadsModule { }
