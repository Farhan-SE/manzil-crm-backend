import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddApprovalTable1790400000000 implements MigrationInterface {
    name = 'AddApprovalTable1790400000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE SEQUENCE IF NOT EXISTS approval_request_no_seq;`);
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "approval" (
                id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                request_no      INTEGER NOT NULL DEFAULT nextval('approval_request_no_seq'),
                type            TEXT NOT NULL,
                summary         TEXT NOT NULL,
                lead_id         UUID NOT NULL REFERENCES "lead" (id) ON DELETE CASCADE,
                priority        TEXT NOT NULL DEFAULT 'normal',
                status          TEXT NOT NULL DEFAULT 'pending',
                due_date        DATE,
                submitted_by_id INTEGER REFERENCES "user" (id) ON DELETE SET NULL,
                reviewer_id     INTEGER REFERENCES "user" (id) ON DELETE SET NULL,
                review_comment  TEXT,
                decided_at      TIMESTAMPTZ,
                is_starred      BOOLEAN NOT NULL DEFAULT false,
                created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        `);
        await queryRunner.query(`ALTER SEQUENCE approval_request_no_seq OWNED BY "approval".request_no;`);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS approval_request_no_key ON "approval" (request_no);`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "approval";`);
        await queryRunner.query(`DROP SEQUENCE IF EXISTS approval_request_no_seq;`);
    }
}
