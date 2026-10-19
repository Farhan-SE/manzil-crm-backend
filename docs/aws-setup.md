# AWS setup

What runs on AWS, how each piece was set up in the console, and what has to change before
production. No secrets are recorded here. Passwords and access keys live only in `.env` files and
in the Lambda's environment variables.

## Where things stand (October 2026)

| Piece | Now | Plan |
|---|---|---|
| Frontend | Vercel | stays on Vercel |
| API | Railway (`Dockerfile`), or locally for testing | AWS ECS Fargate + Application Load Balancer |
| Database | **AWS RDS** test instance (Neon is no longer used; its data was dummy and was not migrated) | RDS in the production account |
| Client imports | **S3 + SQS + Lambda** (test) | same, in the production account |

### Accounts and region

- **Test account:** `342572234891`, a "Building Momentum" project on AWS's **Free plan**. This
  project is locked to **Asia Pacific (Sydney) `ap-southeast-2`** by a service control policy,
  so every test resource is in Sydney. It has a credit balance and must **not** be upgraded to
  the Paid plan.
- **Production:** a separate account and region, decided when going live (the earlier choice was
  `us-east-2`, Ohio). Everything below has to be recreated there.
- A budget, `manzil-monthly` ($30 a month with email alerts), watches spending.

```
Browser (Vercel / localhost:3000)
   │  API calls                         │  file upload (presigned POST)
   ▼                                    ▼
 API (local / Railway) ──put job──► SQS manzil-customer-imports ──trigger──► Lambda manzil-customer-import
   │                                    │ after 3 failures                       │      (in the VPC)
   │                                    ▼                                        │
   │                          SQS manzil-customer-imports-dlq        S3 gateway endpoint
   │                                                                             │
   ▼                                                                             ▼
 RDS manzil-crm-db  ◄─────────────── security group manzil-rds-sg ───────────────┘
                                                        S3 manzil-crm-imports-342572234891
```

## RDS PostgreSQL

| Setting | Value |
|---|---|
| Identifier | `manzil-crm-db` |
| Endpoint | `manzil-crm-db.cp0ky6msuhz4.ap-southeast-2.rds.amazonaws.com:5432` |
| Engine | PostgreSQL 18 (created with "Full configuration", Free tier template) |
| Instance | `db.t4g.micro`, Single-AZ |
| Storage | 20 GiB gp2, autoscaling **off** |
| Database name | `manzil_crm` |
| Master user | `manzil_admin` (self-managed password, kept in `.env` only) |
| Network | default VPC `vpc-0c9bcb7b370f4db84`, **public access: Yes** (so a developer machine can connect) |
| Security group | `manzil-rds-sg` (`sg-0bbd8070e35f65d52`) |
| Backups | 1 day. Encryption on. Deletion protection off (test). |
| Monitoring | Database Insights Standard; Enhanced Monitoring and log exports off |

`manzil-rds-sg` inbound rules (port 5432):

| Source | Why |
|---|---|
| The developer's IP `/32` | Local API, migrations, scripts. **If connections start timing out, the ISP changed the IP**: edit the rule and choose *My IP*. |
| `manzil-lambda-sg` (`sg-0d2a7d56776756ef5`) | The import Lambda |

Connecting uses verified TLS with the Amazon CA bundle committed in `certs/`:

```
DATABASE_URL=postgresql://manzil_admin:<password>@manzil-crm-db.cp0ky6msuhz4.ap-southeast-2.rds.amazonaws.com:5432/manzil_crm?sslmode=verify-full&sslrootcert=./certs/rds-global-bundle.pem
```

The database was created empty: all migrations were applied with `npm run migration:run`, and the
platform admin was created with `npm run super-admin:create`. Migration `AddTenants` creates an
empty company named "Manzil" by default.

**Save credits:** when nobody is testing, use RDS → Actions → **Stop temporarily**. RDS starts
itself again after 7 days.

## S3: uploaded spreadsheets

| Setting | Value |
|---|---|
| Bucket | `manzil-crm-imports-342572234891` (general purpose, global namespace) |
| Public access | **all blocked** |
| Encryption | SSE-S3 with bucket key; versioning off |
| Lifecycle rule `delete-imports-after-1-day` | prefix `imports/`; expire objects after 1 day, delete incomplete multipart uploads after 1 day |

CORS, so the browser can post the file directly:

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000"],
    "AllowedMethods": ["POST"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3000
  }
]
```

Add the Vercel domain(s) to `AllowedOrigins` before the deployed frontend can upload.

## SQS

| Queue | Settings |
|---|---|
| `manzil-customer-imports-dlq` | Standard; retention 14 days; SSE-SQS |
| `manzil-customer-imports` | Standard; **visibility timeout 15 min** (must be longer than the Lambda timeout, so a running import isn't handed to a second worker); retention 1 day; dead-letter queue → `manzil-customer-imports-dlq` after **3** receives; SSE-SQS |

Queue URL (the API's `IMPORT_QUEUE_URL`):
`https://sqs.ap-southeast-2.amazonaws.com/342572234891/manzil-customer-imports`

A message in the DLQ means an import's Lambda crashed three times. Its job will also show as
`failed` or stuck. Check the Lambda's CloudWatch logs.

## Lambda

| Setting | Value |
|---|---|
| Name | `manzil-customer-import` (created as an "Event Function", author from scratch) |
| Runtime | Node.js 24.x, **arm64** |
| Handler | `dist/lambda/customer-import.handler` |
| Code | `lambda.zip` from `npm run lambda:package`, uploaded via Code → Update → .zip file |
| Memory / timeout | **1024 MB / 10 min**; ephemeral storage 512 MB |
| Environment | `DATABASE_URL` (the same RDS URL as above), `IMPORT_BUCKET=manzil-crm-imports-342572234891`. **No access keys**: the role provides credentials. |
| Execution role | `PowerUserRole`, assigned automatically by the Free-plan project. It covers S3, SQS, VPC and logs for testing, but is far broader than needed (see the checklist). |
| VPC | `vpc-0c9bcb7b370f4db84`, all three subnets (2a, 2b, 2c), security group `manzil-lambda-sg` only, no IPv6 |
| Trigger | SQS `manzil-customer-imports`; batch size **1**; batch window 0; **maximum concurrency 2** (at most two imports at once, to protect the database) |

Lambda in a VPC has no internet. It doesn't need any:

- RDS is reached inside the VPC.
- S3 is reached through the free **gateway endpoint** `manzil-s3-endpoint`
  (`com.amazonaws.ap-southeast-2.s3`, type *Gateway*, attached to the VPC's main route table
  `rtb-0db8218ce2f64d950`, full-access policy). Don't use the *Interface* type, which is paid.
- SQS messages are delivered by the Lambda service itself, so no SQS endpoint is needed.
- Logs go to CloudWatch through the Lambda service.

`manzil-lambda-sg`: no inbound rules, default outbound (all).

Logs: Lambda → Monitor → View CloudWatch logs.

## IAM user for the local API

`manzil-backend-local` has no console access, only an access key used in the local `.env`
(`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`, created for "Application running outside AWS").
It has two inline policies and nothing else.

`manzil-imports-s3`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ImportFiles",
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject"],
      "Resource": "arn:aws:s3:::manzil-crm-imports-342572234891/imports/*"
    },
    {
      "Sid": "CheckUploads",
      "Effect": "Allow",
      "Action": "s3:ListBucket",
      "Resource": "arn:aws:s3:::manzil-crm-imports-342572234891",
      "Condition": { "StringLike": { "s3:prefix": "imports/*" } }
    }
  ]
}
```

`s3:ListBucket` is there so a missing file reads as "not found" rather than "access denied".
`s3:PutObject` is what the presigned upload form is signed with.

`manzil-imports-sqs`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "QueueImports",
      "Effect": "Allow",
      "Action": "sqs:SendMessage",
      "Resource": "arn:aws:sqs:ap-southeast-2:342572234891:manzil-customer-imports"
    }
  ]
}
```

If the key leaks, deactivate it under the user's Security credentials and create a new one.

## Local `.env` for imports

```
AWS_REGION=ap-southeast-2
AWS_ACCESS_KEY_ID=<manzil-backend-local key>
AWS_SECRET_ACCESS_KEY=<manzil-backend-local secret>
IMPORT_BUCKET=manzil-crm-imports-342572234891
IMPORT_QUEUE_URL=https://sqs.ap-southeast-2.amazonaws.com/342572234891/manzil-customer-imports
```

Leave `IMPORT_QUEUE_URL` out to run imports in the API process instead of the Lambda. Restart the
API after changing `.env`.

## Production checklist

Before going live, in the production account:

- [ ] Choose the region and recreate RDS, S3, SQS, the endpoint, the security groups and the Lambda as above.
- [ ] RDS: **public access off**, sized for production, Multi-AZ if downtime matters, deletion protection on, longer backups.
- [ ] Move the API to ECS Fargate behind an ALB with HTTPS (ACM). Give it a **task role**
      (S3 put/get/list on `imports/*`, SQS send) instead of access keys, and keep secrets in Secrets Manager or SSM.
- [ ] The `Dockerfile` doesn't copy `certs/` into the image yet. Add it, since `DATABASE_URL` points at `./certs/rds-global-bundle.pem`.
- [ ] Replace the Lambda's `PowerUserRole` with a least-privilege role: `AWSLambdaVPCAccessExecutionRole`,
      `s3:GetObject` on the bucket's `imports/*`, and `sqs:ReceiveMessage`, `sqs:DeleteMessage`,
      `sqs:GetQueueAttributes` on the queue.
- [ ] Allow the API's and the Lambda's security groups into the RDS security group, and remove any developer IP rules.
- [ ] Add the production Vercel domain to the bucket's CORS and to the API's `CORS_ORIGINS`.
- [ ] Remove the legacy `POST /customers/import` endpoint.
- [ ] Consider moving the leads and units imports to the same background flow if they get large files.
- [ ] Set up a budget and alerts in the production account.
