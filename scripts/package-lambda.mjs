// Builds lambda.zip for the client-import Lambda: the compiled app, the RDS CA bundle and only the
// dependencies the import loads. Handler: dist/lambda/customer-import.handler (Node.js 22).
import { execSync } from 'node:child_process';
import { cpSync, existsSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';

const STAGE = '.lambda';
const ZIP = 'lambda.zip';
// Everything the handler's import graph reaches; the rest of the API's dependencies would push the
// package past Lambda's 250 MB unzipped limit.
const LAMBDA_DEPENDENCIES = [
    '@aws-sdk/client-s3',
    '@nestjs/common',
    'csv-parse',
    'dotenv',
    'exceljs',
    'pg',
    'reflect-metadata',
    'rxjs',
    'typeorm',
];
const run = (command, cwd = '.') => execSync(command, { cwd, stdio: 'inherit' });

run('npm run build');
rmSync(STAGE, { recursive: true, force: true });
rmSync(ZIP, { force: true });

for (const path of ['dist', 'certs', 'package-lock.json']) cpSync(path, `${STAGE}/${path}`, { recursive: true });
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const dependencies = Object.fromEntries(LAMBDA_DEPENDENCIES.map((name) => [name, pkg.dependencies[name]]));
writeFileSync(`${STAGE}/package.json`, JSON.stringify({ name: pkg.name, type: pkg.type, dependencies }, null, 2));
// The lockfile keeps the versions the API runs with. No install scripts: nothing here is native.
run('npm install --omit=dev --ignore-scripts --no-audit --no-fund', STAGE);
rmSync(`${STAGE}/package-lock.json`);

// Windows' own bsdtar writes a zip from the .zip name; the GNU tar that Git Bash puts first on PATH writes a tarball.
const zipCommand =
    process.platform === 'win32' ? `"${process.env.SystemRoot}\\System32\\tar.exe" -a -c -f ../${ZIP} *` : `zip -qr ../${ZIP} .`;
run(zipCommand, STAGE);
if (!existsSync(ZIP) || readFileSync(ZIP).subarray(0, 2).toString() !== 'PK') throw new Error(`${ZIP} is not a zip archive`);
console.log(`${ZIP}: ${(statSync(ZIP).size / 1024 / 1024).toFixed(1)} MB`);
