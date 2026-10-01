import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLeadListFields1789300000000 implements MigrationInterface {
    name = 'AddLeadListFields1789300000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE SEQUENCE IF NOT EXISTS lead_lead_no_seq;`);
        await queryRunner.query(`ALTER TABLE "lead" ADD COLUMN IF NOT EXISTS lead_no INTEGER;`);
        // Existing leads are numbered in the order they were added, not in physical row order.
        await queryRunner.query(`
            UPDATE "lead" l SET lead_no = n.rn
            FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM "lead") n
            WHERE l.id = n.id AND l.lead_no IS NULL;
        `);
        await queryRunner.query(`
            SELECT setval('lead_lead_no_seq', COALESCE((SELECT MAX(lead_no) FROM "lead"), 0) + 1, false);
        `);
        await queryRunner.query(`
            ALTER TABLE "lead"
                ALTER COLUMN lead_no SET DEFAULT nextval('lead_lead_no_seq'),
                ALTER COLUMN lead_no SET NOT NULL;
        `);
        await queryRunner.query(`ALTER SEQUENCE lead_lead_no_seq OWNED BY "lead".lead_no;`);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS lead_lead_no_key ON "lead" (lead_no);`);

        await queryRunner.query(`
            ALTER TABLE "lead"
                ADD COLUMN IF NOT EXISTS sub_source TEXT,
                ADD COLUMN IF NOT EXISTS is_starred BOOLEAN NOT NULL DEFAULT false;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "lead"
                DROP COLUMN IF EXISTS is_starred,
                DROP COLUMN IF EXISTS sub_source,
                DROP COLUMN IF EXISTS lead_no;
        `);
        await queryRunner.query(`DROP SEQUENCE IF EXISTS lead_lead_no_seq;`);
    }
}
