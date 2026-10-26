import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddChatbotMatchesToLead1792000000000 implements MigrationInterface {
    name = 'AddChatbotMatchesToLead1792000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "lead" ADD COLUMN IF NOT EXISTS chatbot_matches JSONB;`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "lead" DROP COLUMN IF EXISTS chatbot_matches;`);
    }
}
