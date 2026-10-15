import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Tenant } from './tenant.entity.js';
import { CreateTenantDto, FindTenantsDto, UpdateTenantDto } from './tenant.dto.js';
import { DEFAULT_CATEGORIES, DEFAULT_INTERESTS, DEFAULT_SOURCES } from './tenant-defaults.js';
import { User } from '../auth/user.entity.js';
import { Category } from '../categories/category.entity.js';
import { Interest } from '../interests/interest.entity.js';
import { Source } from '../sources/source.entity.js';
import { generatePassword } from '../common/password.js';
import { seedRoles } from '../access/roles.service.js';

export type UploadedLogo = { buffer: Buffer; mimetype: string; size: number };

/** Raster formats only: an SVG can carry script, and the logo is served from the API's own origin. */
const LOGO_SIGNATURES: { mime: string; matches: (b: Buffer) => boolean }[] = [
    { mime: 'image/png', matches: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
    { mime: 'image/jpeg', matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
    { mime: 'image/webp', matches: (b) => b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP' },
];

/** Where a company's logo is served, versioned so browsers drop the old one after an upload. */
export function logoUrl(tenant: Pick<Tenant, 'id' | 'logo_updated_at'>) {
    return tenant.logo_updated_at ? `/companies/${tenant.id}/logo?v=${tenant.logo_updated_at.getTime()}` : null;
}

type TenantUsage = { user_count: string; active_user_count: string; lead_count: string; customer_count: string; last_activity_at: Date | null };

function slugify(name: string) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'company';
}

/** The platform side: companies are only ever created and managed here, by a super admin. */
@Injectable()
export class TenantsService {
    constructor(
        @InjectRepository(Tenant)
        private tenantRepository: Repository<Tenant>,
    ) { }

    async findAll(query: FindTenantsDto) {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;

        const qb = this.tenantRepository.createQueryBuilder('tenant');
        if (query.status) qb.andWhere('tenant.status = :status', { status: query.status });
        if (query.search) {
            qb.andWhere('(tenant.name ILIKE :search OR tenant.slug ILIKE :search)', { search: `%${query.search}%` });
        }

        const [tenants, total] = await qb
            .orderBy('tenant.created_at', 'DESC')
            .skip((page - 1) * limit)
            .take(limit)
            .getManyAndCount();

        const usage = await this.usage(tenants.map((tenant) => tenant.id));
        const admins = await this.firstAdmins(tenants.map((tenant) => tenant.id));
        return {
            data: tenants.map((tenant) => this.serialize(tenant, usage.get(tenant.id), admins.get(tenant.id))),
            total,
            page,
            limit,
        };
    }

    async findOne(id: string) {
        const tenant = await this.tenantRepository.findOne({ where: { id } });
        if (!tenant) throw new NotFoundException('Company not found');
        const [usage, admins] = await Promise.all([this.usage([id]), this.firstAdmins([id])]);
        return this.serialize(tenant, usage.get(id), admins.get(id));
    }

    /** Opens a company with its first admin and starter pick lists. The admin's password is shown once. */
    async create(dto: CreateTenantDto) {
        const email = dto.admin_email.trim();
        const manager = this.tenantRepository.manager;
        if (await manager.exists(User, { where: { email } })) {
            throw new ConflictException('A user with this email already exists');
        }

        const slug = dto.slug ?? (await this.freeSlug(slugify(dto.name)));
        if (dto.slug && (await this.tenantRepository.exists({ where: { slug } }))) {
            throw new ConflictException('A company with this slug already exists');
        }

        const password = generatePassword();
        const hashed = await bcrypt.hash(password, 10);

        const { tenant, admin } = await manager.transaction(async (tx) => {
            const tenant = await tx.save(tx.create(Tenant, { name: dto.name.trim(), slug }));
            const roles = await seedRoles(tx, tenant.id);
            const admin = await tx.save(
                tx.create(User, {
                    tenant_id: tenant.id,
                    first_name: dto.admin_first_name.trim(),
                    last_name: dto.admin_last_name.trim(),
                    email,
                    password: hashed,
                    user_role: 'admin',
                    role_id: roles.admin.id,
                }),
            );
            await tx.save(DEFAULT_INTERESTS.map((name) => tx.create(Interest, { tenant_id: tenant.id, name })));
            await tx.save(DEFAULT_CATEGORIES.map((name) => tx.create(Category, { tenant_id: tenant.id, name })));
            await tx.save(DEFAULT_SOURCES.map((name) => tx.create(Source, { tenant_id: tenant.id, name })));
            return { tenant, admin };
        });

        return {
            company: await this.findOne(tenant.id),
            admin: { id: admin.id, first_name: admin.first_name, last_name: admin.last_name, email: admin.email },
            password,
        };
    }

    /** Renames a company, or suspends it: its staff are signed out and can't sign back in until it is reactivated. */
    async update(id: string, dto: UpdateTenantDto) {
        const tenant = await this.tenantRepository.findOne({ where: { id } });
        if (!tenant) throw new NotFoundException('Company not found');
        if (dto.name === undefined && dto.status === undefined) throw new BadRequestException('Nothing to update');

        if (dto.name !== undefined) tenant.name = dto.name.trim();
        if (dto.status !== undefined) tenant.status = dto.status;
        await this.tenantRepository.save(tenant);
        return this.findOne(id);
    }

    /** Replaces the company's logo. The type comes from the file's own bytes, not what the browser claimed. */
    async setLogo(id: string, file: UploadedLogo | undefined) {
        if (!file) throw new BadRequestException('Choose a logo file');
        const type = LOGO_SIGNATURES.find((signature) => signature.matches(file.buffer));
        if (!type) throw new BadRequestException('The logo must be a PNG, JPG or WebP image');
        const result = await this.tenantRepository.update({ id }, { logo: file.buffer, logo_mime: type.mime, logo_updated_at: new Date() });
        if (!result.affected) throw new NotFoundException('Company not found');
        return this.findOne(id);
    }

    async removeLogo(id: string) {
        const result = await this.tenantRepository.update({ id }, { logo: null, logo_mime: null, logo_updated_at: null });
        if (!result.affected) throw new NotFoundException('Company not found');
        return this.findOne(id);
    }

    async getLogo(id: string) {
        const tenant = await this.tenantRepository
            .createQueryBuilder('tenant')
            .addSelect('tenant.logo')
            .where('tenant.id = :id', { id })
            .getOne();
        if (!tenant?.logo || !tenant.logo_mime) throw new NotFoundException('This company has no logo');
        return { data: tenant.logo, mime: tenant.logo_mime };
    }

    private async freeSlug(base: string) {
        const taken = new Set(
            (
                await this.tenantRepository
                    .createQueryBuilder('tenant')
                    .select('tenant.slug', 'slug')
                    .where('tenant.slug = :base OR tenant.slug LIKE :pattern', { base, pattern: `${base}-%` })
                    .getRawMany<{ slug: string }>()
            ).map((row) => row.slug),
        );
        if (!taken.has(base)) return base;
        let n = 2;
        while (taken.has(`${base}-${n}`)) n += 1;
        return `${base}-${n}`;
    }

    /** Head counts and record counts per company, for the companies list. */
    private async usage(tenantIds: string[]) {
        const usage = new Map<string, TenantUsage>();
        if (tenantIds.length === 0) return usage;

        const rows: (TenantUsage & { tenant_id: string })[] = await this.tenantRepository.query(
            `SELECT t.id AS tenant_id,
                    (SELECT COUNT(*) FROM "user" u WHERE u.tenant_id = t.id) AS user_count,
                    (SELECT COUNT(*) FROM "user" u WHERE u.tenant_id = t.id AND NOT u.blocked AND NOT u.suspended) AS active_user_count,
                    (SELECT COUNT(*) FROM "lead" l WHERE l.tenant_id = t.id) AS lead_count,
                    (SELECT COUNT(*) FROM "customers" c WHERE c.tenant_id = t.id) AS customer_count,
                    (SELECT MAX(l.updated_at) FROM "lead" l WHERE l.tenant_id = t.id) AS last_activity_at
             FROM "tenant" t
             WHERE t.id = ANY($1::uuid[])`,
            [tenantIds],
        );
        for (const row of rows) usage.set(row.tenant_id, row);
        return usage;
    }

    /** The longest-standing admin of each company — who the platform contacts about it. */
    private async firstAdmins(tenantIds: string[]) {
        const admins = new Map<string, Pick<User, 'id' | 'first_name' | 'last_name' | 'email'>>();
        if (tenantIds.length === 0) return admins;

        const rows: { tenant_id: string; id: number; first_name: string; last_name: string; email: string }[] =
            await this.tenantRepository.query(
                `SELECT DISTINCT ON (u.tenant_id) u.tenant_id, u.id, u.first_name, u.last_name, u.email
                 FROM "user" u
                 WHERE u.tenant_id = ANY($1::uuid[]) AND u.user_role = 'admin'
                 ORDER BY u.tenant_id, u.created_at, u.id`,
                [tenantIds],
            );
        for (const { tenant_id, ...admin } of rows) admins.set(tenant_id, admin);
        return admins;
    }

    private serialize(tenant: Tenant, usage?: TenantUsage, admin?: Pick<User, 'id' | 'first_name' | 'last_name' | 'email'>) {
        return {
            id: tenant.id,
            name: tenant.name,
            slug: tenant.slug,
            status: tenant.status,
            logo_url: logoUrl(tenant),
            admin: admin ?? null,
            user_count: Number(usage?.user_count ?? 0),
            active_user_count: Number(usage?.active_user_count ?? 0),
            lead_count: Number(usage?.lead_count ?? 0),
            customer_count: Number(usage?.customer_count ?? 0),
            last_activity_at: usage?.last_activity_at ?? null,
            created_at: tenant.created_at,
            updated_at: tenant.updated_at,
        };
    }
}
