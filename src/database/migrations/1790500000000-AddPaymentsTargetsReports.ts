import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPaymentsTargetsReports1790500000000 implements MigrationInterface {
    name = 'AddPaymentsTargetsReports1790500000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE SEQUENCE IF NOT EXISTS payment_payment_no_seq;`);
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "payment" (
                id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                payment_no      INTEGER NOT NULL DEFAULT nextval('payment_payment_no_seq'),
                lead_id         UUID NOT NULL REFERENCES "lead" (id) ON DELETE CASCADE,
                payment_type    TEXT NOT NULL,
                due_date        DATE NOT NULL,
                amount          NUMERIC NOT NULL,
                received_amount NUMERIC NOT NULL DEFAULT 0,
                received_at     TIMESTAMPTZ,
                method          TEXT,
                reference       TEXT,
                note            TEXT,
                verified        BOOLEAN NOT NULL DEFAULT false,
                verified_by_id  INTEGER REFERENCES "user" (id) ON DELETE SET NULL,
                is_starred      BOOLEAN NOT NULL DEFAULT false,
                created_by_id   INTEGER REFERENCES "user" (id) ON DELETE SET NULL,
                created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        `);
        await queryRunner.query(`ALTER SEQUENCE payment_payment_no_seq OWNED BY "payment".payment_no;`);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS payment_payment_no_key ON "payment" (payment_no);`);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "target" (
                id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                period     TEXT NOT NULL,
                metric     TEXT NOT NULL,
                value      NUMERIC NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                UNIQUE (period, metric)
            );
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "report_run" (
                id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                report_key      TEXT NOT NULL,
                period          TEXT NOT NULL,
                generated_by_id INTEGER REFERENCES "user" (id) ON DELETE SET NULL,
                generated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS report_run_key_idx ON "report_run" (report_key, generated_at DESC);`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "report_run";`);
        await queryRunner.query(`DROP TABLE IF EXISTS "target";`);
        await queryRunner.query(`DROP TABLE IF EXISTS "payment";`);
        await queryRunner.query(`DROP SEQUENCE IF EXISTS payment_payment_no_seq;`);
    }
}
