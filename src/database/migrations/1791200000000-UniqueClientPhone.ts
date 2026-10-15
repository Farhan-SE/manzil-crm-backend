import { MigrationInterface, QueryRunner } from 'typeorm';

export class UniqueClientPhone1791200000000 implements MigrationInterface {
    name = 'UniqueClientPhone1791200000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // One client per phone number, however it is written: 0300-1234567, 03001234567 and +92 300 1234567 are the same.
        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS customers_phone_unique
            ON "customers" ((regexp_replace(regexp_replace(contact_number, '[^0-9]', '', 'g'), '^(0092|92|0)', '')));
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS customers_phone_unique;`);
    }
}
