import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFollowUpTable1788349600000 implements MigrationInterface {
    name = 'AddFollowUpTable1788349600000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "follow_up" (
                id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                lead_id           UUID NOT NULL REFERENCES "lead"(id) ON DELETE CASCADE,
                text              TEXT NOT NULL,
                due_date          DATE NOT NULL,
                due_time          TIME NOT NULL,
                completed         BOOLEAN NOT NULL DEFAULT false,
                created_by_id     INTEGER REFERENCES "user"(id) ON DELETE SET NULL,
                created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "follow_up";`);
    }
}
