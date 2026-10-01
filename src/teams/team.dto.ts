import { IsArray, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class TeamDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    /** When present, the team ends up with exactly these members. Omitted leaves membership alone. */
    @IsOptional()
    @IsArray()
    @IsInt({ each: true })
    member_ids?: number[];
}
