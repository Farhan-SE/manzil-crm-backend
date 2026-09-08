import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInterestToInventory1788349800000 implements MigrationInterface {
    name = 'AddInterestToInventory1788349800000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "listing" ADD COLUMN IF NOT EXISTS interest_id UUID;`);
        await queryRunner.query(`ALTER TABLE "partner_project" ADD COLUMN IF NOT EXISTS interest_id UUID;`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "partner_project" DROP COLUMN IF EXISTS interest_id;`);
        await queryRunner.query(`ALTER TABLE "listing" DROP COLUMN IF EXISTS interest_id;`);
    }
}
