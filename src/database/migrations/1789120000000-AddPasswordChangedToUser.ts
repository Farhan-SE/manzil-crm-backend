import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPasswordChangedToUser1789120000000 implements MigrationInterface {
    name = 'AddPasswordChangedToUser1789120000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "user" ADD COLUMN IF NOT EXISTS password_changed BOOLEAN NOT NULL DEFAULT false;
        `);
        // Everyone who already has an account chose their own password — don't push them
        // through the first-login flow. Only users created from here on start at false.
        await queryRunner.query(`UPDATE "user" SET password_changed = true;`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS password_changed;`);
    }
}
