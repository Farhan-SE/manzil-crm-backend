import {
    Body,
    Controller,
    Get,
    Param,
    Post,
    Put,
    Query,
    UploadedFiles,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { HelpService, type UploadedAttachment } from './help.service.js';
import { ArticleFeedbackDto, CreateSupportTicketDto, FindHelpDto } from './help.dto.js';
import { JwtAuthGuard } from '../strategies/auth.guard.js';
import { UserSession } from '../strategies/user.decorator.js';

@Controller('help')
@UseGuards(JwtAuthGuard)
export class HelpController {
    constructor(private readonly helpService: HelpService) { }

    @Get()
    overview(@Query() query: FindHelpDto) {
        return this.helpService.overview(query);
    }

    @Get('articles')
    findArticles() {
        return this.helpService.findArticles();
    }

    @Get('articles/:slug')
    findArticle(@Param('slug') slug: string, @UserSession() user: any) {
        return this.helpService.findArticle(slug, user.userId);
    }

    @Put('articles/:slug/feedback')
    saveFeedback(@Param('slug') slug: string, @Body() dto: ArticleFeedbackDto, @UserSession() user: any) {
        return this.helpService.saveFeedback(slug, dto.helpful, user.userId);
    }

    @Post('tickets')
    @UseInterceptors(FilesInterceptor('attachments', 5, { limits: { fileSize: 10 * 1024 * 1024 } }))
    createTicket(
        @Body() dto: CreateSupportTicketDto,
        @UploadedFiles() files: UploadedAttachment[] | undefined,
        @UserSession() user: any,
    ) {
        return this.helpService.createTicket(dto, files ?? [], user.userId);
    }
}
