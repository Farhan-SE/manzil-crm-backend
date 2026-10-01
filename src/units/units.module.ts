import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { Unit } from './unit.entity.js';
import { PartnerProject } from '../partner-projects/partner-project.entity.js';
import { UnitsService } from './units.service.js';
import { UnitsController } from './units.controller.js';

@Module({
    imports: [
        TypeOrmModule.forFeature([Unit, PartnerProject]),
        PassportModule.register({ defaultStrategy: 'jwt' }),
    ],
    providers: [UnitsService],
    controllers: [UnitsController],
    exports: [UnitsService],
})
export class UnitsModule { }
