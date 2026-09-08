import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { Listing } from './listing.entity.js';
import { User } from '../auth/user.entity.js';
import { ListingsService } from './listings.service.js';
import { ListingsController } from './listings.controller.js';

@Module({
    imports: [
        TypeOrmModule.forFeature([Listing, User]),
        PassportModule.register({ defaultStrategy: 'jwt' }),
    ],
    providers: [ListingsService],
    controllers: [ListingsController],
    exports: [ListingsService],
})
export class ListingsModule { }
