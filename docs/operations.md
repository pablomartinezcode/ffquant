# FFQuant beta operations

## Publication contract

`GET /api/ingest` requires the application ingestion bearer token; it verifies DB/R2 bindings. A private hosted Site additionally requires platform service access. A valid probe must return JSON `{ready:true,protocol:1}` rather than sign-in HTML. Run this checkpoint before enabling any scheduler.

`POST /api/ingest` accepts `begin`, `players`, `artifact`, `publish`, and `rollback`. Begin fixes the manifest/checksum inventory. Player batches contain canonical JSON strings; artifacts contain their exact JSON text. SHA-256 checksums and expected counts must match before publication. Published records are immutable. D1 commits the completed state and official pointer atomically. Interrupted staging does not change readers; rerunning resumes idempotently. R2 objects are version-prefixed.

Rollback: send `{action:"rollback",id:"<previous ready snapshot ID>"}` through the same authenticated endpoint. Only a ready snapshot can become official. No public model-tuning or write endpoint exists. Current and previous snapshot IDs live in `active_snapshot`; audit events record publication and imports. Keep at least the current and previous snapshots. Do not automatically delete research/source backups.

## Scheduler setup

1. Put this source in the intended private GitHub repository. Sites source hosting alone does not run Actions.
2. Set repository variable `FFQUANT_BASE_URL` to the verified Site origin.
3. Set repository secrets `FFQUANT_INGEST_TOKEN` and `FFQUANT_SITE_AUTH` through secret-management UI/API. The values must match the Site's runtime app token and platform machine-access token. Never commit them.
4. Set variable `FFQUANT_PIPELINE_ENABLED=true` after a hosted probe and full writer/readback succeed.
5. Dispatch `Refresh NFL data`, inspect success, then inspect the next scheduled run. Confirm GitHub Actions failure notifications for the owner. No notification delivery is assumed until verified.

The workflow checks every six hours September–February and daily March–August. Source changes trigger a new content-addressed snapshot; unchanged inputs reuse the ready version. Historical corrections also change the fingerprint. A successful scheduler run cannot make an upstream dataset fresher.

`GET /api/health` reports `status`, `snapshotId`, `sourceUpdatedAt`, `ageHours`, and `modelVersion`. More than 36 hours without fresh source statistics is stale. During offseason or a normal upstream publication gap this can be expected; diagnose against the source schedule. Configure owner-only daily monitoring and escalation after repeated failures when the scheduler is connected. Alerting is not silently treated as enabled by the included workflow.

## Validation checklist for 5–10 beta managers

- Import real 1QB and Superflex leagues; reconcile starters, scoring, original/current pick owners, IR/taxi exclusions, unsupported K/DST/IDP, and roster capacity.
- Verify current/historical players, rookies, injured players, free agents, byes, team changes, empty results, and unmapped identities. Fix identities only with evidence.
- Enter two-sided trades, swap sides, test duplicate rejection, and review roster cuts/waiver suggestions. IR/taxi movement requires eligibility logic and is currently rejected in league-aware trades.
- Check unsupported scoring explanations, failed Sleeper imports, stale cache fallback, narrow screens, keyboard focus, chart labels, and profile dismissal.
- Measure import and calculator latency, mapping coverage, explanation usefulness, and actual monthly platform usage.

## Backup and recovery

Keep source commits and versioned artifacts. GitHub job report artifacts are retained 14 days; source snapshots remain cached locally and published projections/history remain versioned in R2/D1. Export D1 and R2 through the hosting provider's supported export tools before destructive infrastructure changes; there is no automated off-platform database backup yet. Local research JSON and Parquet files are ignored by Git and must be backed up separately when needed.

The spend target is less than $100/month, not a verified quote. Do not promise cost limits without checking the user's actual Sites/Cloudflare/GitHub plan and measured storage/request volumes.
