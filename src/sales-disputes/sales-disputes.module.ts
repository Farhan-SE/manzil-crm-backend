import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { SalesDispute } from './sales-dispute.entity.js';
import { Lead } from '../leads/lead.entity.js';
import { User } from '../auth/user.entity.js';
import { SalesDisputesService } from './sales-disputes.service.js';
import { SalesDisputesController } from './sales-disputes.controller.js';

@Module({
    imports: [
        TypeOrmModule.forFeature([SalesDispute, Lead, User]),
        PassportModule.register({ defaultStrategy: 'jwt' }),
    ],
    providers: [SalesDisputesService],
    controllers: [SalesDisputesController],
    exports: [SalesDisputesService],
})
export class SalesDisputesModule { }
