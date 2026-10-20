import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../strategies/auth.guard.js';
import { Can } from '../access/permission.guard.js';
import { UserSession } from '../strategies/user.decorator.js';
import { CustomerImportService } from './customer-import.service.js';

class CreateImportDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(255)
    file_name: string;
}

@Controller('customers/imports')
@UseGuards(JwtAuthGuard)
export class CustomerImportController {
    constructor(private readonly importService: CustomerImportService) { }

    @Can('customers.import')
    @Post()
    create(@Body() dto: CreateImportDto, @UserSession() user: any) {
        return this.importService.create(dto.file_name, user.userId);
    }

    @Can('customers.import')
    @Post(':id/start')
    start(@Param('id', ParseUUIDPipe) id: string) {
        return this.importService.start(id);
    }

    @Can('customers.import')
    @Get('active')
    active() {
        return this.importService.active();
    }

    @Can('customers.import')
    @Get(':id')
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.importService.findOne(id);
    }
}
