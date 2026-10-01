import { MigrationInterface, QueryRunner } from 'typeorm';

export class LinkUnitsAndLeads1789700000000 implements MigrationInterface {
    name = 'LinkUnitsAndLeads1789700000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // lead.unit_id: the unit the lead is interested in. unit.lead_id: the lead that has paid for it.
        await queryRunner.query(`ALTER TABLE "lead" ADD COLUMN IF NOT EXISTS unit_id UUID;`);
        await queryRunner.query(`ALTER TABLE "unit" ADD COLUMN IF NOT EXISTS lead_id UUID;`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "unit" DROP COLUMN IF EXISTS lead_id;`);
        await queryRunner.query(`ALTER TABLE "lead" DROP COLUMN IF EXISTS unit_id;`);
    }
}
