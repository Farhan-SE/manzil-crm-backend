import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCustomerImports1791700000000 implements MigrationInterface {
    name = 'AddCustomerImports1791700000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "customer_import" (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tenant_id UUID NOT NULL REFERENCES "tenant" (id) ON DELETE CASCADE,
                created_by_id INT REFERENCES "user" (id) ON DELETE SET NULL,
                file_key TEXT NOT NULL,
                file_name TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'uploading',
                total_rows INT,
                processed_rows INT NOT NULL DEFAULT 0,
                added INT NOT NULL DEFAULT 0,
                skipped INT NOT NULL DEFAULT 0,
                errors JSONB NOT NULL DEFAULT '[]',
                projects_created JSONB NOT NULL DEFAULT '[]',
                projects_matched JSONB NOT NULL DEFAULT '[]',
                error_message TEXT,
                started_at TIMESTAMPTZ,
                finished_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS customer_import_tenant_status_idx ON "customer_import" (tenant_id, status);`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "customer_import";`);
    }
}
