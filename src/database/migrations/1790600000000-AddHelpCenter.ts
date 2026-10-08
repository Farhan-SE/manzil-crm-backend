import { MigrationInterface, QueryRunner } from 'typeorm';

type Seed = { slug: string; short: string; topic: string; title: string; minutes: number; featured: boolean; body: string };

// A starter set so the Help Center opens with real guidance. Bodies use blank lines between
// paragraphs and "## " for a section heading.
const ARTICLES: Seed[] = [
    {
        slug: 'allocate-or-reassign-a-lead',
        short: 'Lead allocation',
        topic: 'clients_leads',
        title: 'How to allocate or reassign a lead',
        minutes: 2,
        featured: true,
        body: `Assign a lead to the staff member responsible for the client's next action. Reassign it when coverage changes, a staff member is unavailable, or management confirms a new owner.

## Before you begin
Check the client record for duplicate entries and confirm the interested project. Only an admin can change who a lead is allocated to.

## 1. Open the lead
Go to Clients & Leads → Leads. Search by Lead Id or client name, then open the lead.

## 2. Choose the new allocation
Edit the lead and pick the receiving staff member under Assigned to. Keep the project and source unchanged unless the client's requirements have changed.

## 3. Review outstanding tasks
Reassigning a lead moves its todos and tasks with it, because tasks belong to the lead. Open Todos and check nothing is left overdue for the new owner.

If ownership is disputed, raise a Sales Dispute case instead of overwriting the record.`,
    },
    {
        slug: 'search-clients-and-track-stages',
        short: 'Client search and stages',
        topic: 'clients_leads',
        title: 'Search clients and track their stage',
        minutes: 2,
        featured: false,
        body: `The Clients list holds one record per person. A client can have several leads.

## Searching
Pick what to search by — cell number, name, client ID or CNIC — type the value and press Search. Allocated To, Date and Interested Project narrow the list further; More Filters adds City and Source.

## Stages
The tabs count clients at each stage: Inquiry, Prospect, Mature, Pre-Closure and Sold. If the client is yours, click the stage pill on a row to move them.

## Favourites
Use the row menu to add a client to your favourites, then switch on Favourites above the table to see only those.`,
    },
    {
        slug: 'complete-a-follow-up-and-schedule-the-next-task',
        short: 'Follow-ups',
        topic: 'tasks',
        title: 'Complete a follow-up and schedule the next task',
        minutes: 4,
        featured: true,
        body: `Every lead should always have one clear next action.

## Log what happened
Open the lead from Leads and choose Add task. Record the task you just did — a call, WhatsApp, meeting or site visit — and its outcome.

## Schedule what comes next
In the same form choose the next task and give it a deadline. The week view shows how many tasks you already have on each day, so you can pick a realistic date.

## Find what is due
Todos lists open follow-ups by when they fall due: Overdue, Today, Tomorrow and Week. Tick a row, or use its menu, to mark it done.

Choosing Do Nothing or Closed (Won) as the next task ends the sequence, so nothing new is scheduled.`,
    },
    {
        slug: 'work-through-overdue-tasks',
        short: 'Overdue tasks',
        topic: 'tasks',
        title: 'Work through overdue tasks',
        minutes: 2,
        featured: false,
        body: `A task is overdue once its due date and time have passed without it being completed.

## Where to look
Todos opens on the Overdue tab, longest overdue first. Tasks has its own Overdue tab and shows every task with its TSK number.

## Clearing them
Call the client from the row, then mark the task done from its menu. If the plan has changed, complete it and schedule a new task from the lead instead of leaving it open.

The dashboard's "follow-ups need attention" figure is the count of overdue tasks on your leads.`,
    },
    {
        slug: 'find-available-units-and-view-payment-plans',
        short: 'Units and payment plans',
        topic: 'projects_inventory',
        title: 'Find available units and view payment plans',
        minutes: 3,
        featured: true,
        body: `Projects & Inventory → Inv. Primary lists every unit of every project.

## Narrow the list
Filter by project, unit type or unit number, then use the Available tab to see only what can still be sold. The other tabs follow a sale: Token, PDP (partial down payment), CDP (complete down payment) and SCW (sold).

## Booking terms
A project's token amount and its PDP and CDP percentages are shown in the Booking info column on the Projects list. Quote those terms against the unit's price.

## Reserving a unit
A unit moves out of Available when a payment task for it is logged as received against a lead. The lead holding the unit then shows under its status.`,
    },
    {
        slug: 'projects-and-locations',
        short: 'Projects and locations',
        topic: 'projects_inventory',
        title: 'Projects and the locations they sit in',
        minutes: 2,
        featured: false,
        body: `Each project has a city and a location. Locations are created automatically from those two fields, so the Locations list always matches the projects.

## Projects
Use the Active and Inactive tabs to separate what is being marketed now. Star a project to keep it in your favourites.

## Locations
Each location has a LOC number and shows its biggest project, how many projects sit there and how many units are still available. An admin can mark a location inactive from the row menu.`,
    },
    {
        slug: 'staff-allocation-and-team-coverage',
        short: 'Staff allocation',
        topic: 'staff_teams',
        title: 'Understand staff allocation and team coverage',
        minutes: 3,
        featured: false,
        body: `Staff lists everyone with a workspace account.

## What the columns mean
Allocated is the number of leads assigned to the member. Direct is how many of those they brought in themselves. Projects allocated counts the projects those leads span.

## Status
Active members can sign in. A suspended member stays on the register but cannot sign in until the suspension is lifted; a blocked member is locked out.

## Teams
A team groups members under a team lead. Click a team to see each member's allocation in the summary below the table.`,
    },
    {
        slug: 'add-and-update-a-staff-member',
        short: 'Staff records',
        topic: 'staff_teams',
        title: 'Add and update a staff member',
        minutes: 2,
        featured: false,
        body: `Only an admin can add or change staff.

## Adding
Choose Add member on the Staff screen and enter their name, email, role and team. A password is generated and shown once — pass it on securely. They are asked to replace it the first time they sign in.

## Updating
Open the row menu and choose Edit member to set their designation, department, region, office, line manager, joining date and team.

Suspending or blocking a member does not reassign their leads. Review their allocations first.`,
    },
    {
        slug: 'record-a-payment-and-get-it-verified',
        short: 'Recording payments',
        topic: 'accounts_payments',
        title: 'Record a payment and get it verified',
        minutes: 3,
        featured: false,
        body: `Accounts lists every amount a client owes and what has been received against it.

## Recording
Find the transaction, open its menu and choose Record payment. Enter the amount received, the method and the bank reference exactly as it appears on the receipt.

## Verification
A recorded payment shows as Unverified until an admin confirms the receipt with Verify receipt. Only then does it count as Received.

## Statuses
Pending means nothing is due yet. Part paid means some of the amount is still owed. Overdue means the due date has passed with a balance remaining.

Never put passwords or card details in the payment note.`,
    },
    {
        slug: 'track-instalments-and-balances',
        short: 'Instalments and balances',
        topic: 'accounts_payments',
        title: 'Track instalments and balances',
        minutes: 2,
        featured: false,
        body: `The four figures at the top of Accounts summarise the ledger.

Collections this month is everything received since the first of the month. Outstanding receivables is the total still owed across open transactions. Overdue balance is the part of that which is past its due date. Unverified receipts counts payments waiting for an admin to confirm.

Use the Project, Payment Type and Date filters to narrow the table, and Export ledger to download what you see as a spreadsheet.`,
    },
    {
        slug: 'download-sales-and-receivables-reports',
        short: 'Report downloads',
        topic: 'reports_management',
        title: 'Download sales and receivables reports',
        minutes: 5,
        featured: true,
        body: `Reports is available to admins.

## Choosing a report
Pick the period, and optionally a region and project, then press Search. The list is grouped into Sales, Inventory, Collections and Staff.

## Downloading
Press Download on a row to generate and export the report for the chosen period. It is produced fresh each time and saved as a spreadsheet file; the Last generated column records when.

## Targets
Target achievement compares the month's booked sales, completed site visits and collections with the targets set for it. Use Set targets to enter them.`,
    },
    {
        slug: 'review-approval-requests',
        short: 'Approval requests',
        topic: 'reports_management',
        title: 'Review approval requests',
        minutes: 3,
        featured: false,
        body: `Staff raise a request when a booking, a lead allocation or a payment needs management sign-off.

## Raising a request
On Management choose Request approval, pick the type and the lead, and describe what needs approving. You can follow your own requests on the same screen.

## Deciding
Admins see every request. Open Review, add a comment and choose Approve, Return for information or Reject. A returned request can be decided again once the requester has supplied what was missing.

Record the reason whenever you reject or return a request.`,
    },
];

export class AddHelpCenter1790600000000 implements MigrationInterface {
    name = 'AddHelpCenter1790600000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "help_article" (
                id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                slug         TEXT NOT NULL UNIQUE,
                topic        TEXT NOT NULL,
                title        TEXT NOT NULL,
                short_title  TEXT NOT NULL,
                body         TEXT NOT NULL,
                read_minutes INTEGER NOT NULL DEFAULT 2,
                is_featured  BOOLEAN NOT NULL DEFAULT false,
                created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        `);
        for (const article of ARTICLES) {
            await queryRunner.query(
                `INSERT INTO "help_article" (slug, topic, title, short_title, body, read_minutes, is_featured)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 ON CONFLICT (slug) DO NOTHING`,
                [article.slug, article.topic, article.title, article.short, article.body, article.minutes, article.featured],
            );
        }

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "help_article_feedback" (
                article_id UUID NOT NULL REFERENCES "help_article" (id) ON DELETE CASCADE,
                user_id    INTEGER NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
                helpful    BOOLEAN NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                PRIMARY KEY (article_id, user_id)
            );
        `);

        await queryRunner.query(`CREATE SEQUENCE IF NOT EXISTS support_ticket_ticket_no_seq;`);
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "support_ticket" (
                id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                ticket_no       INTEGER NOT NULL DEFAULT nextval('support_ticket_ticket_no_seq'),
                user_id         INTEGER REFERENCES "user" (id) ON DELETE SET NULL,
                category        TEXT NOT NULL,
                topic           TEXT NOT NULL,
                contact_name    TEXT NOT NULL,
                reply_email     TEXT NOT NULL,
                subject         TEXT NOT NULL,
                details         TEXT NOT NULL,
                related_record  TEXT,
                steps           TEXT,
                impact          TEXT,
                preferred_contact TEXT,
                status          TEXT NOT NULL DEFAULT 'open',
                created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        `);
        await queryRunner.query(`ALTER SEQUENCE support_ticket_ticket_no_seq OWNED BY "support_ticket".ticket_no;`);
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "support_ticket_attachment" (
                id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                ticket_id  UUID NOT NULL REFERENCES "support_ticket" (id) ON DELETE CASCADE,
                filename   TEXT NOT NULL,
                mime_type  TEXT NOT NULL,
                size       INTEGER NOT NULL,
                data       BYTEA NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "support_ticket_attachment";`);
        await queryRunner.query(`DROP TABLE IF EXISTS "support_ticket";`);
        await queryRunner.query(`DROP SEQUENCE IF EXISTS support_ticket_ticket_no_seq;`);
        await queryRunner.query(`DROP TABLE IF EXISTS "help_article_feedback";`);
        await queryRunner.query(`DROP TABLE IF EXISTS "help_article";`);
    }
}
