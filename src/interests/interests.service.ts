import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Interest } from './interest.entity.js';
import { CreateInterestDto } from './create-interest.dto.js';
import { UpdateInterestDto } from './update-interest.dto.js';

@Injectable()
export class InterestsService {
    constructor(
        @InjectRepository(Interest)
        private interestRepository: Repository<Interest>,
    ) { }

    async create(dto: CreateInterestDto) {
        const existing = await this.interestRepository.findOne({ where: { name: dto.name } });
        if (existing) throw new BadRequestException('An interest with this name already exists');

        const interest = this.interestRepository.create({ name: dto.name });
        await this.interestRepository.save(interest);
        return interest;
    }

    findAll() {
        return this.interestRepository.find({ order: { created_at: 'ASC' } });
    }

    async update(id: string, dto: UpdateInterestDto) {
        const interest = await this.interestRepository.findOne({ where: { id } });
        if (!interest) throw new NotFoundException('Interest not found');

        const existing = await this.interestRepository.findOne({ where: { name: dto.name } });
        if (existing && existing.id !== id) throw new BadRequestException('An interest with this name already exists');

        interest.name = dto.name;
        await this.interestRepository.save(interest);
        return interest;
    }

    async remove(id: string) {
        const interest = await this.interestRepository.findOne({ where: { id } });
        if (!interest) throw new NotFoundException('Interest not found');
        await this.interestRepository.remove(interest);
        return { status: 'Success', message: 'Interest deleted' };
    }
}
