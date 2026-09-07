import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './category.entity.js';
import { CreateCategoryDto } from './create-category.dto.js';
import { UpdateCategoryDto } from './update-category.dto.js';

@Injectable()
export class CategoriesService {
    constructor(
        @InjectRepository(Category)
        private categoryRepository: Repository<Category>,
    ) { }

    async create(dto: CreateCategoryDto) {
        const existing = await this.categoryRepository.findOne({ where: { name: dto.name } });
        if (existing) throw new BadRequestException('A category with this name already exists');

        const category = this.categoryRepository.create({ name: dto.name });
        await this.categoryRepository.save(category);
        return category;
    }

    findAll() {
        return this.categoryRepository.find({ order: { name: 'ASC' } });
    }

    async update(id: string, dto: UpdateCategoryDto) {
        const category = await this.categoryRepository.findOne({ where: { id } });
        if (!category) throw new NotFoundException('Category not found');

        const existing = await this.categoryRepository.findOne({ where: { name: dto.name } });
        if (existing && existing.id !== id) throw new BadRequestException('A category with this name already exists');

        category.name = dto.name;
        await this.categoryRepository.save(category);
        return category;
    }

    async remove(id: string) {
        const category = await this.categoryRepository.findOne({ where: { id } });
        if (!category) throw new NotFoundException('Category not found');
        await this.categoryRepository.remove(category);
        return { status: 'Success', message: 'Category deleted' };
    }
}
