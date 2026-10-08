import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLocationsAndNotifications1790100000000 implements MigrationInterface {
    name = 'AddLocationsAndNotifications1790100000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE SEQUENCE IF NOT EXISTS location_location_no_seq;`);
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "location" (
                id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                location_no INTEGER NOT NULL DEFAULT nextval('location_location_no_seq'),
                name        TEXT NOT NULL,
                city        TEXT,
                region      TEXT,
                department  TEXT,
                is_active   BOOLEAN NOT NULL DEFAULT true,
                is_starred  BOOLEAN NOT NULL DEFAULT false,
                created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        `);
        await queryRunner.query(`ALTER SEQUENCE location_location_no_seq OWNED BY "location".location_no;`);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS location_location_no_key ON "location" (location_no);`);

        await queryRunner.query(`ALTER TABLE "partner_project" ADD COLUMN IF NOT EXISTS location_id UUID;`);
        // Every place a project already names becomes a location, oldest project first so the numbering is stable.
        await queryRunner.query(`
            INSERT INTO "location" (name, city)
            SELECT name, city FROM (
                SELECT TRIM(p.location) AS name, NULLIF(TRIM(p.city), '') AS city, MIN(p.created_at) AS first_seen
                FROM "partner_project" p
                WHERE NULLIF(TRIM(p.location), '') IS NOT NULL AND p.location_id IS NULL
                GROUP BY TRIM(p.location), NULLIF(TRIM(p.city), '')
            ) places
            ORDER BY first_seen;
        `);
        await queryRunner.query(`
            UPDATE "partner_project" p SET location_id = l.id
            FROM "location" l
            WHERE p.location_id IS NULL
              AND TRIM(p.location) = l.name
              AND NULLIF(TRIM(p.city), '') IS NOT DISTINCT FROM l.city;
        `);

        await queryRunner.query(`ALTER TABLE "unit" ADD COLUMN IF NOT EXISTS is_starred BOOLEAN NOT NULL DEFAULT false;`);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "notification" (
                id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id     INTEGER NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
                title       TEXT NOT NULL,
                body        TEXT,
                link        TEXT,
                is_read     BOOLEAN NOT NULL DEFAULT false,
                created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS notification_user_idx ON "notification" (user_id, created_at DESC);`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "notification";`);
        await queryRunner.query(`ALTER TABLE "unit" DROP COLUMN IF EXISTS is_starred;`);
        await queryRunner.query(`ALTER TABLE "partner_project" DROP COLUMN IF EXISTS location_id;`);
        await queryRunner.query(`DROP TABLE IF EXISTS "location";`);
        await queryRunner.query(`DROP SEQUENCE IF EXISTS location_location_no_seq;`);
    }
}
