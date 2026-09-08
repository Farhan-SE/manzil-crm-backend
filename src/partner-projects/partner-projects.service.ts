import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PartnerProject } from './partner-project.entity.js';
import { User } from '../auth/user.entity.js';
import { CreatePartnerProjectDto } from './create-partner-project.dto.js';
import { UpdatePartnerProjectDto } from './update-partner-project.dto.js';
import { FindPartnerProjectsDto } from './find-partner-projects.dto.js';

@Injectable()
export class PartnerProjectsService {
    constructor(
        @InjectRepository(PartnerProject)
        private projectRepository: Repository<PartnerProject>,
    ) { }

    async create(dto: CreatePartnerProjectDto, createdById: number) {
        const project = this.projectRepository.create({
            project_name: dto.project_name,
            developer: dto.developer ?? null,
            category_id: dto.category_id ?? null,
            interest_id: dto.interest_id ?? null,
            city: dto.city ?? null,
            location: dto.location ?? null,
            price: dto.price != null ? String(dto.price) : null,
            description: dto.description ?? null,
            created_by: { id: createdById } as User,
        });
        await this.projectRepository.save(project);
        return this.findOne(project.id);
    }

    async findAll(query: FindPartnerProjectsDto) {
        const qb = this.projectRepository
            .createQueryBuilder('project')
            .orderBy('project.created_at', 'DESC');

        if (query.search) {
            qb.andWhere(
                '(project.project_name ILIKE :search OR project.developer ILIKE :search OR project.city ILIKE :search OR project.location ILIKE :search)',
                { search: `%${query.search}%` },
            );
        }
        if (query.category_id) qb.andWhere('project.category_id = :categoryId', { categoryId: query.category_id });
        if (query.interest_id) qb.andWhere('project.interest_id = :interestId', { interestId: query.interest_id });
        if (query.city) qb.andWhere('project.city ILIKE :city', { city: `%${query.city}%` });
        if (query.price_min != null) qb.andWhere('project.price >= :priceMin', { priceMin: query.price_min });
        if (query.price_max != null) qb.andWhere('project.price <= :priceMax', { priceMax: query.price_max });

        qb.take(query.limit ?? 100);

        const projects = await qb.getMany();
        return projects.map((project) => this.serialize(project));
    }

    async findOne(id: string) {
        const project = await this.projectRepository.findOne({ where: { id } });
        if (!project) throw new NotFoundException('Partner project not found');
        return this.serialize(project);
    }

    async update(id: string, dto: UpdatePartnerProjectDto) {
        const project = await this.projectRepository.findOne({ where: { id } });
        if (!project) throw new NotFoundException('Partner project not found');

        if (dto.project_name !== undefined) project.project_name = dto.project_name;
        if (dto.developer !== undefined) project.developer = dto.developer;
        if (dto.category_id !== undefined) project.category_id = dto.category_id;
        if (dto.interest_id !== undefined) project.interest_id = dto.interest_id;
        if (dto.city !== undefined) project.city = dto.city;
        if (dto.location !== undefined) project.location = dto.location;
        if (dto.price !== undefined) project.price = String(dto.price);
        if (dto.description !== undefined) project.description = dto.description;

        await this.projectRepository.save(project);
        return this.findOne(id);
    }

    async remove(id: string) {
        const project = await this.projectRepository.findOne({ where: { id } });
        if (!project) throw new NotFoundException('Partner project not found');
        await this.projectRepository.remove(project);
    }

    private serialize(project: PartnerProject) {
        return {
            id: project.id,
            project_name: project.project_name,
            developer: project.developer,
            category_id: project.category_id,
            interest_id: project.interest_id,
            city: project.city,
            location: project.location,
            price: project.price != null ? Number(project.price) : null,
            description: project.description,
            created_at: project.created_at,
            updated_at: project.updated_at,
        };
    }
}
