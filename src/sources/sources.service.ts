import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { tenantId } from '../tenants/tenant-context.js';
import { Source } from './source.entity.js';
import { CreateSourceDto } from './create-source.dto.js';
import { UpdateSourceDto } from './update-source.dto.js';

@Injectable()
export class SourcesService {
    constructor(
        @InjectRepository(Source)
        private sourceRepository: Repository<Source>,
    ) { }

    async create(dto: CreateSourceDto) {
        const existing = await this.sourceRepository.findOne({ where: { name: dto.name, tenant_id: tenantId() } });
        if (existing) throw new BadRequestException('A source with this name already exists');

        const source = this.sourceRepository.create({ name: dto.name });
        await this.sourceRepository.save(source);
        return source;
    }

    findAll() {
        return this.sourceRepository.find({ where: { tenant_id: tenantId() }, order: { created_at: 'ASC' } });
    }

    async update(id: string, dto: UpdateSourceDto) {
        const source = await this.sourceRepository.findOne({ where: { id, tenant_id: tenantId() } });
        if (!source) throw new NotFoundException('Source not found');

        const existing = await this.sourceRepository.findOne({ where: { name: dto.name, tenant_id: tenantId() } });
        if (existing && existing.id !== id) throw new BadRequestException('A source with this name already exists');

        source.name = dto.name;
        await this.sourceRepository.save(source);
        return source;
    }

    async remove(id: string) {
        const source = await this.sourceRepository.findOne({ where: { id, tenant_id: tenantId() } });
        if (!source) throw new NotFoundException('Source not found');
        await this.sourceRepository.remove(source);
        return { status: 'Success', message: 'Source deleted' };
    }
}
