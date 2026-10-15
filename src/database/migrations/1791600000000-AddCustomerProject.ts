import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCustomerProject1791600000000 implements MigrationInterface {
    name = 'AddCustomerProject1791600000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES "partner_project" (id) ON DELETE SET NULL;`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS customers_project_idx ON "customers" (project_id);`);
        // A client added from the form got its project through the lead opened with it — the earliest one.
        await queryRunner.query(`
            UPDATE "customers" c SET project_id = first_lead.project_id
            FROM (
                SELECT DISTINCT ON (l.customer_id) l.customer_id, l.project_id
                FROM "lead" l
                WHERE l.customer_id IS NOT NULL AND l.project_id IS NOT NULL
                ORDER BY l.customer_id, l.created_at, l.id
            ) first_lead
            WHERE c.id = first_lead.customer_id AND c.project_id IS NULL;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS customers_project_idx;`);
        await queryRunner.query(`ALTER TABLE "customers" DROP COLUMN IF EXISTS project_id;`);
    }
}
