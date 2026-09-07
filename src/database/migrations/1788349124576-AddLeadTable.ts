import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLeadTable1788349124576 implements MigrationInterface {
    name = 'AddLeadTable1788349124576';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "lead" (
                id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                client_name       TEXT NOT NULL,
                client_number     TEXT NOT NULL,
                interest_id       UUID,
                city              TEXT,
                area              TEXT,
                budget            NUMERIC,
                source_id         UUID,
                temperature       TEXT NOT NULL DEFAULT 'WARM',
                stage             TEXT NOT NULL DEFAULT 'inquiry',
                assigned_to_id    INTEGER REFERENCES "user"(id) ON DELETE SET NULL,
                created_by_id     INTEGER REFERENCES "user"(id) ON DELETE SET NULL,
                created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "lead";`);
    }
}
