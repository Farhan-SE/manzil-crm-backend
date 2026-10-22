import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { WhatsappNumber } from './whatsapp-number.entity.js';
import { WhatsappClient } from './whatsapp.client.js';
import { WhatsappNumbersController, WhatsappWebhookController } from './whatsapp.controller.js';
import { WhatsappService } from './whatsapp.service.js';

@Module({
    imports: [
        TypeOrmModule.forFeature([WhatsappNumber]),
        PassportModule.register({ defaultStrategy: 'jwt' }),
    ],
    providers: [WhatsappService, WhatsappClient],
    controllers: [WhatsappWebhookController, WhatsappNumbersController],
})
export class WhatsappModule { }
