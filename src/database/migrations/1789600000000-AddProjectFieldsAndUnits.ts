import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProjectFieldsAndUnits1789600000000 implements MigrationInterface {
    name = 'AddProjectFieldsAndUnits1789600000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "partner_project"
                ADD COLUMN IF NOT EXISTS project_type TEXT NOT NULL DEFAULT 'exclusive',
                ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
                ADD COLUMN IF NOT EXISTS is_starred BOOLEAN NOT NULL DEFAULT false,
                ADD COLUMN IF NOT EXISTS grade TEXT,
                ADD COLUMN IF NOT EXISTS token_amount NUMERIC,
                ADD COLUMN IF NOT EXISTS pdp_percent NUMERIC,
                ADD COLUMN IF NOT EXISTS cdp_percent NUMERIC;
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "unit" (
                id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                project_id      UUID NOT NULL REFERENCES "partner_project"(id) ON DELETE CASCADE,
                unit_number     TEXT NOT NULL,
                unit_type       TEXT,
                features        TEXT,
                floor           TEXT,
                beds            INTEGER,
                price           NUMERIC,
                area_sqft       NUMERIC,
                status          TEXT NOT NULL DEFAULT 'available',
                created_by_id   INTEGER REFERENCES "user"(id) ON DELETE SET NULL,
                created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
                UNIQUE (project_id, unit_number)
            );
        `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS unit_status_idx ON "unit" (status);`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "unit";`);
        await queryRunner.query(`
            ALTER TABLE "partner_project"
                DROP COLUMN IF EXISTS cdp_percent,
                DROP COLUMN IF EXISTS pdp_percent,
                DROP COLUMN IF EXISTS token_amount,
                DROP COLUMN IF EXISTS grade,
                DROP COLUMN IF EXISTS is_starred,
                DROP COLUMN IF EXISTS is_active,
                DROP COLUMN IF EXISTS project_type;
        `);
    }
}
