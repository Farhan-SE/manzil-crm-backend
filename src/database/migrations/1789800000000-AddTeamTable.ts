import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTeamTable1789800000000 implements MigrationInterface {
    name = 'AddTeamTable1789800000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "team" (
                id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name        TEXT NOT NULL UNIQUE,
                created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        `);
        await queryRunner.query(`
            ALTER TABLE "user" ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES "team"(id) ON DELETE SET NULL;
        `);

        // Team names typed as free text so far become real teams, and their members are linked to them.
        await queryRunner.query(`
            INSERT INTO "team" (name)
            SELECT DISTINCT btrim(team) FROM "user" WHERE btrim(COALESCE(team, '')) <> ''
            ON CONFLICT (name) DO NOTHING;
        `);
        await queryRunner.query(`
            UPDATE "user" u SET team_id = t.id, team = t.name
            FROM "team" t
            WHERE btrim(COALESCE(u.team, '')) = t.name;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS team_id;`);
        await queryRunner.query(`DROP TABLE IF EXISTS "team";`);
    }
}
