import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCustomerIdToLead1789500000000 implements MigrationInterface {
    name = 'AddCustomerIdToLead1789500000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "lead" ADD COLUMN IF NOT EXISTS customer_id UUID;`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS lead_customer_id_idx ON "lead" (customer_id);`);
        // Leads created before the link existed are matched once on phone digits, against either
        // of the customer's numbers. Anything that doesn't match stays unlinked.
        await queryRunner.query(`
            UPDATE "lead" l SET customer_id = c.id
            FROM "customers" c
            WHERE l.customer_id IS NULL
              AND regexp_replace(l.client_number, '\\D', '', 'g') <> ''
              AND regexp_replace(l.client_number, '\\D', '', 'g') IN (
                  regexp_replace(c.contact_number, '\\D', '', 'g'),
                  regexp_replace(COALESCE(c.alternate_contact_number, ''), '\\D', '', 'g')
              );
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS lead_customer_id_idx;`);
        await queryRunner.query(`ALTER TABLE "lead" DROP COLUMN IF EXISTS customer_id;`);
    }
}
