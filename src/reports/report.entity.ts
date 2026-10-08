import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Unique,
} from 'typeorm';

export const TARGET_METRICS = ['booked_sales', 'site_visits', 'collections'] as const;
export type TargetMetric = (typeof TARGET_METRICS)[number];

/** What the team aims to reach on one measure in one calendar month. */
@Entity()
@Unique(['period', 'metric'])
export class Target {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    // The month, as YYYY-MM.
    @Column({ type: 'text' })
    period: string;

    @Column({ type: 'text' })
    metric: string;

    @Column({ type: 'numeric' })
    value: string;

    @CreateDateColumn({ type: 'timestamptz' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updated_at: Date;

}

/** One time a report was generated — the list shows the latest per report. */
@Entity()
export class ReportRun {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'text' })
    report_key: string;

    @Column({ type: 'text' })
    period: string;

    @Column({ type: 'int', nullable: true })
    generated_by_id: number | null;

    @CreateDateColumn({ type: 'timestamptz' })
    generated_at: Date;

}
