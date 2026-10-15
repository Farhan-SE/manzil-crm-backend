import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsInt, IsUUID } from 'class-validator';

/** Hands several leads or clients to one staff member at once. */
export class BulkAssignDto {
    @IsArray()
    @ArrayNotEmpty()
    @ArrayMaxSize(500)
    @IsUUID(undefined, { each: true })
    ids: string[];

    @Type(() => Number)
    @IsInt()
    assigned_to_id: number;
}
