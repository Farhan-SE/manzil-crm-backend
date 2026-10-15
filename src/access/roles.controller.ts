import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../strategies/auth.guard.js';
import { Can } from './permission.guard.js';
import { RolesService } from './roles.service.js';
import { CreateRoleDto, UpdateRoleDto } from './role.dto.js';

// Reading is open to all staff: the staff screens show role names and the client hides what a role can't do.
@Controller('roles')
@UseGuards(JwtAuthGuard)
export class RolesController {
    constructor(private readonly rolesService: RolesService) { }

    @Get('permissions')
    catalogue() {
        return this.rolesService.catalogue();
    }

    @Get()
    findAll() {
        return this.rolesService.findAll();
    }

    @Get(':id')
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.rolesService.findOne(id);
    }

    @Can('roles.manage')
    @Post()
    create(@Body() dto: CreateRoleDto) {
        return this.rolesService.create(dto);
    }

    @Can('roles.manage')
    @Patch(':id')
    update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRoleDto) {
        return this.rolesService.update(id, dto);
    }

    @Can('roles.manage')
    @Delete(':id')
    @HttpCode(204)
    async remove(@Param('id', ParseUUIDPipe) id: string) {
        await this.rolesService.remove(id);
    }
}
