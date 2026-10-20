# Client import

Companies add clients in bulk from a `.csv` or `.xlsx` spreadsheet. Production is expected to see
files of 50,000 clients, so the import runs in the background: the browser uploads the file straight
to S3, a worker adds the clients, and the page shows progress.

## Why it was rebuilt

The first version added clients one row at a time inside the HTTP request. Each row cost three to
five database round trips (a duplicate-phone check, then `BEGIN` / `INSERT` / `COMMIT`, plus a
project insert when needed). From Pakistan to the database, one round trip takes about 270 ms, so:

| Rows | Row-by-row import |
|---|---|
| 14 | 10–12 s (measured) |
| 50,000 | ~15 hours (estimated) |

The database itself was never the problem: it inserts 1,000 clients in about 100 ms. The number
of round trips was.

The rebuild came in two phases:

1. **Batching**: a whole file takes a handful of queries instead of several per row.
2. **Background jobs**: the file goes to S3, and a job processes it outside the request. The
   worker is an AWS Lambda fed by SQS. Without a queue configured, the API process runs it instead.

## What the import does

For each row it reads (header names are case-insensitive, and columns can be in any order):

| Field | Accepted headers |
|---|---|
| Name | `name`, `full name`, `customer`, `customer name`, `client name` |
| Phone | `phone`, `number`, `mobile`, `contact`, `phone number`, `whatsapp` |
| CNIC | `cnic`, `nic`, `id`, `id card` |
| Alternate phone | `alt phone`, `alternate phone`, `phone 2`, `landline` |
| Email | `email`, `email address` |
| Address | `address`, `street` |
| City | `city` |
| Type | `type`, `customer type` (`buyer`, `seller` or `investor`; anything else becomes `buyer`) |
| Customer since | `since`, `customer since`, `date` |
| Source | `source`, `lead source` (matched to the company's sources by name) |
| Notes | `notes`, `remarks`, `comments` |
| Project | `project`, `project name` |

Rules:

- **Name and phone are required.** A row missing either is skipped with "Missing name or phone".
- **Duplicate phones are skipped, never updated.** Phones are compared by their national digits,
  so `0300-1234567`, `03001234567` and `+92 300 1234567` are the same number. A phone that
  already belongs to one of the company's clients, or appears earlier in the same file, is skipped
  with "Duplicate phone …". Phones are unique per company, not across companies.
- **Projects are matched by name**, allowing for case, punctuation, spacing and small typos
  ("Park Viw" joins "Park View"). Numbers and single letters must agree, so "Phase 1" and
  "Phase 2", or "Tower A" and "Tower B", stay apart. A name close to nothing becomes a new project,
  and later rows spelling it differently join that new project. The result lists the projects
  created and the misspellings that were matched.
- **The country comes from the phone's calling code** (`+971 …` → UAE, `00966 …` → Saudi Arabia),
  like the client form. A number without a code, such as `0300…`, is Pakistani.
- **No leads are opened**, unlike adding a client from the form.
- Fully blank rows are ignored. Row numbers in errors match the spreadsheet (row 1 is the header).

## How it runs

```
Browser ──1. POST /customers/imports {file_name}──────► API: creates job (status "uploading"),
                                                        returns a presigned S3 upload form
Browser ──2. POST file (multipart form) ──────────────► S3: imports/<tenantId>/<uuid>.csv|.xlsx
Browser ──3. POST /customers/imports/:id/start ───────► API: checks the file is in S3, sets "queued",
                                                        sends {jobId} to SQS
SQS ──────4. message ─────────────────────────────────► Lambda: claims the job ("processing"),
                                                        reads the file from S3, imports it in batches,
                                                        updates progress after every 1,000 rows,
                                                        then "completed" or "failed"
Browser ──5. GET /customers/imports/:id every 2 s ────► API: progress and, at the end, the result
```

When `IMPORT_QUEUE_URL` is not set, step 4 runs inside the API process right after `start`
replies. Everything else is the same, so local development needs only the S3 bucket.

### Job states

`uploading` → `queued` → `processing` → `completed` | `failed`

- **uploading**: the job exists and the browser is uploading. `start` refuses until the file is in S3.
- **queued**: waiting for a worker.
- **processing**: a worker claimed it. `total_rows` is known once the file is read, and
  `processed_rows` grows after each batch.
- **completed**: `added`, `skipped`, the first 100 `errors`, `projects_created` and
  `projects_matched` are filled in.
- **failed**: `error_message` says why. A file that can't be read ("That file could not be read
  as an Excel workbook.") shows its own message; an unexpected error shows a generic one, and the
  details go to the Lambda's CloudWatch logs.

### Safety

- **One import per company at a time.** Starting a second while one is queued or processing
  returns 409 "Another import is still running."
- **A job runs once even if SQS delivers it twice.** The worker claims it with a conditional
  `UPDATE … WHERE status = 'queued'`; a second delivery finds nothing to claim. A job stuck in
  `processing` for over 20 minutes (a crashed worker) can be claimed again, and re-running it is
  harmless because clients are inserted with `ON CONFLICT DO NOTHING`.
- **All or nothing.** Projects and clients are written in one transaction. A failure halfway
  leaves no half-imported file.
- **Concurrent adds are handled.** A phone someone adds by hand mid-import hits the unique index,
  is skipped by `ON CONFLICT DO NOTHING`, and is reported as a duplicate.
- **Company isolation.** Every query carries the job's `tenant_id`. The S3 key includes the
  tenant, and the API never returns `file_key` or `tenant_id`.
- **Upload limits.** The presigned form only accepts 1 byte to 20 MB and expires after 15 minutes.
  Only `.csv` and `.xlsx` names are accepted.
- Uploaded files are deleted by an S3 lifecycle rule after 1 day.

## API

All routes need a logged-in user whose role has `customers.import`, and act within their company.

| Method & path | Body / response |
|---|---|
| `POST /customers/imports` | Body `{ "file_name": "clients.xlsx" }`. Returns `{ job, upload: { url, fields } }`. Post `fields` and then the file (last) as multipart form data to `url`. |
| `POST /customers/imports/:id/start` | Returns the job, now `queued`. 400 if the file isn't uploaded yet, 409 if another import is running. Calling it again on a started job just returns the job. |
| `GET /customers/imports/:id` | The job, with progress or result |
| `GET /customers/imports/active` | `{ job }`: the company's queued or processing import, or `{ job: null }`. The object wrapper is deliberate, because Nest sends a bare `null` as an empty body, which isn't valid JSON. |
| `POST /customers/import` | **Legacy** synchronous import (multipart `file`, 5 MB). The frontend no longer uses it. Remove it before production. |

Job fields returned: `id, file_name, status, total_rows, processed_rows, added, skipped, errors,
projects_created, projects_matched, error_message, created_by_id, started_at, finished_at,
created_at, updated_at`.

## Code map

| File | Role |
|---|---|
| `src/customer/customer-import.ts` | Pure logic, no database: header aliases, phone normalisation, `readClientRows` (rows → drafts, in-file duplicates), `assignProjects` (fuzzy project matching). Unit-tested in `customer-import.spec.ts`. |
| `src/common/fuzzy-name.ts` | `closestName`: the project-name matcher |
| `src/common/csv.ts` | `parseSpreadsheet`: reads `.csv` or the first sheet of an `.xlsx` into rows keyed by lowercased header |
| `src/customer/import-clients.ts` | `importClients(db, buffer, { tenantId, createdById, onProgress })`: the batched import. Shared by the API and the Lambda, so it takes the company explicitly instead of from the request. |
| `src/customer/process-import.ts` | `processImport(db, jobId, readFile)`: claims a job, runs `importClients`, records the outcome |
| `src/customer/customer-import.entity.ts` | `CustomerImport` entity (`customer_import` table) |
| `src/customer/customer-import.service.ts` / `.controller.ts` | The `/customers/imports` endpoints. Decides between SQS and running in-process. |
| `src/customer/import-files.ts` | S3 client: `uploadExists`, `readUpload` (the only AWS code the Lambda loads) |
| `src/customer/import-aws.ts` | Presigned upload form and `enqueueImport` (API only) |
| `src/lambda/customer-import.ts` | Lambda handler: one SQS record per job, reuses its database connection while warm |
| `src/database/migrations/1791700000000-AddCustomerImports.ts` | Creates `customer_import` |
| `scripts/package-lambda.mjs` | Builds `lambda.zip` |

### How the batching works

`importClients` makes these round trips for a whole file, whatever its size:

1. Load the company's sources and projects (2 queries, run in parallel).
2. Check every phone in the file against existing clients in **one** query
   (`normalized_phone = ANY($1)`, served by the `customers_phone_unique` index on
   `(tenant_id, normalized phone)`).
3. Match project names in memory, then insert all new projects in **one** `INSERT`.
4. Insert clients **1,000 per statement** (14 values each, under Postgres's 65,535-parameter limit)
   with `ON CONFLICT DO NOTHING RETURNING contact_number`, reporting any row not returned as a
   duplicate. After each chunk, `onProgress` updates the job.

A bigger chunk (4,000) was tried and was slower over a long-distance link, so 1,000 stays.

## Performance (measured 2026-10-19)

| Setup | 14 rows | 5,000 rows | 50,000 rows |
|---|---|---|---|
| Old row-by-row, API in Pakistan → RDS in Sydney | 10–12 s | — | ~15 h (est.) |
| Batched, API in Pakistan → RDS in Sydney | ~4 s | ~7 s | ~82 s |
| Batched, Lambda in Sydney → RDS in Sydney | — | — | 3,000 rows in under 2 s |

From Pakistan nearly all the time is network: about 2.3 s to open a TLS connection, plus about
270 ms per round trip. Next to the database, each round trip takes about 1 ms.

## Frontend

In `manzil-crm-frontend`:

- `components/ImportCsvModal.tsx`: for clients, uploads with `startCustomerImport` and closes as
  soon as the job starts. Leads and units still use the old synchronous import.
- `components/ImportProgress.tsx`: a card in the bottom-right corner of every dashboard page. It
  shows "Importing clients" with a progress bar, then "Import finished" (added · skipped, with
  **View details**) or "Import failed". It polls every 2 s while running, and on load picks up the
  company's active import, or this tab's last one if it finished during a reload.
- `lib/customer-import.ts`: browser events (`started`, `finished`) so the modal, the card and the
  clients page stay in sync. The clients list reloads when an import finishes.
- `lib/api.ts`: `startCustomerImport`, `getCustomerImport`, `getActiveCustomerImport`.

## Deploying the Lambda

The Lambda runs the compiled code from this repo, so **any change to the import code needs a new
upload**. Otherwise the Lambda keeps running the old version.

```bash
npm run lambda:package     # builds lambda.zip (~24 MB) in the repo root
```

Then in the AWS console: Lambda → `manzil-customer-import` → Code → **Update → .zip file** →
choose `lambda.zip` → Update.

The package holds `dist/`, `certs/` and only the dependencies the handler loads (TypeORM, pg,
exceljs, csv-parse, the S3 client, and a few more), with install scripts skipped. Nothing the
import loads is native, so a zip built on Windows runs on Lambda's Linux arm64. If the import
starts loading a new package, add it to `LAMBDA_DEPENDENCIES` in `scripts/package-lambda.mjs`.

The handler is `dist/lambda/customer-import.handler`. Lambda settings are listed in
[aws-setup.md](aws-setup.md#lambda).

### Testing the Lambda by hand

Lambda → Test, with this event:

```json
{ "Records": [ { "body": "{\"jobId\":\"00000000-0000-0000-0000-000000000000\"}" } ] }
```

It should succeed with `null`: the code loaded, it reached the database, and it ignored an unknown
job. "Task timed out" means it can't reach RDS (check the security groups).

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Job stays `queued` | `IMPORT_QUEUE_URL` is set but the SQS trigger is off, or the Lambda is failing. Check the Lambda's Monitor → CloudWatch logs and the `manzil-customer-imports-dlq` queue. |
| Upload fails in the browser | S3 CORS doesn't list the frontend's origin, or the file is over 20 MB |
| "The file has not finished uploading" | `start` was called before the upload finished, or the backend IAM user lacks `s3:ListBucket` (S3 then reports a missing file as access denied) |
| Job `failed` with a generic message | Unexpected error: see the CloudWatch logs (Lambda) or the API console (in-process) |
| Old behaviour after a code change | The Lambda wasn't re-uploaded |
