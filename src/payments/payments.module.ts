import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { Payment } from './payment.entity.js';
import { Lead } from '../leads/lead.entity.js';
import { PaymentsService } from './payments.service.js';
import { PaymentsController } from './payments.controller.js';

@Module({
    imports: [
        TypeOrmModule.forFeature([Payment, Lead]),
        PassportModule.register({ defaultStrategy: 'jwt' }),
    ],
    providers: [PaymentsService],
    controllers: [PaymentsController],
    exports: [PaymentsService],
})
export class PaymentsModule { }
