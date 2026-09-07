import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserTable1788182819531 implements MigrationInterface {
  name = 'AddUserTable1788182819531';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user" (
        id            SERIAL PRIMARY KEY,
        first_name    TEXT NOT NULL,
        last_name     TEXT NOT NULL,
        email         TEXT NOT NULL UNIQUE,
        password      TEXT NOT NULL,
        user_role     TEXT NOT NULL DEFAULT 'agent',
        blocked       BOOLEAN NOT NULL DEFAULT false,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "user";`);
  }
}
