import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import AppDataSource from '../data-source.js';
import { generatePassword } from '../common/password.js';

// Usage: npm run super-admin:create -- <email> <first name> <last name>
// There is no endpoint for this on purpose: the first platform admin can't be created by someone who isn't one.
const [email, firstName, lastName] = process.argv.slice(2);
if (!email || !firstName || !lastName) {
    console.error('Usage: npm run super-admin:create -- <email> <first name> <last name>');
    process.exit(1);
}

// The shared data source logs every query, which would print the password hash.
const db = new DataSource({ ...AppDataSource.options, logging: false });
await db.initialize();
try {
    const [existing] = await db.query(`SELECT id FROM "user" WHERE email = $1`, [email]);
    if (existing) {
        console.error(`A user with the email ${email} already exists`);
        process.exitCode = 1;
    } else {
        const password = generatePassword();
        await db.query(
            `INSERT INTO "user" (first_name, last_name, email, password, user_role, tenant_id)
             VALUES ($1, $2, $3, $4, 'super_admin', NULL)`,
            [firstName, lastName, email, await bcrypt.hash(password, 10)],
        );
        console.log(`Super admin ${email} created. Temporary password (shown once): ${password}`);
    }
} finally {
    await db.destroy();
}
