import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { MEDIA_TYPES } from './media-files.js';

export class StartMediaUploadDto {
    @IsOptional()
    @IsUUID()
    project_id?: string;

    @IsOptional()
    @IsUUID()
    unit_id?: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(200)
    file_name: string;

    @IsIn(Object.keys(MEDIA_TYPES), { message: 'Only JPG, PNG and WebP photos and MP4 or MOV videos can be uploaded' })
    mime: string;

    @Type(() => Number)
    @IsInt()
    @Min(1)
    size_bytes: number;
}

export class FindMediaDto {
    @IsOptional()
    @IsUUID()
    project_id?: string;

    @IsOptional()
    @IsUUID()
    unit_id?: string;
}
