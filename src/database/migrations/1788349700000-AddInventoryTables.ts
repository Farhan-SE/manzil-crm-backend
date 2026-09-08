import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInventoryTables1788349700000 implements MigrationInterface {
    name = 'AddInventoryTables1788349700000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "listing" (
                id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                area_name         TEXT NOT NULL,
                client_name       TEXT NOT NULL,
                client_number     TEXT NOT NULL,
                category_id       UUID,
                city              TEXT,
                location          TEXT,
                price             NUMERIC,
                description       TEXT,
                assigned_to_id    INTEGER REFERENCES "user"(id) ON DELETE SET NULL,
                created_by_id     INTEGER REFERENCES "user"(id) ON DELETE SET NULL,
                created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "partner_project" (
                id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                project_name      TEXT NOT NULL,
                developer         TEXT,
                category_id       UUID,
                city              TEXT,
                location          TEXT,
                price             NUMERIC,
                description       TEXT,
                created_by_id     INTEGER REFERENCES "user"(id) ON DELETE SET NULL,
                created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "partner_project";`);
        await queryRunner.query(`DROP TABLE IF EXISTS "listing";`);
    }
}
