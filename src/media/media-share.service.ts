import { createHash, randomBytes } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { Tenant } from '../tenants/tenant.entity.js';
import { logoUrl } from '../tenants/tenants.service.js';
import { tenantId } from '../tenants/tenant-context.js';
import { Unit } from '../units/unit.entity.js';
import { MediaShare } from './media-share.entity.js';
import { MediaService } from './media.service.js';

const LINK_LIFETIME_MS = 2 * 24 * 60 * 60 * 1000;
const TOKEN_FORMAT = /^[A-Za-z0-9_-]{43}$/;

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export function shareUrl(token: string) {
    const base = (process.env.FRONTEND_URL ?? '').replace(/\/$/, '');
    if (!base) throw new Error('FRONTEND_URL is not set');
    return `${base}/view/${token}`;
}

@Injectable()
export class MediaShareService {
    constructor(
        @InjectRepository(MediaShare) private readonly shares: Repository<MediaShare>,
        @InjectRepository(Unit) private readonly units: Repository<Unit>,
        @InjectRepository(Tenant) private readonly tenants: Repository<Tenant>,
        private readonly media: MediaService,
    ) { }

    /** A new link to one unit's photos and videos. Only the token's hash is kept, so the link can't be rebuilt from the database. */
    async create(tenant: string, unitId: string, leadId: string | null) {
        const token = randomBytes(32).toString('base64url');
        const share = await this.shares.save(this.shares.create({
            tenant_id: tenant,
            unit_id: unitId,
            lead_id: leadId,
            token_hash: hashToken(token),
            expires_at: new Date(Date.now() + LINK_LIFETIME_MS),
        }));
        return { url: shareUrl(token), expires_at: share.expires_at };
    }

    /** What the public page shows. An unknown, expired or revoked token gets the same answer, so nothing can be learned from it. */
    async view(token: string) {
        const invalid = new NotFoundException('This link has expired or is not valid');
        if (!TOKEN_FORMAT.test(token)) throw invalid;
        const share = await this.shares.findOne({
            where: { token_hash: hashToken(token), revoked_at: IsNull(), expires_at: MoreThan(new Date()) },
        });
        if (!share) throw invalid;
        const unit = await this.units.findOne({ where: { id: share.unit_id, tenant_id: share.tenant_id }, relations: { project: true } });
        if (!unit) throw invalid;

        await this.shares.update({ id: share.id }, { open_count: () => 'open_count + 1', last_opened_at: new Date() });
        const [company, files] = await Promise.all([
            this.tenants.findOne({ where: { id: share.tenant_id }, select: { id: true, name: true, logo_updated_at: true } }),
            this.media.forUnit(share.tenant_id, unit.id, unit.project_id),
        ]);
        return {
            company: company ? { name: company.name, logo_url: logoUrl(company) } : null,
            project: unit.project.project_name,
            location: [unit.project.location, unit.project.city].filter(Boolean).join(', ') || null,
            unit: {
                unit_number: unit.unit_number,
                unit_type: unit.unit_type,
                floor: unit.floor,
                beds: unit.beds,
                area_sqft: unit.area_sqft != null ? Number(unit.area_sqft) : null,
                price: unit.price != null ? Number(unit.price) : null,
                features: unit.features,
            },
            media: await Promise.all(files.map((file) => this.media.serialize(file))),
            expires_at: share.expires_at,
        };
    }

    listForLead(leadId: string) {
        return this.shares.find({
            where: { tenant_id: tenantId(), lead_id: leadId },
            order: { created_at: 'DESC' },
        });
    }

    async revoke(id: string) {
        const result = await this.shares.update({ id, tenant_id: tenantId(), revoked_at: IsNull() }, { revoked_at: new Date() });
        if (!result.affected) throw new NotFoundException('Link not found or already turned off');
        return { status: 'revoked' };
    }
}
