import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInventoryMedia1792100000000 implements MigrationInterface {
    name = 'AddInventoryMedia1792100000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS inventory_media (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tenant_id UUID NOT NULL,
                project_id UUID REFERENCES partner_project(id) ON DELETE CASCADE,
                unit_id UUID REFERENCES unit(id) ON DELETE CASCADE,
                kind TEXT NOT NULL,
                mime TEXT NOT NULL,
                size_bytes INT NOT NULL,
                file_key TEXT NOT NULL,
                file_name TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'uploading',
                created_by_id INT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                CHECK ((project_id IS NULL) <> (unit_id IS NULL))
            );
        `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS inventory_media_project ON inventory_media (tenant_id, project_id);`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS inventory_media_unit ON inventory_media (tenant_id, unit_id);`);
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS media_share (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tenant_id UUID NOT NULL,
                unit_id UUID NOT NULL REFERENCES unit(id) ON DELETE CASCADE,
                lead_id UUID,
                token_hash TEXT NOT NULL UNIQUE,
                expires_at TIMESTAMPTZ NOT NULL,
                revoked_at TIMESTAMPTZ,
                open_count INT NOT NULL DEFAULT 0,
                last_opened_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS media_share_lead ON media_share (tenant_id, lead_id);`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS media_share;`);
        await queryRunner.query(`DROP TABLE IF EXISTS inventory_media;`);
    }
}
