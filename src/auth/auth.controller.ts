import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AuthService } from './auth.service.js';
import { LoginDto } from "./login.dto.js";
import { AddUserDto, SetTeamDto } from "./add-user.dto.js";
import { ChangePasswordDto } from "./change-password.dto.js";
import { BlockUserDto } from "./block-user.dto.js";
import { ChangeRoleDto } from "./change-role.dto.js";
import { FindStaffDto, StarUserDto, SuspendUserDto, UpdateStaffProfileDto } from "./staff.dto.js";
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

    @Get('staff')
    @UseGuards(JwtAuthGuard)
    async listStaff(@Query() query: FindStaffDto) {
        return this.authService.listStaff(query);
    }

    @Patch('users/:id/profile')
    @UseGuards(JwtAuthGuard, AdminGuard)
    async updateProfile(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateStaffProfileDto) {
        return this.authService.updateProfile(id, dto);
    }

    @Patch('users/:id/suspend')
    @UseGuards(JwtAuthGuard, AdminGuard)
    async setSuspended(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: SuspendUserDto,
        @UserSession() user: any,
    ) {
        return this.authService.setSuspended(id, dto.suspended, user.userId);
    }

    // Open to every member, like the list itself — a star is a shared marker, not an edit.
    @Patch('users/:id/star')
    @UseGuards(JwtAuthGuard)
    async setStarred(@Param('id', ParseIntPipe) id: number, @Body() dto: StarUserDto) {
        return this.authService.setStarred(id, dto.is_starred);
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

    @Patch('users/:id/team')
    @UseGuards(JwtAuthGuard, AdminGuard)
    async setTeam(@Param('id', ParseIntPipe) id: number, @Body() dto: SetTeamDto) {
        return this.authService.setTeam(id, dto.team_id);
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