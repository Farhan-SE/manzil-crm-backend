import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWhatsappKeyToLead1791900000000 implements MigrationInterface {
    name = 'AddWhatsappKeyToLead1791900000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "lead" ADD COLUMN IF NOT EXISTS whatsapp_key TEXT;`);
        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS lead_whatsapp_key_unique
            ON "lead" (tenant_id, whatsapp_key) WHERE whatsapp_key IS NOT NULL;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS lead_whatsapp_key_unique;`);
        await queryRunner.query(`ALTER TABLE "lead" DROP COLUMN IF EXISTS whatsapp_key;`);
    }
}
