import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSalesDisputeTable1790300000000 implements MigrationInterface {
    name = 'AddSalesDisputeTable1790300000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE SEQUENCE IF NOT EXISTS sales_dispute_case_no_seq;`);
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "sales_dispute" (
                id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                case_no              INTEGER NOT NULL DEFAULT nextval('sales_dispute_case_no_seq'),
                lead_id              UUID NOT NULL REFERENCES "lead" (id) ON DELETE CASCADE,
                category             TEXT NOT NULL,
                subject              TEXT NOT NULL,
                description          TEXT,
                requested_resolution TEXT,
                status               TEXT NOT NULL DEFAULT 'open',
                raised_by_id         INTEGER REFERENCES "user" (id) ON DELETE SET NULL,
                review_owner_id      INTEGER REFERENCES "user" (id) ON DELETE SET NULL,
                resolution_due       DATE,
                resolved_at          TIMESTAMPTZ,
                is_starred           BOOLEAN NOT NULL DEFAULT false,
                created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        `);
        await queryRunner.query(`ALTER SEQUENCE sales_dispute_case_no_seq OWNED BY "sales_dispute".case_no;`);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS sales_dispute_case_no_key ON "sales_dispute" (case_no);`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "sales_dispute";`);
        await queryRunner.query(`DROP SEQUENCE IF EXISTS sales_dispute_case_no_seq;`);
    }
}
