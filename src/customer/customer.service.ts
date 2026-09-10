import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { Customers } from './customer.entity.js';
import { User } from '../auth/user.entity.js';
import { Source } from '../sources/source.entity.js';
import { CreateCustomerDto } from './create-customer.dto.js';
import { UpdateCustomerDto } from './update-customer.dto.js';
import { FindCustomersDto } from './find-customers.dto.js';
import { cell, parseCsvBuffer, type ImportResult } from '../common/csv.js';

type Requester = { userId: number; role: string };

const RELATION_TYPES = ['buyer', 'seller', 'investor'];

/** Accepted CSV header spellings, lowercased. Order within a list does not matter. */
const CUSTOMER_ALIASES = {
    customer_name: ['name', 'full name', 'customer', 'customer name', 'client name'],
    cnic_number: ['cnic', 'nic', 'id', 'id card'],
    contact_number: ['phone', 'number', 'mobile', 'contact', 'phone number', 'whatsapp'],
    alternate_contact_number: ['alt phone', 'alternate phone', 'phone 2', 'landline'],
    email: ['email', 'email address'],
    address: ['address', 'street'],
    city: ['city'],
    relation_type: ['type', 'customer type'],
    customer_since: ['since', 'customer since', 'date'],
    source: ['source', 'lead source'],
    notes: ['notes', 'remarks', 'comments'],
};

@Injectable()
export class CustomerService {
    constructor(
        @InjectRepository(Customers)
        private customerRepository: Repository<Customers>,
        @InjectRepository(User)
        private userRepository: Repository<User>,
        @InjectRepository(Source)
        private sourceRepository: Repository<Source>,
    ) { }

    async create(dto: CreateCustomerDto) {
        await this.assertPhoneIsFree(dto.contact_number);

        let assignedTo: User | null = null;
        if (dto.assigned_to_id) {
            assignedTo = await this.userRepository.findOne({ where: { id: dto.assigned_to_id } });
            if (!assignedTo) throw new BadRequestException('Assigning agent does not exist in the DB');
        }

        if (dto.source_id) await this.assertSourceExists(dto.source_id);

        const customer = this.customerRepository.create({
            customer_name: dto.customer_name,
            cnic_number: dto.cnic_number,
            contact_number: dto.contact_number,
            alternate_contact_number: dto.alternate_contact_number ?? null,
            email: dto.email ?? null,
            address: dto.address ?? null,
            city: dto.city ?? null,
            relation_type: dto.relation_type ?? null,
            source_id: dto.source_id ?? null,
            customer_since: dto.customer_since ? new Date(dto.customer_since) : null,
            notes: dto.notes ?? null,
            assigned_to: assignedTo,
        });
        await this.customerRepository.save(customer);
        return this.findOne(customer.id);
    }

    /** Shared like inventory — every agent sees every customer. Editing stays with the assigned agent. */
    async findAll(query: FindCustomersDto) {
        const { search, relation_type, source_id, city } = query;
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const skip = (page - 1) * limit;

        const baseFilter: Record<string, unknown> = {};
        if (relation_type) baseFilter.relation_type = relation_type;
        if (source_id) baseFilter.source_id = source_id;
        if (city) baseFilter.city = ILike(`%${city}%`);

        if (query.assigned_to_id) baseFilter.assigned_to = { id: query.assigned_to_id };

        const where = search
            ? [
                { ...baseFilter, customer_name: ILike(`%${search}%`) },
                { ...baseFilter, contact_number: ILike(`%${search}%`) },
                { ...baseFilter, cnic_number: ILike(`%${search}%`) },
                { ...baseFilter, email: ILike(`%${search}%`) },
                { ...baseFilter, city: ILike(`%${search}%`) },
            ]
            : baseFilter;

        const [data, total] = await this.customerRepository.findAndCount({
            where,
            relations: { assigned_to: true, source: true },
            order: { created_at: 'DESC' },
            skip,
            take: limit,
        });

        return { data: data.map((customer) => this.serialize(customer)), total, page, limit };
    }

    async findOne(id: string) {
        const customer = await this.customerRepository.findOne({
            where: { id },
            relations: { assigned_to: true, source: true },
        });
        if (!customer) throw new NotFoundException('Customer not found');
        return this.serialize(customer);
    }

    async update(id: string, dto: UpdateCustomerDto, requester: Requester) {
        // source is deliberately not loaded — a loaded relation would win over source_id on save.
        const customer = await this.customerRepository.findOne({
            where: { id },
            relations: { assigned_to: true },
        });
        if (!customer) throw new NotFoundException('Customer not found');

        if (requester.role !== 'admin') {
            if (customer.assigned_to?.id !== requester.userId) {
                throw new ForbiddenException('You can only edit customers assigned to you');
            }
            // Compared against the stored value so an unchanged field in the payload isn't treated as an edit.
            if (dto.assigned_to_id !== undefined && dto.assigned_to_id !== requester.userId) {
                throw new ForbiddenException('Only an admin can reassign a customer');
            }
        }

        if (dto.contact_number !== undefined && dto.contact_number !== customer.contact_number) {
            await this.assertPhoneIsFree(dto.contact_number, id);
        }

        if (dto.assigned_to_id !== undefined) {
            const assignedTo = await this.userRepository.findOne({ where: { id: dto.assigned_to_id } });
            if (!assignedTo) throw new BadRequestException('assigned_to_id does not match an existing user');
            customer.assigned_to = assignedTo;
        }

        if (dto.source_id !== undefined) {
            await this.assertSourceExists(dto.source_id);
            customer.source_id = dto.source_id;
        }

        if (dto.customer_name !== undefined) customer.customer_name = dto.customer_name;
        if (dto.cnic_number !== undefined) customer.cnic_number = dto.cnic_number;
        if (dto.contact_number !== undefined) customer.contact_number = dto.contact_number;
        if (dto.alternate_contact_number !== undefined) customer.alternate_contact_number = dto.alternate_contact_number;
        if (dto.email !== undefined) customer.email = dto.email;
        if (dto.address !== undefined) customer.address = dto.address;
        if (dto.city !== undefined) customer.city = dto.city;
        if (dto.relation_type !== undefined) customer.relation_type = dto.relation_type;
        if (dto.customer_since !== undefined) customer.customer_since = new Date(dto.customer_since);
        if (dto.notes !== undefined) customer.notes = dto.notes;

        await this.customerRepository.save(customer);
        return this.findOne(id);
    }

    async remove(id: string) {
        const customer = await this.customerRepository.findOne({ where: { id } });
        if (!customer) throw new NotFoundException('Customer not found');
        await this.customerRepository.remove(customer);
    }

    async importCsv(buffer: Buffer): Promise<ImportResult> {
        const rows = parseCsvBuffer(buffer);
        const sources = await this.sourceRepository.find();
        const sourceIdByName = new Map(sources.map((s) => [s.name.toLowerCase(), s.id]));

        const result: ImportResult = { total: rows.length, added: 0, skipped: 0, errors: [] };

        for (const [index, row] of rows.entries()) {
            // +2 so the number matches the spreadsheet line the user sees (1 = header).
            const rowNumber = index + 2;
            const name = cell(row, CUSTOMER_ALIASES.customer_name);
            const phone = cell(row, CUSTOMER_ALIASES.contact_number);

            if (!name || !phone) {
                result.skipped += 1;
                result.errors.push({ row: rowNumber, reason: 'Missing name or phone' });
                continue;
            }

            const digits = phone.replace(/\D/g, '');
            const duplicate = await this.customerRepository
                .createQueryBuilder('customer')
                .where("regexp_replace(customer.contact_number, '\\D', '', 'g') = :digits", { digits })
                .getOne();
            if (duplicate) {
                result.skipped += 1;
                result.errors.push({ row: rowNumber, reason: `Duplicate phone ${phone}` });
                continue;
            }

            const rawType = cell(row, CUSTOMER_ALIASES.relation_type).toLowerCase();
            const sourceName = cell(row, CUSTOMER_ALIASES.source).toLowerCase();
            const since = cell(row, CUSTOMER_ALIASES.customer_since);

            const customer = this.customerRepository.create({
                customer_name: name,
                cnic_number: cell(row, CUSTOMER_ALIASES.cnic_number),
                contact_number: phone,
                alternate_contact_number: cell(row, CUSTOMER_ALIASES.alternate_contact_number) || null,
                email: cell(row, CUSTOMER_ALIASES.email) || null,
                address: cell(row, CUSTOMER_ALIASES.address) || null,
                city: cell(row, CUSTOMER_ALIASES.city) || null,
                relation_type: RELATION_TYPES.includes(rawType) ? rawType : 'buyer',
                source_id: sourceIdByName.get(sourceName) ?? null,
                customer_since: since && !Number.isNaN(Date.parse(since)) ? new Date(since) : null,
                notes: cell(row, CUSTOMER_ALIASES.notes) || null,
                assigned_to: null,
            });

            await this.customerRepository.save(customer);
            result.added += 1;
        }

        return result;
    }

    private async assertSourceExists(id: string) {
        const source = await this.sourceRepository.findOne({ where: { id } });
        if (!source) throw new BadRequestException('source_id does not match an existing source');
    }

    /** Phone is the duplicate key — compared on digits only, so 0300-1234567 and 03001234567 collide. */
    private async assertPhoneIsFree(phone: string, excludeId?: string) {
        const digits = phone.replace(/\D/g, '');
        if (!digits) return;

        const qb = this.customerRepository
            .createQueryBuilder('customer')
            .where("regexp_replace(customer.contact_number, '\\D', '', 'g') = :digits", { digits });
        if (excludeId) qb.andWhere('customer.id != :excludeId', { excludeId });

        const existing = await qb.getOne();
        if (existing) throw new ConflictException('A customer with this phone number already exists');
    }

    private serialize(customer: Customers) {
        return {
            id: customer.id,
            customer_name: customer.customer_name,
            cnic_number: customer.cnic_number,
            contact_number: customer.contact_number,
            alternate_contact_number: customer.alternate_contact_number,
            email: customer.email,
            address: customer.address,
            city: customer.city,
            relation_type: customer.relation_type,
            source_id: customer.source_id,
            source: customer.source ? { id: customer.source.id, name: customer.source.name } : null,
            customer_since: customer.customer_since,
            notes: customer.notes,
            assigned_to: customer.assigned_to
                ? {
                    id: customer.assigned_to.id,
                    first_name: customer.assigned_to.first_name,
                    last_name: customer.assigned_to.last_name,
                }
                : null,
            created_at: customer.created_at,
            updated_at: customer.updated_at,
        };
    }
}
