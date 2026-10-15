import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddApprovalResubmission1791000000000 implements MigrationInterface {
    name = 'AddApprovalResubmission1791000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // The requester's answer to a returned request, and when they sent it back.
        await queryRunner.query(`ALTER TABLE "approval" ADD COLUMN IF NOT EXISTS requester_note TEXT;`);
        await queryRunner.query(`ALTER TABLE "approval" ADD COLUMN IF NOT EXISTS resubmitted_at TIMESTAMPTZ;`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "approval" DROP COLUMN IF EXISTS resubmitted_at;`);
        await queryRunner.query(`ALTER TABLE "approval" DROP COLUMN IF EXISTS requester_note;`);
    }
}
