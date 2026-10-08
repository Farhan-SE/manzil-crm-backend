import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
    HELP_TOPICS,
    HelpArticle,
    HelpArticleFeedback,
    SupportTicket,
    SupportTicketAttachment,
} from './help.entity.js';
import { CreateSupportTicketDto, FindHelpDto } from './help.dto.js';

/** Only the fields we read off a multer upload — @types/multer v2 no longer augments Express. */
export type UploadedAttachment = { buffer: Buffer; originalname: string; mimetype: string; size: number };

const ATTACHMENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

@Injectable()
export class HelpService {
    constructor(
        @InjectRepository(HelpArticle)
        private articleRepository: Repository<HelpArticle>,
        @InjectRepository(HelpArticleFeedback)
        private feedbackRepository: Repository<HelpArticleFeedback>,
        @InjectRepository(SupportTicket)
        private ticketRepository: Repository<SupportTicket>,
        @InjectRepository(SupportTicketAttachment)
        private attachmentRepository: Repository<SupportTicketAttachment>,
    ) { }

    /** The Help Center landing data. `results` is only filled when a search or topic is asked for. */
    async overview(query: FindHelpDto) {
        const [counts, featured, results] = await Promise.all([
            this.articleRepository
                .createQueryBuilder('article')
                .select('article.topic', 'topic')
                .addSelect('COUNT(*)', 'count')
                .groupBy('article.topic')
                .getRawMany<{ topic: string; count: string }>(),
            this.articleRepository.find({ where: { is_featured: true }, order: { read_minutes: 'ASC' } }),
            query.search || query.topic ? this.search(query) : null,
        ]);

        return {
            topics: HELP_TOPICS.map((topic) => ({
                id: topic,
                article_count: Number(counts.find((row) => row.topic === topic)?.count ?? 0),
            })),
            featured: featured.map((article) => this.summarize(article)),
            results: results?.map((article) => this.summarize(article)) ?? null,
        };
    }

    /** Every article, lightest fields only — the ticket form's topic list and suggested article. */
    async findArticles() {
        const articles = await this.articleRepository.find({ order: { title: 'ASC' } });
        return articles.map((article) => ({
            ...this.summarize(article),
            intro: article.body.split(/\n\s*\n/)[0],
        }));
    }

    async findArticle(slug: string, userId: number) {
        const article = await this.articleRepository.findOne({ where: { slug } });
        if (!article) throw new NotFoundException('Article not found');

        const [related, feedback] = await Promise.all([
            this.articleRepository
                .createQueryBuilder('article')
                .where('article.id != :id', { id: article.id })
                // Same topic first, then the most used guides.
                .orderBy('CASE WHEN article.topic = :topic THEN 0 ELSE 1 END', 'ASC')
                .addOrderBy('article.is_featured', 'DESC')
                .addOrderBy('article.title', 'ASC')
                .setParameter('topic', article.topic)
                .limit(3)
                .getMany(),
            this.feedbackRepository.findOne({ where: { article_id: article.id, user_id: userId } }),
        ]);

        return {
            ...this.summarize(article),
            body: article.body,
            updated_at: article.updated_at,
            related: related.map((entry) => this.summarize(entry)),
            my_feedback: feedback?.helpful ?? null,
        };
    }

    async saveFeedback(slug: string, helpful: boolean, userId: number) {
        const article = await this.articleRepository.findOne({ where: { slug } });
        if (!article) throw new NotFoundException('Article not found');
        await this.feedbackRepository.save({ article_id: article.id, user_id: userId, helpful });
        return { my_feedback: helpful };
    }

    async createTicket(dto: CreateSupportTicketDto, files: UploadedAttachment[], userId: number) {
        const rejected = files.find((file) => !ATTACHMENT_TYPES.includes(file.mimetype));
        if (rejected) throw new BadRequestException(`${rejected.originalname} is not a PDF, JPG or PNG file`);

        const ticket = await this.ticketRepository.save(
            this.ticketRepository.create({
                user_id: userId,
                category: dto.category,
                topic: dto.topic.trim(),
                contact_name: dto.contact_name.trim(),
                reply_email: dto.reply_email.trim(),
                subject: dto.subject.trim(),
                details: dto.details.trim(),
                related_record: dto.related_record?.trim() || null,
                steps: dto.steps?.trim() || null,
                impact: dto.impact || null,
                preferred_contact: dto.preferred_contact || null,
            }),
        );
        if (files.length) {
            await this.attachmentRepository.save(
                files.map((file) =>
                    this.attachmentRepository.create({
                        ticket_id: ticket.id,
                        filename: file.originalname,
                        mime_type: file.mimetype,
                        size: file.size,
                        data: file.buffer,
                    }),
                ),
            );
        }
        return {
            id: ticket.id,
            ticket_no: ticket.ticket_no,
            status: ticket.status,
            attachment_count: files.length,
        };
    }

    private search(query: FindHelpDto) {
        const qb = this.articleRepository.createQueryBuilder('article');
        if (query.topic) qb.andWhere('article.topic = :topic', { topic: query.topic });
        if (query.search) {
            // An article named after the phrase outranks ones that only mention its words.
            qb.orderBy(
                'CASE WHEN article.short_title ILIKE :phrase OR article.title ILIKE :phrase THEN 0 ELSE 1 END',
                'ASC',
            ).setParameter('phrase', `%${query.search.trim()}%`);
            // Every word must appear somewhere, so "lead allocation" finds "allocate … a lead" too.
            query.search
                .trim()
                .split(/\s+/)
                .slice(0, 6)
                .forEach((word, index) => {
                    const stem = word.length > 5 ? word.slice(0, 5) : word;
                    qb.andWhere(
                        `(article.title ILIKE :word${index} OR article.short_title ILIKE :word${index} OR article.body ILIKE :word${index})`,
                        { [`word${index}`]: `%${stem}%` },
                    );
                });
        }
        return qb.addOrderBy('article.title', 'ASC').getMany();
    }

    private summarize(article: HelpArticle) {
        return {
            slug: article.slug,
            topic: article.topic,
            title: article.title,
            short_title: article.short_title,
            read_minutes: article.read_minutes,
        };
    }
}
