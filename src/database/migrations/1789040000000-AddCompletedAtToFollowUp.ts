import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCompletedAtToFollowUp1789040000000 implements MigrationInterface {
    name = 'AddCompletedAtToFollowUp1789040000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "follow_up" ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
        `);
    }
    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "follow_up" DROP COLUMN IF EXISTS completed_at;`);
    }
}
