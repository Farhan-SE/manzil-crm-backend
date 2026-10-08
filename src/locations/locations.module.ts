import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { Location } from './location.entity.js';
import { LocationsService } from './locations.service.js';
import { LocationsController } from './locations.controller.js';

@Module({
    imports: [
        TypeOrmModule.forFeature([Location]),
        PassportModule.register({ defaultStrategy: 'jwt' }),
    ],
    providers: [LocationsService],
    controllers: [LocationsController],
    exports: [LocationsService],
})
export class LocationsModule { }
