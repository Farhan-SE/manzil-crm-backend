import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCustomerListFields1789200000000 implements MigrationInterface {
    name = 'AddCustomerListFields1789200000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE SEQUENCE IF NOT EXISTS customers_customer_no_seq;`);
        await queryRunner.query(`ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS customer_no INTEGER;`);
        // Existing customers are numbered in the order they were added, not in physical row order.
        await queryRunner.query(`
            UPDATE "customers" c SET customer_no = n.rn
            FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM "customers") n
            WHERE c.id = n.id AND c.customer_no IS NULL;
        `);
        await queryRunner.query(`
            SELECT setval('customers_customer_no_seq', COALESCE((SELECT MAX(customer_no) FROM "customers"), 0) + 1, false);
        `);
        await queryRunner.query(`
            ALTER TABLE "customers"
                ALTER COLUMN customer_no SET DEFAULT nextval('customers_customer_no_seq'),
                ALTER COLUMN customer_no SET NOT NULL;
        `);
        await queryRunner.query(`ALTER SEQUENCE customers_customer_no_seq OWNED BY "customers".customer_no;`);
        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS customers_customer_no_key ON "customers" (customer_no);
        `);

        await queryRunner.query(`
            ALTER TABLE "customers"
                ADD COLUMN IF NOT EXISTS stage TEXT NOT NULL DEFAULT 'inquiry',
                ADD COLUMN IF NOT EXISTS sub_source TEXT,
                ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT 'PK',
                ADD COLUMN IF NOT EXISTS is_starred BOOLEAN NOT NULL DEFAULT false;
        `);

        await queryRunner.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS team TEXT;`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS team;`);
        await queryRunner.query(`
            ALTER TABLE "customers"
                DROP COLUMN IF EXISTS is_starred,
                DROP COLUMN IF EXISTS country,
                DROP COLUMN IF EXISTS sub_source,
                DROP COLUMN IF EXISTS stage,
                DROP COLUMN IF EXISTS customer_no;
        `);
        await queryRunner.query(`DROP SEQUENCE IF EXISTS customers_customer_no_seq;`);
    }
}
