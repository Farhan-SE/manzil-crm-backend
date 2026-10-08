import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameLeadStages1790000000000 implements MigrationInterface {
    name = 'RenameLeadStages1790000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Leads move onto the same five stages clients use. Lost leads keep their stage; it just has no board column.
        await queryRunner.query(`
            UPDATE "lead" SET stage = CASE stage
                WHEN 'contacted' THEN 'prospect'
                WHEN 'site_visit' THEN 'mature'
                WHEN 'negotiation' THEN 'pre_closure'
                WHEN 'booked' THEN 'pre_closure'
                ELSE stage
            END
            WHERE stage IN ('contacted', 'site_visit', 'negotiation', 'booked');
        `);

        await queryRunner.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS region TEXT;`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS region;`);

        // Negotiation and booked were merged going up, so both come back as negotiation.
        await queryRunner.query(`
            UPDATE "lead" SET stage = CASE stage
                WHEN 'prospect' THEN 'contacted'
                WHEN 'mature' THEN 'site_visit'
                WHEN 'pre_closure' THEN 'negotiation'
                ELSE stage
            END
            WHERE stage IN ('prospect', 'mature', 'pre_closure');
        `);
    }
}
