import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTaskReminders1790700000000 implements MigrationInterface {
    name = 'AddTaskReminders1790700000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "follow_up" ADD COLUMN IF NOT EXISTS reminded_at TIMESTAMPTZ;`);
        // Tasks already past their time count as reminded, so the first run doesn't notify for the whole backlog.
        await queryRunner.query(`
            UPDATE "follow_up" SET reminded_at = now()
            WHERE reminded_at IS NULL
              AND ((due_date + due_time) AT TIME ZONE 'Asia/Karachi') <= now();
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS follow_up_unreminded_idx ON "follow_up" (due_date)
            WHERE completed = false AND reminded_at IS NULL;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS follow_up_unreminded_idx;`);
        await queryRunner.query(`ALTER TABLE "follow_up" DROP COLUMN IF EXISTS reminded_at;`);
    }
}
