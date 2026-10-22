import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWhatsappNumbers1791800000000 implements MigrationInterface {
    name = 'AddWhatsappNumbers1791800000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "whatsapp_number" (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tenant_id UUID NOT NULL REFERENCES "tenant" (id) ON DELETE CASCADE,
                phone_number_id TEXT NOT NULL UNIQUE,
                display_phone TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS whatsapp_number_tenant_idx ON "whatsapp_number" (tenant_id);`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "whatsapp_number";`);
    }
}
