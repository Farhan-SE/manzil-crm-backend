import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { Category } from '../categories/category.entity.js';
import { Customers } from '../customer/customer.entity.js';
import { Interest } from '../interests/interest.entity.js';
import { Lead } from '../leads/lead.entity.js';
import { Source } from '../sources/source.entity.js';
import { Unit } from '../units/unit.entity.js';
import { InventorySearch } from './inventory-search.js';
import { PropertyChatClient } from './property-chat.client.js';
import { WhatsappNumber } from './whatsapp-number.entity.js';
import { WhatsappClient } from './whatsapp.client.js';
import { ChatbotTestController, WhatsappNumbersController, WhatsappWebhookController } from './whatsapp.controller.js';
import { WhatsappLeadService } from './whatsapp-lead.service.js';
import { WhatsappService } from './whatsapp.service.js';

@Module({
    imports: [
        TypeOrmModule.forFeature([WhatsappNumber, Unit, Lead, Customers, Interest, Category, Source]),
        PassportModule.register({ defaultStrategy: 'jwt' }),
    ],
    providers: [WhatsappService, WhatsappClient, PropertyChatClient, InventorySearch, WhatsappLeadService],
    controllers: [WhatsappWebhookController, WhatsappNumbersController, ChatbotTestController],
})
export class WhatsappModule { }
