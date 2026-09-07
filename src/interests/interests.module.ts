import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { Interest } from './interest.entity.js';
import { InterestsService } from './interests.service.js';
import { InterestsController } from './interests.controller.js';

@Module({
    imports: [
        TypeOrmModule.forFeature([Interest]),
        PassportModule.register({ defaultStrategy: 'jwt' }),
    ],
    providers: [InterestsService],
    controllers: [InterestsController],
    exports: [InterestsService],
})
export class InterestsModule { }
