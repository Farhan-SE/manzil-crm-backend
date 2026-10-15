import { MigrationInterface, QueryRunner } from 'typeorm';

// What an agent could do before roles existed. A snapshot, so later catalogue changes don't rewrite history.
const AGENT_GRANTS: [permission: string, scope: string | null][] = [
    ['leads.view', 'own'], ['leads.edit', 'own'], ['leads.create', null],
    ['customers.view', 'own'], ['customers.edit', 'own'], ['customers.create', null],
    ['payments.view', 'own'], ['payments.record', 'own'],
    ['approvals.view', 'own'], ['disputes.view', 'own'],
];

export class AddRoles1791400000000 implements MigrationInterface {
    name = 'AddRoles1791400000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "role" (
                id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tenant_id   UUID NOT NULL REFERENCES "tenant" (id) ON DELETE CASCADE,
                name        TEXT NOT NULL,
                description TEXT,
                is_system   BOOLEAN NOT NULL DEFAULT false,
                is_default  BOOLEAN NOT NULL DEFAULT false,
                created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
                UNIQUE (tenant_id, name)
            );
        `);
        // The system role's permissions live in code, so it has no rows here.
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "role_permission" (
                role_id    UUID NOT NULL REFERENCES "role" (id) ON DELETE CASCADE,
                permission TEXT NOT NULL,
                scope      TEXT,
                PRIMARY KEY (role_id, permission)
            );
        `);
        await queryRunner.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES "role" (id) ON DELETE RESTRICT;`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS user_role_idx ON "user" (role_id);`);

        await queryRunner.query(`
            INSERT INTO "role" (tenant_id, name, description, is_system)
            SELECT id, 'Admin', 'Full access to everything in the company', true FROM "tenant"
            ON CONFLICT (tenant_id, name) DO NOTHING;
        `);
        await queryRunner.query(`
            INSERT INTO "role" (tenant_id, name, description, is_default)
            SELECT id, 'Agent', 'Works their own leads and clients', true FROM "tenant"
            ON CONFLICT (tenant_id, name) DO NOTHING;
        `);
        for (const [permission, scope] of AGENT_GRANTS) {
            await queryRunner.query(
                `INSERT INTO "role_permission" (role_id, permission, scope)
                 SELECT id, $1, $2 FROM "role" WHERE name = 'Agent' AND is_default
                 ON CONFLICT DO NOTHING;`,
                [permission, scope],
            );
        }

        await queryRunner.query(`
            UPDATE "user" u SET role_id = r.id
            FROM "role" r
            WHERE r.tenant_id = u.tenant_id AND u.role_id IS NULL
              AND ((u.user_role = 'admin' AND r.is_system) OR (u.user_role <> 'admin' AND r.is_default));
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS user_role_idx;`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS role_id;`);
        await queryRunner.query(`DROP TABLE IF EXISTS "role_permission";`);
        await queryRunner.query(`DROP TABLE IF EXISTS "role";`);
    }
}
