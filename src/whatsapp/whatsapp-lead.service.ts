import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from '../categories/category.entity.js';
import { countryFromPhone } from '../common/country-code.js';
import { NORMALIZED_PHONE, normalizePhone } from '../customer/customer-import.js';
import { Customers } from '../customer/customer.entity.js';
import { Interest } from '../interests/interest.entity.js';
import { Lead } from '../leads/lead.entity.js';
import { Source } from '../sources/source.entity.js';
import type { ChatbotMatches } from '../leads/lead.entity.js';
import type { OfferedUnits } from './inventory-search.js';
import type { PropertyChatTurn, PropertyEnquiry } from './property-chat.client.js';
import type { IncomingWhatsappText } from './whatsapp-webhook.js';

const SUB_SOURCE = 'WhatsApp chatbot';

export type ChatContact = Pick<IncomingWhatsappText, 'senderId' | 'customerName'>;

// The company's own interest and category names the enquiry is filed under, best first.
const INTEREST_NAMES = { rent: ['rent', 'kiraya', 'lease'], buy: ['buy', 'purchase', 'sale'] };
const CATEGORY_NAMES = {
    house: ['house', 'home', 'residential'],
    apartment: ['apartment', 'flat', 'residential'],
    plot: ['plot', 'land'],
    commercial: ['commercial', 'shop', 'office'],
};

function toMatches(result: OfferedUnits): ChatbotMatches {
    return {
        shown_at: new Date().toISOString(),
        total: result.total,
        portions_instead: result.portionsInstead,
        units: result.shown.map((m) => ({
            unit_id: m.unitId,
            project: m.project,
            unit_number: m.unitNumber,
            unit_type: m.unitType,
            beds: m.beds,
            price: m.price,
            has_media: m.mediaCount > 0,
        })),
    };
}

/** Turns a chatbot enquiry into a client and a lead the company's staff then pick up and assign. */
@Injectable()
export class WhatsappLeadService {
    private readonly logger = new Logger(WhatsappLeadService.name);

    constructor(
        @InjectRepository(Lead) private readonly leads: Repository<Lead>,
        @InjectRepository(Customers) private readonly customers: Repository<Customers>,
        @InjectRepository(Interest) private readonly interests: Repository<Interest>,
        @InjectRepository(Category) private readonly categories: Repository<Category>,
        @InjectRepository(Source) private readonly sources: Repository<Source>,
    ) { }

    /** Must run inside the company's tenant context, so new rows are stamped with it. */
    async save(
        tenantId: string,
        message: ChatContact,
        turn: PropertyChatTurn,
        offered?: OfferedUnits,
        subSource = SUB_SOURCE,
    ): Promise<void> {
        const enquiry = turn.parameters;
        if (!turn.lead_key || !(enquiry.purpose || enquiry.property_type || enquiry.area)) return;

        const fields = {
            ...(await this.leadFields(tenantId, enquiry, subSource)),
            ...(offered && { chatbot_matches: toMatches(offered) }),
        };
        const existing = await this.leads.findOne({
            where: { tenant_id: tenantId, whatsapp_key: turn.lead_key },
            select: { id: true, stage: true },
        });
        if (existing) {
            // Staff have closed it; a late message from the customer must not rewrite it.
            if (existing.stage === 'sold' || existing.stage === 'lost') return;
            await this.leads.update({ id: existing.id }, fields);
            return;
        }

        const customer = await this.findOrCreateCustomer(tenantId, message, fields.source_id, subSource);
        try {
            await this.leads.save(this.leads.create({
                ...fields,
                customer_id: customer.id,
                client_name: customer.customer_name,
                client_number: customer.contact_number,
                whatsapp_key: turn.lead_key,
                // A client an agent already holds keeps the new enquiry with them; otherwise staff assign it.
                assigned_to: customer.assigned_to ?? null,
                created_by: null,
            }));
            this.logger.log(`WhatsApp lead created for ${message.senderId}`);
        } catch (error) {
            // Two webhook deliveries racing: the unique index on whatsapp_key keeps one lead.
            if ((error as { code?: string }).code !== '23505') throw error;
        }
    }

    findByKey(tenantId: string, leadKey: string) {
        return this.leads.findOne({ where: { tenant_id: tenantId, whatsapp_key: leadKey }, select: { id: true, chatbot_matches: true } });
    }

    private async leadFields(tenantId: string, enquiry: PropertyEnquiry, subSource: string) {
        const [interest, category, source] = await Promise.all([
            enquiry.purpose ? this.findByName(this.interests, tenantId, INTEREST_NAMES[enquiry.purpose]) : null,
            enquiry.property_type ? this.findByName(this.categories, tenantId, CATEGORY_NAMES[enquiry.property_type]) : null,
            this.findByName(this.sources, tenantId, ['whatsapp']),
        ]);
        return {
            interest_id: interest?.id ?? null,
            category_id: category?.id ?? null,
            area: enquiry.area,
            budget: enquiry.budget != null ? String(enquiry.budget) : null,
            source_id: source?.id ?? null,
            sub_source: subSource,
        };
    }

    private async findByName<T extends { id: string; name: string }>(repo: Repository<T>, tenantId: string, names: string[]) {
        const rows = (await repo.find({ where: { tenant_id: tenantId } as never, select: { id: true, name: true } as never })) as T[];
        for (const name of names) {
            const match = rows.find((row) => row.name.toLowerCase().includes(name));
            if (match) return match;
        }
        return null;
    }

    private findCustomer(tenantId: string, senderId: string) {
        return this.customers
            .createQueryBuilder('customer')
            .leftJoinAndSelect('customer.assigned_to', 'assigned_to')
            .where(`${NORMALIZED_PHONE} = :digits`, { digits: normalizePhone(senderId) })
            .andWhere('customer.tenant_id = :tenantId', { tenantId })
            .getOne();
    }

    private async findOrCreateCustomer(tenantId: string, message: ChatContact, sourceId: string | null, subSource: string) {
        const existing = await this.findCustomer(tenantId, message.senderId);
        if (existing) return existing;

        const phone = `+${message.senderId}`;
        const customer = this.customers.create({
            customer_name: message.customerName?.trim() || phone,
            contact_number: phone,
            country: countryFromPhone(phone),
            source_id: sourceId,
            sub_source: subSource,
            created_by: null,
            assigned_to: null,
        });
        try {
            return await this.customers.save(customer);
        } catch (error) {
            // The same number added a moment ago, by staff or another delivery: use that client.
            const added = (error as { code?: string }).code === '23505' ? await this.findCustomer(tenantId, message.senderId) : null;
            if (!added) throw error;
            return added;
        }
    }
}
