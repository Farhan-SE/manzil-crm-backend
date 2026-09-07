import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { AuthService } from './auth.service.js';
import { LoginDto } from "./login.dto.js";
import { AddUserDto } from "./add-user.dto.js";
import { JwtAuthGuard } from "../strategies/auth.guard.js";
import { AdminGuard } from "../strategies/admin.guard.js";


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