import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { Lead } from '../leads/lead.entity.js';
import { FollowUp } from '../follow-ups/follow-up.entity.js';
import { Customers } from '../customer/customer.entity.js';
import { StatsService } from './stats.service.js';
import { StatsController } from './stats.controller.js';

@Module({
    imports: [
        TypeOrmModule.forFeature([Lead, FollowUp, Customers]),
        PassportModule.register({ defaultStrategy: 'jwt' }),
    ],
    providers: [StatsService],
    controllers: [StatsController],
})
export class StatsModule { }
