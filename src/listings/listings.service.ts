import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Listing } from './listing.entity.js';
import { User } from '../auth/user.entity.js';
import { CreateListingDto } from './create-listing.dto.js';
import { UpdateListingDto } from './update-listing.dto.js';
import { FindListingsDto } from './find-listings.dto.js';
import { Category } from '../categories/category.entity.js';
import { Interest } from '../interests/interest.entity.js';
import { tenantId } from '../tenants/tenant-context.js';
import { can, type Requester } from '../access/access.js';
import { assertOwned } from '../tenants/tenant-scope.js';


@Injectable()
export class ListingsService {
    constructor(
        @InjectRepository(Listing)
        private listingRepository: Repository<Listing>,
        @InjectRepository(User)
        private userRepository: Repository<User>,
    ) { }

    async create(dto: CreateListingDto, createdById: number, requester: Requester) {
        let assignedTo: User | null = null;
        if (dto.assigned_to_id) {
            assignedTo = await this.userRepository.findOne({ where: { id: dto.assigned_to_id, tenant_id: tenantId() } });
            if (!assignedTo) throw new BadRequestException('Assigning agent does not exist in the DB');
        }
        await this.assertLookupsOwned(dto);

        const listing = this.listingRepository.create({
            area_name: dto.area_name,
            client_name: dto.client_name,
            client_number: dto.client_number,
            category_id: dto.category_id ?? null,
            interest_id: dto.interest_id ?? null,
            city: dto.city ?? null,
            location: dto.location ?? null,
            price: dto.price != null ? String(dto.price) : null,
            description: dto.description ?? null,
            assigned_to: assignedTo,
            created_by: { id: createdById } as User,
        });
        await this.listingRepository.save(listing);
        return this.findOne(listing.id, requester);
    }

    /**
     * Inventory is shared on purpose — every agent sees every listing so they can match a
     * buyer to it. Only the seller's contact is withheld, in serialize() below.
     */
    async findAll(query: FindListingsDto, requester: Requester) {
        const qb = this.listingRepository
            .createQueryBuilder('listing')
            .leftJoinAndSelect('listing.assigned_to', 'assignedTo')
            .where('listing.tenant_id = :tenantId', { tenantId: tenantId() })
            .orderBy('listing.created_at', 'DESC');

        if (query.search) {
            // Deliberately excludes client_name: searching it would leak the hidden contact.
            qb.andWhere(
                '(listing.area_name ILIKE :search OR listing.city ILIKE :search OR listing.location ILIKE :search)',
                { search: `%${query.search}%` },
            );
        }
        if (query.category_id) qb.andWhere('listing.category_id = :categoryId', { categoryId: query.category_id });
        if (query.interest_id) qb.andWhere('listing.interest_id = :interestId', { interestId: query.interest_id });
        if (query.city) qb.andWhere('listing.city ILIKE :city', { city: `%${query.city}%` });
        if (query.assigned_to_id) qb.andWhere('assignedTo.id = :assignedToId', { assignedToId: query.assigned_to_id });
        if (query.price_min != null) qb.andWhere('listing.price >= :priceMin', { priceMin: query.price_min });
        if (query.price_max != null) qb.andWhere('listing.price <= :priceMax', { priceMax: query.price_max });

        qb.take(query.limit ?? 100);

        const listings = await qb.getMany();
        return listings.map((listing) => this.serialize(listing, requester));
    }

    async findOne(id: string, requester: Requester) {
        const listing = await this.listingRepository.findOne({
            where: { id, tenant_id: tenantId() },
            relations: { assigned_to: true },
        });
        if (!listing) throw new NotFoundException('Listing not found');
        return this.serialize(listing, requester);
    }

    async update(id: string, dto: UpdateListingDto, requester: Requester) {
        const listing = await this.listingRepository.findOne({
            where: { id, tenant_id: tenantId() },
            relations: { assigned_to: true },
        });
        if (!listing) throw new NotFoundException('Listing not found');

        if (!can(requester, 'inventory.manage')) {
            if (listing.assigned_to?.id !== requester.userId) {
                throw new ForbiddenException('You can only edit listings assigned to you');
            }
            if (dto.assigned_to_id !== undefined && dto.assigned_to_id !== requester.userId) {
                throw new ForbiddenException('Your role cannot reassign listings');
            }
        }

        await this.assertLookupsOwned(dto);
        if (dto.assigned_to_id !== undefined) {
            const assignedTo = await this.userRepository.findOne({ where: { id: dto.assigned_to_id, tenant_id: tenantId() } });
            if (!assignedTo) throw new BadRequestException('assigned_to_id does not match an existing user');
            listing.assigned_to = assignedTo;
        }

        if (dto.area_name !== undefined) listing.area_name = dto.area_name;
        if (dto.client_name !== undefined) listing.client_name = dto.client_name;
        if (dto.client_number !== undefined) listing.client_number = dto.client_number;
        if (dto.category_id !== undefined) listing.category_id = dto.category_id;
        if (dto.interest_id !== undefined) listing.interest_id = dto.interest_id;
        if (dto.city !== undefined) listing.city = dto.city;
        if (dto.location !== undefined) listing.location = dto.location;
        if (dto.price !== undefined) listing.price = String(dto.price);
        if (dto.description !== undefined) listing.description = dto.description;

        await this.listingRepository.save(listing);
        return this.findOne(id, requester);
    }

    async remove(id: string) {
        const listing = await this.listingRepository.findOne({ where: { id, tenant_id: tenantId() } });
        if (!listing) throw new NotFoundException('Listing not found');
        await this.listingRepository.remove(listing);
    }

    private async assertLookupsOwned(dto: { category_id?: string | null; interest_id?: string | null }) {
        await assertOwned(this.listingRepository.manager, Category, dto.category_id, 'category_id');
        await assertOwned(this.listingRepository.manager, Interest, dto.interest_id, 'interest_id');
    }

    private serialize(listing: Listing, requester: Requester) {
        const canSeeContact =
            can(requester, 'inventory.manage') || listing.assigned_to?.id === requester.userId;

        return {
            id: listing.id,
            area_name: listing.area_name,
            category_id: listing.category_id,
            interest_id: listing.interest_id,
            city: listing.city,
            location: listing.location,
            price: listing.price != null ? Number(listing.price) : null,
            description: listing.description,
            // The seller's details belong to inventory managers and the agent working the listing.
            can_see_contact: canSeeContact,
            client_name: canSeeContact ? listing.client_name : null,
            client_number: canSeeContact ? listing.client_number : null,
            assigned_to: listing.assigned_to
                ? {
                    id: listing.assigned_to.id,
                    first_name: listing.assigned_to.first_name,
                    last_name: listing.assigned_to.last_name,
                }
                : null,
            created_at: listing.created_at,
            updated_at: listing.updated_at,
        };
    }
}
