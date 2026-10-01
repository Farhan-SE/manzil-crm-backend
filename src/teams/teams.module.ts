import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { Team } from './team.entity.js';
import { User } from '../auth/user.entity.js';
import { TeamsService } from './teams.service.js';
import { TeamsController } from './teams.controller.js';

@Module({
    imports: [
        TypeOrmModule.forFeature([Team, User]),
        PassportModule.register({ defaultStrategy: 'jwt' }),
    ],
    providers: [TeamsService],
    controllers: [TeamsController],
})
export class TeamsModule { }
