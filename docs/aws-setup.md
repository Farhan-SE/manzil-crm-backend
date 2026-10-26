# AWS setup

What runs on AWS, how each piece was set up in the console, and what has to change before
production. No secrets are recorded here. Passwords and access keys live only in `.env` files and
in the Lambda's environment variables.

## Where things stand (October 2026)

| Piece | Now | Plan |
|---|---|---|
| Frontend | Vercel. The AWS test setup is served by `https://manzil-crm-frontend-sooty.vercel.app`, deployed from the fork `sajawal-jutt/manzil-crm-frontend` | stays on Vercel |
| API | **EC2 `manzil-api` behind CloudFront** (test): `https://d2h04c5omwrhgc.cloudfront.net` | AWS ECS Fargate + Application Load Balancer |
| Database | **AWS RDS** test instance (Neon is no longer used; its data was dummy and was not migrated) | RDS in the production account |
| Client imports | **S3 + SQS + Lambda** (test) | same, in the production account |

Railway can't reach the test database: `manzil-rds-sg` only lets in the developer's IP, the Lambda and
the EC2 API, and Railway has no fixed outbound IP. That is why the API moved to EC2.

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
   │  API calls (HTTPS)                 │  file upload (presigned POST)
   ▼                                    ▼
 CloudFront d2h04c5omwrhgc         S3 manzil-crm-imports-342572234891
   │  HTTP :3001, CloudFront IPs only               ▲ reads the file
   ▼                                                │
 EC2 manzil-api (Docker) ──put job──► SQS manzil-customer-imports ──trigger──► Lambda manzil-customer-import
   │                                    │ after 3 failures                       │   (in the VPC, S3 via
   │                                    ▼                                        │    the gateway endpoint)
   │                          SQS manzil-customer-imports-dlq                    │
   ▼                                                                             ▼
 RDS manzil-crm-db  ◄─────────────── security group manzil-rds-sg ───────────────┘
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
| `manzil-api-sg` (`sg-0769cbb073c816f7c`) | The EC2 API |

Because public access is on, RDS has its own Elastic IP, `3.106.20.148`, on a network interface in
`manzil-rds-sg`. It shows up under EC2 → Elastic IPs with no instance. **Never associate it with
anything else**, or the database loses its public address.

Connecting uses verified TLS with the Amazon CA bundle committed in `certs/`:

```
DATABASE_URL=postgresql://manzil_admin:<password>@manzil-crm-db.cp0ky6msuhz4.ap-southeast-2.rds.amazonaws.com:5432/manzil_crm?sslmode=verify-full&sslrootcert=./certs/rds-global-bundle.pem
```

The database was created empty: all migrations were applied with `npm run migration:run`, and the
platform admin was created with `npm run super-admin:create`. Migration `AddTenants` creates an
empty company named "Manzil" by default.

**Save credits:** when nobody is testing, use RDS → Actions → **Stop temporarily** and stop the
EC2 server too (Instance state → Stop). RDS starts itself again after 7 days. Start RDS first when
resuming. If the server comes up before the database, Docker keeps restarting the API container
until its migrations can connect.

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
    "AllowedOrigins": ["http://localhost:3000", "https://manzil-crm-frontend-sooty.vercel.app"],
    "AllowedMethods": ["POST"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3000
  }
]
```

Every frontend address that uploads files must be in `AllowedOrigins`.

Unit and project photos and videos live in the same bucket under `media/<company id>/`. They are
kept until deleted (the 1-day lifecycle rule only covers `imports/`). The bucket stays private: the
CRM and the public share page (`/view/<token>`) show them through presigned links that expire after
15 minutes, and the API checks each upload's first bytes before it is shown. The API needs
`FRONTEND_URL` set to build the share links the chatbot sends.

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

## EC2: the API server

| Setting | Value |
|---|---|
| Name / ID | `manzil-api` / `i-0426a611b88514e75` |
| AMI | Amazon Linux 2023, **arm64** |
| Instance | `t4g.small` (2 vCPU, 2 GiB) with **Standard** credits, so a busy CPU is throttled rather than billed |
| Storage | 20 GiB gp3. User data adds a 2 GiB swap file so the Docker build has room. |
| Network | default VPC, `ap-southeast-2b`, private IP `172.31.36.126` |
| Elastic IP | `15.134.27.141` (named `manzil-api`), so the address CloudFront points at survives a stop/start |
| Security group | `manzil-api-sg`: one inbound rule, TCP **3001** from the prefix list `com.amazonaws.global.cloudfront.origin-facing` (`pl-b8a742d1`). Choose that list, not the `ipv6` one. There is no SSH rule. |
| Key pair | none |
| IAM role | `manzil-api-ec2-role`: `AmazonSSMManagedInstanceCore` (for Session Manager) plus the inline policy `manzil-api-imports` (the S3 and SQS statements of the IAM user below). No access keys on the server. |
| Metadata | IMDSv2 required, hop limit **2**, so the container can reach the role's credentials |
| Termination protection | on |

**Getting a shell:** EC2 → Instances → `manzil-api` → Connect → **SSM Session Manager** (not EC2
Instance Connect, which needs port 22). Then `sudo su - ec2-user`.

The API runs as the Docker container `manzil-api`, built from this repo's `Dockerfile` in
`/home/ec2-user/manzil-crm-backend`. It restarts with the server (`--restart unless-stopped`) and runs
pending migrations each time it starts. Its settings are in that folder's `.env` (mode 600): the same
variables as the local `.env` without the AWS keys, plus `PORT=3001`, `FRONTEND_URL` and
`CORS_ORIGINS` set to the Vercel address. Don't put quotes around values, because Docker's
`--env-file` keeps them as part of the value.

**Deploying a change:** push it to the branch the server has checked out, then on the server:

```bash
~/manzil-crm-backend/scripts/deploy-ec2.sh
```

It pulls, rebuilds the image, replaces the container and prints the last log lines. After editing
`.env`, run it too: `docker restart` does not re-read `.env`. Logs: `docker logs --tail 50 manzil-api`.

The WhatsApp chatbot (`manzil-ai-service`) runs on the same server as the container `manzil-ai`, with
its Redis as `manzil-redis`, all on the Docker network `manzil`. The API reaches it with
`AI_SERVICE_URL=http://manzil-ai:8010` and `AI_SERVICE_KEY` (the chatbot's `SERVICE_API_KEY`). See that
repo's README for its own deploy script.

## CloudFront: HTTPS in front of the API

The frontend is served over HTTPS, so the API has to be too, and there is no custom domain yet.
CloudFront provides `https://d2h04c5omwrhgc.cloudfront.net` with its own certificate.

| Setting | Value |
|---|---|
| Distribution | `manzil-api` (`E11JH91BR80NUN`), pay-as-you-go, no WAF |
| Origin | type *Other*, `ec2-15-134-27-141.ap-southeast-2.compute.amazonaws.com` (CloudFront needs a name, not an IP), **HTTP only**, port **3001**, IPv4 only, no Origin Shield |
| Viewer protocol | Redirect HTTP to HTTPS |
| Methods | GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE |
| Cache policy | **CachingDisabled**. The API answers per user, so nothing may be cached. |
| Origin request policy | **AllViewerExceptHostHeader** (forwards `Authorization`, query strings and the viewer's IP) |

CloudFront appends the visitor's IP to `X-Forwarded-For`, and the API trusts one proxy hop, so the
login rate limits see the real visitor. The "Billing: Missing permissions" warning on the
distribution page only means this user can't view CloudFront billing; it can be ignored.

The frontend's `NEXT_PUBLIC_API_URL` is `https://d2h04c5omwrhgc.cloudfront.net` (no trailing slash).

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
      "Sid": "InventoryMedia",
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::manzil-crm-imports-342572234891/media/*"
    },
    {
      "Sid": "CheckUploads",
      "Effect": "Allow",
      "Action": "s3:ListBucket",
      "Resource": "arn:aws:s3:::manzil-crm-imports-342572234891",
      "Condition": { "StringLike": { "s3:prefix": ["imports/*", "media/*"] } }
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
- [ ] Move the API from the test EC2 server to ECS Fargate behind an ALB with HTTPS (ACM) on a real
      domain. Give it a **task role** with the same permissions as `manzil-api-ec2-role`, and keep
      secrets in Secrets Manager or SSM instead of a `.env` file.
- [ ] Consider AWS WAF on the production entry point (about $14/month for the managed rules).
- [ ] Replace the Lambda's `PowerUserRole` with a least-privilege role: `AWSLambdaVPCAccessExecutionRole`,
      `s3:GetObject` on the bucket's `imports/*`, and `sqs:ReceiveMessage`, `sqs:DeleteMessage`,
      `sqs:GetQueueAttributes` on the queue.
- [ ] Allow the API's and the Lambda's security groups into the RDS security group, and remove any developer IP rules.
- [ ] Add the production Vercel domain to the bucket's CORS and to the API's `CORS_ORIGINS`.
- [ ] Remove the legacy `POST /customers/import` endpoint.
- [ ] Consider moving the leads and units imports to the same background flow if they get large files.
- [ ] Set up a budget and alerts in the production account.
