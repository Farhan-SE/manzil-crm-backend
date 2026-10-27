import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { PartnerProject } from '../partner-projects/partner-project.entity.js';
import { tenantId } from '../tenants/tenant-context.js';
import { Unit } from '../units/unit.entity.js';
import { deleteMediaFile, inspectUpload, MEDIA_TYPES, mediaViewUrl, presignMediaUpload, sniffMime } from './media-files.js';
import { InventoryMedia } from './media.entity.js';
import type { FindMediaDto, StartMediaUploadDto } from './media.dto.js';

const MAX_PER_OWNER = 30;

const megabytes = (bytes: number) => `${Math.round(bytes / 1024 / 1024)} MB`;

@Injectable()
export class MediaService {
    private readonly logger = new Logger(MediaService.name);

    constructor(
        @InjectRepository(InventoryMedia) private readonly media: Repository<InventoryMedia>,
        @InjectRepository(Unit) private readonly units: Repository<Unit>,
        @InjectRepository(PartnerProject) private readonly projects: Repository<PartnerProject>,
    ) { }

    /** Records the file and returns a form the browser posts it to, straight to S3. */
    async startUpload(dto: StartMediaUploadDto, userId: number) {
        const owner = await this.owner(dto);
        const type = MEDIA_TYPES[dto.mime];
        if (dto.size_bytes > type.maxBytes) {
            throw new BadRequestException(`${dto.file_name} is too large — the limit is ${megabytes(type.maxBytes)} for a ${type.kind}`);
        }
        const count = await this.media.count({ where: owner });
        if (count >= MAX_PER_OWNER) {
            throw new BadRequestException(`A ${dto.unit_id ? 'unit' : 'project'} can have up to ${MAX_PER_OWNER} photos and videos`);
        }

        const row = await this.media.save(this.media.create({
            ...owner,
            kind: type.kind,
            mime: dto.mime,
            size_bytes: dto.size_bytes,
            file_key: `media/${tenantId()}/${randomUUID()}.${type.ext}`,
            file_name: dto.file_name.trim(),
            created_by_id: userId,
        }));
        return { media: { id: row.id }, upload: await presignMediaUpload(row.file_key, row.mime, type.maxBytes) };
    }

    /** Checks the uploaded bytes really are the photo or video that was declared before showing it anywhere. */
    async completeUpload(id: string) {
        const row = await this.media.findOne({ where: { id, tenant_id: tenantId() } });
        if (!row) throw new NotFoundException('Upload not found');
        if (row.status === 'ready') return this.serialize(row);

        const upload = await inspectUpload(row.file_key);
        if (!upload) throw new BadRequestException(`${row.file_name} hasn't finished uploading`);
        const actual = sniffMime(upload.head);
        if (!actual || MEDIA_TYPES[actual].kind !== row.kind || upload.size > MEDIA_TYPES[row.mime].maxBytes) {
            await this.discard(row);
            throw new BadRequestException(`${row.file_name} isn't a JPG, PNG, WebP, MP4 or MOV file`);
        }
        const ready = { ...row, status: 'ready' as const, size_bytes: upload.size, mime: actual };
        await this.media.update({ id }, { status: ready.status, size_bytes: ready.size_bytes, mime: ready.mime });
        return this.serialize(ready);
    }

    async list(dto: FindMediaDto) {
        const rows = await this.media.find({ where: { ...(await this.owner(dto)), status: 'ready' }, order: { created_at: 'ASC' } });
        return Promise.all(rows.map((row) => this.serialize(row)));
    }

    async remove(id: string) {
        const row = await this.media.findOne({ where: { id, tenant_id: tenantId() } });
        if (!row) throw new NotFoundException('Photo or video not found');
        await this.discard(row);
        return { status: 'deleted' };
    }

    /** A unit's own photos and videos first, then its project's. */
    async forUnit(tenant: string, unitId: string, projectId: string) {
        const rows = await this.media.find({
            where: [
                { tenant_id: tenant, unit_id: unitId, status: 'ready' },
                { tenant_id: tenant, project_id: projectId, status: 'ready' },
            ],
            order: { created_at: 'ASC' },
        });
        return [...rows.filter((r) => r.unit_id), ...rows.filter((r) => r.project_id)];
    }

    async unitHasMedia(tenant: string, unitId: string) {
        const unit = await this.units.findOne({ where: { id: unitId, tenant_id: tenant }, select: { id: true, project_id: true } });
        if (!unit) return false;
        return ((await this.countForUnits(tenant, [{ id: unit.id, projectId: unit.project_id }])).get(unit.id) ?? 0) > 0;
    }

    /** How many photos and videos each unit can show, counting its project's. */
    async countForUnits(tenant: string, units: { id: string; projectId: string }[]) {
        const counts = new Map<string, number>();
        if (!units.length) return counts;
        const rows = await this.media.find({
            where: [
                { tenant_id: tenant, unit_id: In(units.map((u) => u.id)), status: 'ready' },
                { tenant_id: tenant, project_id: In(units.map((u) => u.projectId)), status: 'ready' },
            ],
            select: { unit_id: true, project_id: true },
        });
        for (const unit of units) {
            counts.set(unit.id, rows.filter((r) => r.unit_id === unit.id || r.project_id === unit.projectId).length);
        }
        return counts;
    }

    async serialize(row: InventoryMedia) {
        return {
            id: row.id,
            kind: row.kind,
            mime: row.mime,
            file_name: row.file_name,
            size_bytes: row.size_bytes,
            url: await mediaViewUrl(row.file_key),
        };
    }

    private async owner(dto: { project_id?: string; unit_id?: string }) {
        if (Boolean(dto.project_id) === Boolean(dto.unit_id)) throw new BadRequestException('Give either project_id or unit_id');
        const tenant = tenantId();
        if (dto.unit_id) {
            if (!(await this.units.exists({ where: { id: dto.unit_id, tenant_id: tenant } }))) throw new NotFoundException('Unit not found');
            return { tenant_id: tenant, unit_id: dto.unit_id };
        }
        if (!(await this.projects.exists({ where: { id: dto.project_id, tenant_id: tenant } }))) throw new NotFoundException('Project not found');
        return { tenant_id: tenant, project_id: dto.project_id! };
    }

    private async discard(row: InventoryMedia) {
        await deleteMediaFile(row.file_key).catch((error) => this.logger.warn(`Couldn't delete ${row.file_key}: ${(error as Error).message}`));
        await this.media.delete({ id: row.id });
    }
}
