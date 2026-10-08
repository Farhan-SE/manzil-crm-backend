import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { PartnerProject } from './partner-project.entity.js';
import { PartnerProjectsService } from './partner-projects.service.js';
import { PartnerProjectsController } from './partner-projects.controller.js';
import { LocationsModule } from '../locations/locations.module.js';

@Module({
    imports: [
        TypeOrmModule.forFeature([PartnerProject]),
        LocationsModule,
        PassportModule.register({ defaultStrategy: 'jwt' }),
    ],
    providers: [PartnerProjectsService],
    controllers: [PartnerProjectsController],
    exports: [PartnerProjectsService],
})
export class PartnerProjectsModule { }
