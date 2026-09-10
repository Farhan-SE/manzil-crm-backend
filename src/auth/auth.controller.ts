import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from "@nestjs/common";
import { AuthService } from './auth.service.js';
import { LoginDto } from "./login.dto.js";
import { AddUserDto } from "./add-user.dto.js";
import { ChangePasswordDto } from "./change-password.dto.js";
import { BlockUserDto } from "./block-user.dto.js";
import { ChangeRoleDto } from "./change-role.dto.js";
import { JwtAuthGuard } from "../strategies/auth.guard.js";
import { AdminGuard } from "../strategies/admin.guard.js";
import { UserSession } from "../strategies/user.decorator.js";


@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Post('login')
    async login(@Body() dto: LoginDto) {
        return this.authService.login(dto);
    }

    @Post('add-user')
    @UseGuards(JwtAuthGuard, AdminGuard)
    async addUser(@Body() dto: AddUserDto) {
        return this.authService.addUser(dto);
    }

    @Get('users')
    @UseGuards(JwtAuthGuard)
    async listUsers() {
        return this.authService.listUsers();
    }

    @Patch('change-password')
    @UseGuards(JwtAuthGuard)
    async changePassword(@Body() dto: ChangePasswordDto, @UserSession() user: any) {
        return this.authService.changePassword(user.userId, dto);
    }

    @Patch('users/:id/block')
    @UseGuards(JwtAuthGuard, AdminGuard)
    async setBlocked(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: BlockUserDto,
        @UserSession() user: any,
    ) {
        return this.authService.setBlocked(id, dto.blocked, user.userId);
    }

    @Patch('users/:id/role')
    @UseGuards(JwtAuthGuard, AdminGuard)
    async setRole(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: ChangeRoleDto,
        @UserSession() user: any,
    ) {
        return this.authService.setRole(id, dto.user_role, user.userId);
    }

    @Get('agents')
    @UseGuards(JwtAuthGuard, AdminGuard)
    async listAgents() {
        return this.authService.listAgents();
    }


    @Post('forgot-password')
    async forgotPassword(@Body('email') email: string) {
        return this.authService.forgotPassword(email);
    }


    @Post('reset-password-token')
    async resetPasswordWithToken(
        @Body('token') token: string,
        @Body('new_password') newPassword: string,
    ) {
        return this.authService.resetPassword(token, newPassword);
    }

    
}