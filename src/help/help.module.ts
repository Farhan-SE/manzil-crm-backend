import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { HelpArticle, HelpArticleFeedback, SupportTicket, SupportTicketAttachment } from './help.entity.js';
import { HelpService } from './help.service.js';
import { HelpController } from './help.controller.js';

@Module({
    imports: [
        TypeOrmModule.forFeature([HelpArticle, HelpArticleFeedback, SupportTicket, SupportTicketAttachment]),
        PassportModule.register({ defaultStrategy: 'jwt' }),
    ],
    providers: [HelpService],
    controllers: [HelpController],
})
export class HelpModule { }
