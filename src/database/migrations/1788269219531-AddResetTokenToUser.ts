import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddResetTokenToUser1788269219531 implements MigrationInterface {
    name = 'AddResetTokenToUser1788269219531';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "user"
            ADD COLUMN IF NOT EXISTS reset_token TEXT,
            ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMPTZ;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "user"
            DROP COLUMN IF EXISTS reset_token,
            DROP COLUMN IF EXISTS reset_token_expires;
        `);
    }
}
