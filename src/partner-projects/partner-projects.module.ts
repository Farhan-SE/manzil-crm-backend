import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { PartnerProject } from './partner-project.entity.js';
import { PartnerProjectsService } from './partner-projects.service.js';
import { PartnerProjectsController } from './partner-projects.controller.js';

@Module({
    imports: [
        TypeOrmModule.forFeature([PartnerProject]),
        PassportModule.register({ defaultStrategy: 'jwt' }),
    ],
    providers: [PartnerProjectsService],
    controllers: [PartnerProjectsController],
    exports: [PartnerProjectsService],
})
export class PartnerProjectsModule { }
