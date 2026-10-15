import { MigrationInterface, QueryRunner } from 'typeorm';

export class SplitClientNames1790800000000 implements MigrationInterface {
    name = 'SplitClientNames1790800000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS first_name TEXT;`);
        await queryRunner.query(`ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS last_name TEXT;`);
        // Everything before the last space is the first name; a one-word name has no last name.
        await queryRunner.query(`
            UPDATE "customers"
            SET first_name = CASE WHEN position(' ' IN trim(customer_name)) > 0
                                  THEN regexp_replace(trim(customer_name), '\\s+\\S+$', '')
                                  ELSE trim(customer_name) END,
                last_name = CASE WHEN position(' ' IN trim(customer_name)) > 0
                                 THEN substring(trim(customer_name) FROM '\\S+$')
                                 ELSE NULL END
            WHERE first_name IS NULL;
        `);
        await queryRunner.query(`ALTER TABLE "customers" ALTER COLUMN cnic_number DROP NOT NULL;`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`UPDATE "customers" SET cnic_number = '' WHERE cnic_number IS NULL;`);
        await queryRunner.query(`ALTER TABLE "customers" ALTER COLUMN cnic_number SET NOT NULL;`);
        await queryRunner.query(`ALTER TABLE "customers" DROP COLUMN IF EXISTS last_name;`);
        await queryRunner.query(`ALTER TABLE "customers" DROP COLUMN IF EXISTS first_name;`);
    }
}
