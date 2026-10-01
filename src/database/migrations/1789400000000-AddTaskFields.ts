import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTaskFields1789400000000 implements MigrationInterface {
    name = 'AddTaskFields1789400000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "follow_up"
                ADD COLUMN IF NOT EXISTS task_type TEXT,
                ADD COLUMN IF NOT EXISTS sub_task TEXT;
        `);
        await queryRunner.query(`ALTER TABLE "lead" ADD COLUMN IF NOT EXISTS project_id UUID;`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "lead" DROP COLUMN IF EXISTS project_id;`);
        await queryRunner.query(`
            ALTER TABLE "follow_up"
                DROP COLUMN IF EXISTS sub_task,
                DROP COLUMN IF EXISTS task_type;
        `);
    }
}
