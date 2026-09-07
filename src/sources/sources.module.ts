import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { Source } from './source.entity.js';
import { SourcesService } from './sources.service.js';
import { SourcesController } from './sources.controller.js';

@Module({
    imports: [
        TypeOrmModule.forFeature([Source]),
        PassportModule.register({ defaultStrategy: 'jwt' }),
    ],
    providers: [SourcesService],
    controllers: [SourcesController],
    exports: [SourcesService],
})
export class SourcesModule { }
