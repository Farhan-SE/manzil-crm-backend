import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { ReportRun, Target } from './report.entity.js';
import { ReportsService } from './reports.service.js';
import { ReportsController } from './reports.controller.js';

@Module({
    imports: [
        TypeOrmModule.forFeature([Target, ReportRun]),
        PassportModule.register({ defaultStrategy: 'jwt' }),
    ],
    providers: [ReportsService],
    controllers: [ReportsController],
    exports: [ReportsService],
})
export class ReportsModule { }
