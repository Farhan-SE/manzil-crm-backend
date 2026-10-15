import {
    BadRequestException,
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseUUIDPipe,
    Patch,
    Post,
    Query,
    UploadedFile,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { UploadedCsv } from '../common/csv.js';
import { CustomerService } from './customer.service.js';
import { CreateCustomerDto } from './create-customer.dto.js';
import { UpdateCustomerDto } from './update-customer.dto.js';
import { FindCustomersDto, StarCustomerDto } from './find-customers.dto.js';
import { JwtAuthGuard } from '../strategies/auth.guard.js';
import { AdminGuard } from '../strategies/admin.guard.js';
import { UserSession } from '../strategies/user.decorator.js';
import { BulkAssignDto } from '../common/bulk-assign.dto.js';

@Controller('customers')
@UseGuards(JwtAuthGuard)
export class CustomerController {
    constructor(private readonly customerService: CustomerService) { }

    // Open to agents: a client an agent adds is theirs.
    @Post()
    create(@Body() dto: CreateCustomerDto, @UserSession() user: any) {
        return this.customerService.create(dto, user);
    }

    /** Moves clients, and their leads with them, to one staff member. */
    @UseGuards(AdminGuard)
    @Post('bulk-assign')
    bulkAssign(@Body() dto: BulkAssignDto) {
        return this.customerService.bulkAssign(dto.ids, dto.assigned_to_id);
    }

    @UseGuards(AdminGuard)
    @Post('import')
    @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
    importCsv(@UploadedFile() file: UploadedCsv) {
        if (!file) throw new BadRequestException('No file uploaded');
        return this.customerService.importCsv(file.buffer);
    }

    @Get()
    findAll(@Query() query: FindCustomersDto, @UserSession() user: any) {
        return this.customerService.findAll(query, user);
    }

    @Get(':id')
    findOne(@Param('id', ParseUUIDPipe) id: string, @UserSession() user: any) {
        return this.customerService.findOne(id, user);
    }

    // No AdminGuard: the service lets the customer's own agent through, admins for any.
    @Patch(':id')
    update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCustomerDto, @UserSession() user: any) {
        return this.customerService.update(id, dto, user);
    }

    // Open to every agent, like the list itself — a star is a shared marker, not an edit.
    @Patch(':id/star')
    setStarred(@Param('id', ParseUUIDPipe) id: string, @Body() dto: StarCustomerDto) {
        return this.customerService.setStarred(id, dto.is_starred);
    }

    @UseGuards(AdminGuard)
    @Delete(':id')
    async remove(@Param('id', ParseUUIDPipe) id: string) {
        await this.customerService.remove(id);
        return { message: 'Customer deleted successfully' };
    }
}
