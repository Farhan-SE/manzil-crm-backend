import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddClientCreatedBy1791100000000 implements MigrationInterface {
    name = 'AddClientCreatedBy1791100000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Who added the client. Older clients have no record of it and stay visible through their assignee.
        await queryRunner.query(`ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS created_by_id INTEGER REFERENCES "user" (id) ON DELETE SET NULL;`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "customers" DROP COLUMN IF EXISTS created_by_id;`);
    }
}
