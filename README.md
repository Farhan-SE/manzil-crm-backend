# Manzil CRM — Backend

NestJS API for Manzil CRM, a multi-company (multi-tenant) real-estate CRM. Every company's data
lives in one PostgreSQL database, separated by `tenant_id`. The frontend is a separate Next.js app
(`manzil-crm-frontend`, deployed on Vercel).

## Documentation

| Doc | What it covers |
|---|---|
| [docs/client-import.md](docs/client-import.md) | How client imports work: batching, the background job, S3 → SQS → Lambda, endpoints, performance numbers |
| [docs/aws-setup.md](docs/aws-setup.md) | Every AWS resource the app uses, how each was set up in the console, and the production checklist |

## Requirements

- Node.js 22 or newer, npm 11
- A PostgreSQL database (the test environment uses AWS RDS PostgreSQL 18; see [docs/aws-setup.md](docs/aws-setup.md))
- For client imports: an S3 bucket, and optionally an SQS queue with the import Lambda

## Setup

```bash
npm install
# create .env with the variables below
npm run migration:run  # builds, then applies every migration in src/database/migrations
npm run super-admin:create -- you@example.com First Last   # prints a one-time temporary password
npm run start:dev
```

The API listens on `PORT` (default `3001`).

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string. For RDS use `?sslmode=verify-full&sslrootcert=./certs/rds-global-bundle.pem` — the Amazon CA bundle is committed in `certs/`. |
| `JWT_SECRET` | yes | Signs login tokens |
| `PORT` | no | Defaults to `3001` |
| `CORS_ORIGINS` | no | Comma-separated extra origins allowed to call the API |
| `FRONTEND_URL` | yes for email | Base URL used in password-reset emails |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | yes for email | Outgoing mail |
| `AWS_REGION` | for imports | `ap-southeast-2` in the test environment |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | locally, for imports | Keys of the `manzil-backend-local` IAM user. Not used on AWS, where the task role provides credentials. |
| `IMPORT_BUCKET` | for imports | S3 bucket that receives uploaded spreadsheets |
| `IMPORT_QUEUE_URL` | no | SQS queue for imports. **When unset, the API runs imports in its own process** — handy for local development without the Lambda. When set, imports are queued and the Lambda runs them. |

Never commit `.env`.

## Scripts

| Command | What it does |
|---|---|
| `npm run start:dev` | API in watch mode |
| `npm run build` | Compile to `dist/` |
| `npm test` | Unit tests (vitest) |
| `npm run lint` | oxlint |
| `npm run migration:run` | Build, then apply pending migrations to `DATABASE_URL` |
| `npm run migration:revert` | Undo the last migration |
| `npm run super-admin:create -- <email> <first> <last>` | Create the first platform admin (there is deliberately no endpoint for this) |
| `npm run lambda:package` | Build `lambda.zip` for the client-import Lambda (see [docs/client-import.md](docs/client-import.md#deploying-the-lambda)) |

## Project layout

```
src/
  access/            roles, permissions and own/team/all scopes
  auth/              login, users, password reset
  tenants/           companies; tenant-context.ts scopes every request to one company
  customer/          clients, including the import (see docs/client-import.md)
  leads/ units/ partner-projects/ ...   the other CRM modules
  lambda/            AWS Lambda entry points (customer-import.ts)
  database/migrations/
  data-source.ts     TypeORM data source used by migrations, scripts and the Lambda
certs/               Amazon RDS CA bundle for verified TLS
scripts/             package-lambda.mjs
```

## Deployment

Today the API runs on Railway from the `Dockerfile` (it runs pending migrations on start). The
plan is to move it to AWS ECS Fargate next to the database; see the production checklist in
[docs/aws-setup.md](docs/aws-setup.md#production-checklist).
