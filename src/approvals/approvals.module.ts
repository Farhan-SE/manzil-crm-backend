import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { Approval } from './approval.entity.js';
import { Lead } from '../leads/lead.entity.js';
import { User } from '../auth/user.entity.js';
import { ApprovalsService } from './approvals.service.js';
import { ApprovalsController } from './approvals.controller.js';

@Module({
    imports: [
        TypeOrmModule.forFeature([Approval, Lead, User]),
        PassportModule.register({ defaultStrategy: 'jwt' }),
    ],
    providers: [ApprovalsService],
    controllers: [ApprovalsController],
    exports: [ApprovalsService],
})
export class ApprovalsModule { }
