import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddApprovalLinksAndInventoryTypes1790900000000 implements MigrationInterface {
    name = 'AddApprovalLinksAndInventoryTypes1790900000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // An approval now points at what it is about: a payment, a unit, or a lead to hand over.
        await queryRunner.query(`ALTER TABLE "approval" ALTER COLUMN lead_id DROP NOT NULL;`);
        await queryRunner.query(`ALTER TABLE "approval" ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES "payment" (id) ON DELETE CASCADE;`);
        await queryRunner.query(`ALTER TABLE "approval" ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES "unit" (id) ON DELETE CASCADE;`);
        await queryRunner.query(`ALTER TABLE "approval" ADD COLUMN IF NOT EXISTS target_user_id INTEGER REFERENCES "user" (id) ON DELETE SET NULL;`);
        await queryRunner.query(`UPDATE "approval" SET type = 'lead_transfer' WHERE type = 'lead_allocation';`);

        // Units belong to the company's own stock or a sales partner's, and wait for an admin before they list.
        await queryRunner.query(`ALTER TABLE "unit" ADD COLUMN IF NOT EXISTS inventory_type TEXT NOT NULL DEFAULT 'direct';`);
        await queryRunner.query(`ALTER TABLE "unit" ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'approved';`);

        await queryRunner.query(`ALTER TABLE "partner_project" ADD COLUMN IF NOT EXISTS owner_name TEXT;`);
        await queryRunner.query(`ALTER TABLE "partner_project" ADD COLUMN IF NOT EXISTS owner_phone TEXT;`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "partner_project" DROP COLUMN IF EXISTS owner_phone;`);
        await queryRunner.query(`ALTER TABLE "partner_project" DROP COLUMN IF EXISTS owner_name;`);
        await queryRunner.query(`ALTER TABLE "unit" DROP COLUMN IF EXISTS approval_status;`);
        await queryRunner.query(`ALTER TABLE "unit" DROP COLUMN IF EXISTS inventory_type;`);
        await queryRunner.query(`UPDATE "approval" SET type = 'lead_allocation' WHERE type = 'lead_transfer';`);
        await queryRunner.query(`ALTER TABLE "approval" DROP COLUMN IF EXISTS target_user_id;`);
        await queryRunner.query(`ALTER TABLE "approval" DROP COLUMN IF EXISTS unit_id;`);
        await queryRunner.query(`ALTER TABLE "approval" DROP COLUMN IF EXISTS payment_id;`);
        await queryRunner.query(`DELETE FROM "approval" WHERE lead_id IS NULL;`);
        await queryRunner.query(`ALTER TABLE "approval" ALTER COLUMN lead_id SET NOT NULL;`);
    }
}
