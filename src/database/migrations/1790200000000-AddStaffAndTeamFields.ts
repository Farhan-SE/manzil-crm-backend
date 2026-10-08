import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStaffAndTeamFields1790200000000 implements MigrationInterface {
    name = 'AddStaffAndTeamFields1790200000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "user"
                ADD COLUMN IF NOT EXISTS designation TEXT,
                ADD COLUMN IF NOT EXISTS department TEXT,
                ADD COLUMN IF NOT EXISTS office TEXT,
                ADD COLUMN IF NOT EXISTS manager_id INTEGER REFERENCES "user" (id) ON DELETE SET NULL,
                ADD COLUMN IF NOT EXISTS joined_on DATE,
                ADD COLUMN IF NOT EXISTS suspended BOOLEAN NOT NULL DEFAULT false,
                ADD COLUMN IF NOT EXISTS is_starred BOOLEAN NOT NULL DEFAULT false;
        `);

        await queryRunner.query(`CREATE SEQUENCE IF NOT EXISTS team_team_no_seq;`);
        await queryRunner.query(`ALTER TABLE "team" ADD COLUMN IF NOT EXISTS team_no INTEGER;`);
        // Existing teams are numbered in the order they were added, not in physical row order.
        await queryRunner.query(`
            UPDATE "team" t SET team_no = n.rn
            FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM "team") n
            WHERE t.id = n.id AND t.team_no IS NULL;
        `);
        await queryRunner.query(`
            SELECT setval('team_team_no_seq', COALESCE((SELECT MAX(team_no) FROM "team"), 0) + 1, false);
        `);
        await queryRunner.query(`
            ALTER TABLE "team"
                ALTER COLUMN team_no SET DEFAULT nextval('team_team_no_seq'),
                ALTER COLUMN team_no SET NOT NULL;
        `);
        await queryRunner.query(`ALTER SEQUENCE team_team_no_seq OWNED BY "team".team_no;`);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS team_team_no_key ON "team" (team_no);`);

        await queryRunner.query(`
            ALTER TABLE "team"
                ADD COLUMN IF NOT EXISTS lead_id INTEGER REFERENCES "user" (id) ON DELETE SET NULL,
                ADD COLUMN IF NOT EXISTS department TEXT,
                ADD COLUMN IF NOT EXISTS region TEXT,
                ADD COLUMN IF NOT EXISTS office TEXT,
                ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
                ADD COLUMN IF NOT EXISTS is_starred BOOLEAN NOT NULL DEFAULT false;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "team"
                DROP COLUMN IF EXISTS is_starred,
                DROP COLUMN IF EXISTS is_active,
                DROP COLUMN IF EXISTS office,
                DROP COLUMN IF EXISTS region,
                DROP COLUMN IF EXISTS department,
                DROP COLUMN IF EXISTS lead_id,
                DROP COLUMN IF EXISTS team_no;
        `);
        await queryRunner.query(`DROP SEQUENCE IF EXISTS team_team_no_seq;`);
        await queryRunner.query(`
            ALTER TABLE "user"
                DROP COLUMN IF EXISTS is_starred,
                DROP COLUMN IF EXISTS suspended,
                DROP COLUMN IF EXISTS joined_on,
                DROP COLUMN IF EXISTS manager_id,
                DROP COLUMN IF EXISTS office,
                DROP COLUMN IF EXISTS department,
                DROP COLUMN IF EXISTS designation;
        `);
    }
}
