import { MigrationInterface, QueryRunner } from 'typeorm';

const TENANT_TABLES = [
    'category', 'interest', 'source', 'customers', 'lead', 'follow_up', 'listing', 'location',
    'partner_project', 'unit', 'payment', 'target', 'report_run', 'sales_dispute', 'approval', 'team', 'support_ticket',
];

// Each company counts its own records from 1. Support tickets keep one platform-wide sequence.
const NUMBERED: [table: string, column: string][] = [
    ['approval', 'request_no'], ['customers', 'customer_no'], ['follow_up', 'task_no'], ['lead', 'lead_no'],
    ['location', 'location_no'], ['payment', 'payment_no'], ['sales_dispute', 'case_no'], ['team', 'team_no'],
];

const NAME_UNIQUE = ['category', 'interest', 'source', 'team'];

const PHONE_KEY = `(regexp_replace(regexp_replace(contact_number, '[^0-9]', '', 'g'), '^(0092|92|0)', ''))`;

export class AddTenants1791300000000 implements MigrationInterface {
    name = 'AddTenants1791300000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "tenant" (
                id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name       TEXT NOT NULL,
                slug       TEXT NOT NULL UNIQUE,
                status     TEXT NOT NULL DEFAULT 'active',
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        `);
        // Everything that exists today is Manzil's.
        await queryRunner.query(`INSERT INTO "tenant" (name, slug) VALUES ('Manzil', 'manzil') ON CONFLICT (slug) DO NOTHING;`);
        const [{ id: manzil }] = await queryRunner.query(`SELECT id FROM "tenant" WHERE slug = 'manzil';`);

        await queryRunner.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES "tenant" (id) ON DELETE CASCADE;`);
        await queryRunner.query(`UPDATE "user" SET tenant_id = $1 WHERE tenant_id IS NULL;`, [manzil]);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS user_tenant_idx ON "user" (tenant_id);`);

        for (const table of TENANT_TABLES) {
            await queryRunner.query(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES "tenant" (id) ON DELETE CASCADE;`);
            await queryRunner.query(`UPDATE "${table}" SET tenant_id = $1 WHERE tenant_id IS NULL;`, [manzil]);
            await queryRunner.query(`ALTER TABLE "${table}" ALTER COLUMN tenant_id SET NOT NULL;`);
            await queryRunner.query(`CREATE INDEX IF NOT EXISTS ${table}_tenant_idx ON "${table}" (tenant_id);`);
        }

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "tenant_counter" (
                tenant_id UUID NOT NULL REFERENCES "tenant" (id) ON DELETE CASCADE,
                name      TEXT NOT NULL,
                value     INTEGER NOT NULL,
                PRIMARY KEY (tenant_id, name)
            );
        `);
        // The counter row's lock serialises inserts per company and table, so two rows never get the same number.
        await queryRunner.query(`
            CREATE OR REPLACE FUNCTION assign_tenant_no() RETURNS trigger AS $$
            DECLARE n INTEGER;
            BEGIN
                INSERT INTO "tenant_counter" (tenant_id, name, value) VALUES (NEW.tenant_id, TG_TABLE_NAME, 1)
                ON CONFLICT (tenant_id, name) DO UPDATE SET value = "tenant_counter".value + 1
                RETURNING value INTO n;
                NEW := jsonb_populate_record(NEW, jsonb_build_object(TG_ARGV[0], n));
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        `);

        for (const [table, column] of NUMBERED) {
            await queryRunner.query(`
                INSERT INTO "tenant_counter" (tenant_id, name, value)
                SELECT tenant_id, '${table}', MAX(${column}) FROM "${table}" GROUP BY tenant_id
                ON CONFLICT (tenant_id, name) DO NOTHING;
            `);
            await queryRunner.query(`ALTER TABLE "${table}" ALTER COLUMN ${column} DROP DEFAULT;`);
            await queryRunner.query(`DROP SEQUENCE IF EXISTS ${table}_${column}_seq;`);
            await queryRunner.query(`DROP INDEX IF EXISTS ${table}_${column}_key;`);
            await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS ${table}_tenant_${column}_key ON "${table}" (tenant_id, ${column});`);
            await queryRunner.query(`DROP TRIGGER IF EXISTS ${table}_assign_no ON "${table}";`);
            await queryRunner.query(`
                CREATE TRIGGER ${table}_assign_no BEFORE INSERT ON "${table}"
                FOR EACH ROW EXECUTE FUNCTION assign_tenant_no('${column}');
            `);
        }

        for (const table of NAME_UNIQUE) {
            await queryRunner.query(`ALTER TABLE "${table}" DROP CONSTRAINT IF EXISTS ${table}_name_key;`);
            await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS ${table}_tenant_name_key ON "${table}" (tenant_id, name);`);
        }
        await queryRunner.query(`ALTER TABLE "target" DROP CONSTRAINT IF EXISTS target_period_metric_key;`);
        await queryRunner.query(`ALTER TABLE "target" ADD CONSTRAINT target_tenant_period_metric_key UNIQUE (tenant_id, period, metric);`);
        await queryRunner.query(`DROP INDEX IF EXISTS customers_phone_unique;`);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS customers_phone_unique ON "customers" (tenant_id, ${PHONE_KEY});`);
    }

    // Only safe while Manzil is the sole company: the old global keys can't hold two companies' data.
    public async down(queryRunner: QueryRunner): Promise<void> {
        const [{ count }] = await queryRunner.query(`SELECT COUNT(*)::int AS count FROM "tenant";`);
        if (count > 1) throw new Error('Cannot undo multi-company support while more than one company exists');

        await queryRunner.query(`DROP INDEX IF EXISTS customers_phone_unique;`);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS customers_phone_unique ON "customers" (${PHONE_KEY});`);
        await queryRunner.query(`ALTER TABLE "target" DROP CONSTRAINT IF EXISTS target_tenant_period_metric_key;`);
        await queryRunner.query(`ALTER TABLE "target" ADD CONSTRAINT target_period_metric_key UNIQUE (period, metric);`);
        for (const table of NAME_UNIQUE) {
            await queryRunner.query(`DROP INDEX IF EXISTS ${table}_tenant_name_key;`);
            await queryRunner.query(`ALTER TABLE "${table}" ADD CONSTRAINT ${table}_name_key UNIQUE (name);`);
        }

        for (const [table, column] of NUMBERED) {
            await queryRunner.query(`DROP TRIGGER IF EXISTS ${table}_assign_no ON "${table}";`);
            await queryRunner.query(`DROP INDEX IF EXISTS ${table}_tenant_${column}_key;`);
            await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS ${table}_${column}_key ON "${table}" (${column});`);
            await queryRunner.query(`CREATE SEQUENCE IF NOT EXISTS ${table}_${column}_seq OWNED BY "${table}".${column};`);
            await queryRunner.query(`SELECT setval('${table}_${column}_seq', COALESCE((SELECT MAX(${column}) FROM "${table}"), 0) + 1, false);`);
            await queryRunner.query(`ALTER TABLE "${table}" ALTER COLUMN ${column} SET DEFAULT nextval('${table}_${column}_seq');`);
        }
        await queryRunner.query(`DROP FUNCTION IF EXISTS assign_tenant_no();`);
        await queryRunner.query(`DROP TABLE IF EXISTS "tenant_counter";`);

        for (const table of [...TENANT_TABLES, 'user']) {
            await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN IF EXISTS tenant_id;`);
        }
        await queryRunner.query(`DROP TABLE IF EXISTS "tenant";`);
    }
}
