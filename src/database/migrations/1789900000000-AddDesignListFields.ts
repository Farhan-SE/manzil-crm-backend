import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDesignListFields1789900000000 implements MigrationInterface {
    name = 'AddDesignListFields1789900000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS gender TEXT;`);

        await queryRunner.query(`ALTER TABLE "lead" ADD COLUMN IF NOT EXISTS sold_at TIMESTAMPTZ;`);
        // Leads sold before this column existed have no better record of when than their last edit.
        await queryRunner.query(`UPDATE "lead" SET sold_at = updated_at WHERE stage = 'sold' AND sold_at IS NULL;`);

        await queryRunner.query(`CREATE SEQUENCE IF NOT EXISTS follow_up_task_no_seq;`);
        await queryRunner.query(`ALTER TABLE "follow_up" ADD COLUMN IF NOT EXISTS task_no INTEGER;`);
        // Existing tasks are numbered in the order they were added, not in physical row order.
        await queryRunner.query(`
            UPDATE "follow_up" f SET task_no = n.rn
            FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM "follow_up") n
            WHERE f.id = n.id AND f.task_no IS NULL;
        `);
        await queryRunner.query(`
            SELECT setval('follow_up_task_no_seq', COALESCE((SELECT MAX(task_no) FROM "follow_up"), 0) + 1, false);
        `);
        await queryRunner.query(`
            ALTER TABLE "follow_up"
                ALTER COLUMN task_no SET DEFAULT nextval('follow_up_task_no_seq'),
                ALTER COLUMN task_no SET NOT NULL;
        `);
        await queryRunner.query(`ALTER SEQUENCE follow_up_task_no_seq OWNED BY "follow_up".task_no;`);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS follow_up_task_no_key ON "follow_up" (task_no);`);

        await queryRunner.query(`
            ALTER TABLE "follow_up"
                ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open',
                ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'normal',
                ADD COLUMN IF NOT EXISTS is_starred BOOLEAN NOT NULL DEFAULT false;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "follow_up"
                DROP COLUMN IF EXISTS is_starred,
                DROP COLUMN IF EXISTS priority,
                DROP COLUMN IF EXISTS status,
                DROP COLUMN IF EXISTS task_no;
        `);
        await queryRunner.query(`DROP SEQUENCE IF EXISTS follow_up_task_no_seq;`);
        await queryRunner.query(`ALTER TABLE "lead" DROP COLUMN IF EXISTS sold_at;`);
        await queryRunner.query(`ALTER TABLE "customers" DROP COLUMN IF EXISTS gender;`);
    }
}
