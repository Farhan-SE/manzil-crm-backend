import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AuthService } from './auth.service.js';
import { LoginDto } from "./login.dto.js";
import { AddUserDto, SetTeamDto } from "./add-user.dto.js";
import { ChangePasswordDto } from "./change-password.dto.js";
import { BlockUserDto } from "./block-user.dto.js";
import { ChangeRoleDto } from "./change-role.dto.js";
import { FindStaffDto, StarUserDto, SuspendUserDto, TransferLeadsDto, UpdateStaffProfileDto } from "./staff.dto.js";
import { JwtAuthGuard } from "../strategies/auth.guard.js";
import { UserSession } from "../strategies/user.decorator.js";
import { Can } from "../access/permission.guard.js";
import type { Requester } from "../access/access.js";


@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Post('login')
    async login(@Body() dto: LoginDto) {
        return this.authService.login(dto);
    }

    @Post('add-user')
    @Can('staff.manage')
    @UseGuards(JwtAuthGuard)
    async addUser(@Body() dto: AddUserDto, @UserSession() user: Requester) {
        return this.authService.addUser(dto, user);
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
    @Can('staff.manage')
    @UseGuards(JwtAuthGuard)
    async updateProfile(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateStaffProfileDto) {
        return this.authService.updateProfile(id, dto);
    }

    @Patch('users/:id/suspend')
    @Can('staff.manage')
    @UseGuards(JwtAuthGuard)
    async setSuspended(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: SuspendUserDto,
        @UserSession() user: any,
    ) {
        return this.authService.setSuspended(id, dto.suspended, user.userId);
    }

    /** Hands every lead and client of one member to another, usually before deactivating them. */
    @Post('users/:id/transfer-leads')
    @Can('staff.manage')
    @UseGuards(JwtAuthGuard)
    async transferLeads(@Param('id', ParseIntPipe) id: number, @Body() dto: TransferLeadsDto) {
        return this.authService.transferLeads(id, dto.to_user_id);
    }

    // Open to every member, like the list itself — a star is a shared marker, not an edit.
    @Patch('users/:id/star')
    @UseGuards(JwtAuthGuard)
    async setStarred(@Param('id', ParseIntPipe) id: number, @Body() dto: StarUserDto) {
        return this.authService.setStarred(id, dto.is_starred);
    }

    @Get('me')
    @UseGuards(JwtAuthGuard)
    async me(@UserSession() user: Requester) {
        return this.authService.me(user.userId);
    }

    @Patch('change-password')
    @UseGuards(JwtAuthGuard)
    async changePassword(@Body() dto: ChangePasswordDto, @UserSession() user: any) {
        return this.authService.changePassword(user.userId, dto);
    }

    @Patch('users/:id/block')
    @Can('staff.manage')
    @UseGuards(JwtAuthGuard)
    async setBlocked(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: BlockUserDto,
        @UserSession() user: any,
    ) {
        return this.authService.setBlocked(id, dto.blocked, user.userId);
    }

    @Patch('users/:id/role')
    @Can('roles.manage')
    @UseGuards(JwtAuthGuard)
    async setRole(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: ChangeRoleDto,
        @UserSession() user: any,
    ) {
        return this.authService.setRole(id, dto, user);
    }

    @Patch('users/:id/team')
    @Can('staff.manage')
    @UseGuards(JwtAuthGuard)
    async setTeam(@Param('id', ParseIntPipe) id: number, @Body() dto: SetTeamDto) {
        return this.authService.setTeam(id, dto.team_id);
    }

    // Names only, for pickers such as "Transfer to" — the Staff list already shows everyone.
    @Get('agents')
    @UseGuards(JwtAuthGuard)
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