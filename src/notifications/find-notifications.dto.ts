import { IsIn, IsOptional } from 'class-validator';

export class FindNotificationsDto {
    @IsOptional()
    @IsIn(['true', 'false'])
    unread?: string;
}
