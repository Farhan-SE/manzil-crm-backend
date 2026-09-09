import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseUUIDPipe,
    Patch,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';
import { CustomerService } from './customer.service.js';
import { CreateCustomerDto } from './create-customer.dto.js';
import { UpdateCustomerDto } from './update-customer.dto.js';
import { FindCustomersDto } from './find-customers.dto.js';
import { JwtAuthGuard } from '../strategies/auth.guard.js';
import { AdminGuard } from '../strategies/admin.guard.js';
import { UserSession } from '../strategies/user.decorator.js';

@Controller('customers')
@UseGuards(JwtAuthGuard)
export class CustomerController {
    constructor(private readonly customerService: CustomerService) { }

    @UseGuards(AdminGuard)
    @Post()
    create(@Body() dto: CreateCustomerDto) {
        return this.customerService.create(dto);
    }

    @Get()
    findAll(@Query() query: FindCustomersDto) {
        return this.customerService.findAll(query);
    }

    @Get(':id')
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.customerService.findOne(id);
    }

    // No AdminGuard: the service lets the customer's own agent through, admins for any.
    @Patch(':id')
    update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCustomerDto, @UserSession() user: any) {
        return this.customerService.update(id, dto, user);
    }

    @UseGuards(AdminGuard)
    @Delete(':id')
    async remove(@Param('id', ParseUUIDPipe) id: string) {
        await this.customerService.remove(id);
        return { message: 'Customer deleted successfully' };
    }
}
