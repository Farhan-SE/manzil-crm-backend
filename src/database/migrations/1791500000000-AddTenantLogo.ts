import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTenantLogo1791500000000 implements MigrationInterface {
    name = 'AddTenantLogo1791500000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "tenant"
                ADD COLUMN IF NOT EXISTS logo BYTEA,
                ADD COLUMN IF NOT EXISTS logo_mime TEXT,
                ADD COLUMN IF NOT EXISTS logo_updated_at TIMESTAMPTZ;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "tenant"
                DROP COLUMN IF EXISTS logo_updated_at,
                DROP COLUMN IF EXISTS logo_mime,
                DROP COLUMN IF EXISTS logo;
        `);
    }
}
