import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCustomerTable1788950290362 implements MigrationInterface {
    name = 'AddCustomerTable1788950290362';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "customers" (
                id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                customer_name     TEXT NOT NULL,
                cnic_number       TEXT NOT NULL,
                contact_number    TEXT NOT NULL,
                alternate_contact_number    TEXT,
                email             TEXT,
                address           TEXT,
                city              TEXT,
                relation_type     TEXT  ,
                source_id         UUID,
                customer_since    DATE,
                notes             TEXT,
                assigned_to_id    INTEGER REFERENCES "user"(id) ON DELETE SET NULL,
                created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "customers";`);
    }
}
