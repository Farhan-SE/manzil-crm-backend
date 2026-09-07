import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCategoryIdToLead1788349500000 implements MigrationInterface {
    name = 'AddCategoryIdToLead1788349500000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "lead"
            ADD COLUMN IF NOT EXISTS category_id UUID;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "lead"
            DROP COLUMN IF EXISTS category_id;
        `);
    }
}
