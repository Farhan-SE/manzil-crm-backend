import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Generated,
    PrimaryColumn,
} from 'typeorm';

export const HELP_TOPICS = [
    'clients_leads',
    'tasks',
    'projects_inventory',
    'staff_teams',
    'accounts_payments',
    'reports_management',
];

export const TICKET_IMPACTS = ['one_record', 'several_records', 'team_blocked', 'workspace_blocked'];

export const TICKET_CONTACTS = ['email', 'phone', 'whatsapp'];

@Entity()
export class HelpArticle {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'text', unique: true })
    slug: string;

    @Column({ type: 'text' })
    topic: string;

    @Column({ type: 'text' })
    title: string;

    /** The subject in a few words, e.g. "Lead allocation" — used in breadcrumbs and as a ticket topic. */
    @Column({ type: 'text' })
    short_title: string;

    // Plain text: blank lines between paragraphs, "## " starts a section heading.
    @Column({ type: 'text' })
    body: string;

    @Column({ type: 'int', default: 2 })
    read_minutes: number;

    /** Listed under "Frequently used articles". */
    @Column({ type: 'boolean', default: false })
    is_featured: boolean;

    @CreateDateColumn({ type: 'timestamptz' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updated_at: Date;

}

@Entity()
export class HelpArticleFeedback {

    @PrimaryColumn({ type: 'uuid' })
    article_id: string;

    @PrimaryColumn({ type: 'int' })
    user_id: number;

    @Column({ type: 'boolean' })
    helpful: boolean;

    @CreateDateColumn({ type: 'timestamptz' })
    created_at: Date;

}

@Entity()
export class SupportTicket {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    // The reference handed back to the person who raised it.
    @Column({ type: 'int' })
    @Generated('increment')
    ticket_no: number;

    @Column({ type: 'int', nullable: true })
    user_id: number | null;

    @Column({ type: 'text' })
    category: string;

    @Column({ type: 'text' })
    topic: string;

    @Column({ type: 'text' })
    contact_name: string;

    @Column({ type: 'text' })
    reply_email: string;

    @Column({ type: 'text' })
    subject: string;

    @Column({ type: 'text' })
    details: string;

    // The lead, unit or receipt the request is about, as the user typed it.
    @Column({ type: 'text', nullable: true })
    related_record: string | null;

    @Column({ type: 'text', nullable: true })
    steps: string | null;

    @Column({ type: 'text', nullable: true })
    impact: string | null;

    @Column({ type: 'text', nullable: true })
    preferred_contact: string | null;

    @Column({ type: 'text', default: 'open' })
    status: string;

    @CreateDateColumn({ type: 'timestamptz' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updated_at: Date;

}

@Entity()
export class SupportTicketAttachment {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    ticket_id: string;

    @Column({ type: 'text' })
    filename: string;

    @Column({ type: 'text' })
    mime_type: string;

    @Column({ type: 'int' })
    size: number;

    @Column({ type: 'bytea', select: false })
    data: Buffer;

    @CreateDateColumn({ type: 'timestamptz' })
    created_at: Date;

}
