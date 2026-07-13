# Data imports

One-off historical data loads (not schema migrations, not seed). Each file is
idempotent and guarded so re-running is safe.

## `2026-07-03_timesheet_import.sql`

Backfill of Sean's historical hours from the Google Sheet **"TimeSheet"**
(`1zpjZf7WGYxR1BYioLkORomzW5kJQ3rEuoGd5sirtcok`, owner `aui.svi@gmail.com`).

- **Source:** monthly detail tabs (Nov 2025 → Jul 2026), columns
  `Start Time, End Time, Total, Comp, Description`. Every row is a flat
  ₪150/hour entry (validated: `Comp ÷ hours = 150` on all 253 rows).
- **Loaded:** client **Glocod** (ILS, hourly); 5 inferred work streams
  (Ingestion Engine, Meetings, Frontend, Data Sources, DevOps & Deploy —
  classified from descriptions by keyword); 9 monthly invoices
  (`CRESTE-2025-001/002`, `CRESTE-2026-001…007`, status `issued`, which locks
  the entries from re-billing); **253 `time_entries`** with
  `bill_rate = cost_rate = 150` snapshotted, `billable = true`, each stamped
  with its month's `invoice_id`, `created_by` = Sean's auth id.
- **Totals:** 951 hours, ₪142,650 — reconciled per-month against the sheet.
- **Not done:** payments (₪79,580 received) are not reconciled — invoices are
  `issued`, not `paid`. `cost_rate` set to ₪150 per Sean (founder rate).

Run with:
`psql "<connection>" -v ON_ERROR_STOP=1 -f supabase/imports/2026-07-03_timesheet_import.sql`
