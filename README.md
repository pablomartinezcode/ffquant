# FFQuant

Private, non-commercial dynasty football research beta. Real nflverse statistics from 1999 onward, Sleeper league context, and an explicitly experimental performance-based valuation model. QB, RB, WR, and TE only.

Private beta: https://ffquant.gabagoober.chatgpt.site · Source and Actions: https://github.com/pablomartinezcode/ffquant

## What works

- Searchable rankings with positional rank, current form, projected PPG, and nonlinear dynasty ratings.
- Player profiles with weekly/seasonal statistics, forecasts, source freshness, model explanations, and published rating history.
- Comparisons of up to four historical player-seasons, including age and career-stage filters.
- Sleeper username/league-ID import, roster selection, free agents, scoring limitations, and league settings.
- Two-sided player/pick trades using underlying value, roster cuts, waiver replacements, and optimal-lineup impact. Picks cover the next three drafts with explicitly provisional curves.
- Checksummed snapshot ingestion into D1/R2, atomic publication, idempotence, and rollback.
- Owner-only chronological regression, boosted-tree, blend, and algorithmic research experiments.

## Run locally

Requires Node 22.13+ with npm; Python 3.12+ for the data pipeline. The production app is a Sites/Vinext Worker with D1 and R2 bindings declared in `.openai/hosting.json`.

```sh
npm run install:ci
npm run dev
```

Keep development on loopback. For local D1 setup, first build with `npm run build`, then apply each SQL file in `drizzle/` in order **once**, using:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_confused_james_howlett.sql
```

Repeat for `0001_orange_apocalypse.sql` and `0002_black_jubilee.sql`. The checked-in real dataset lets the website render immediately; API routes require these migrations. Production migrations are part of Sites publication. Sites publication must use the Sites skill and the existing project ID; do not create a second Site or deploy this project to another host without an explicit decision.

## Refresh data

```sh
python -m pipeline.build
python -m unittest discover -s tests -p 'test_*.py'
python -m pipeline.publish --probe
python -m pipeline.publish --artifacts
```

The builder uses Python's standard library. Raw downloads are cached under ignored `.data-cache/`. It writes the bundled dataset and historical JSON, plus ignored `research/output/` mapping, coverage, and ingestion reports. These are actual statistics; priors are labeled in the product. Player identities use explicit source IDs, never fuzzy name merges. Sleeper's broad active-flag pool includes free agents and unconfirmed identities; it is not a count of current NFL roster spots.

Publication requires environment variables (see `.env.example`): `FFQUANT_BASE_URL`, `FFQUANT_INGEST_TOKEN`, and, for this private Site, `FFQUANT_SITE_AUTH`. The last is the platform's service-access token, sent only in `OAI-Sites-Authorization`. Do not put secrets in source, URLs, shell arguments, screenshots, or workflow logs. The publisher deliberately rejects login redirects.

The GitHub Actions workflow is connected to `pablomartinezcode/ffquant`, its encrypted secrets and variables are configured, and `FFQUANT_PIPELINE_ENABLED=true`. The hosted machine-access probe passed. The first cloud publication must finish successfully before considering the data refresh operational. The Sites source repository is a separate Git service; GitHub runs the scheduler. See [operations](docs/operations.md).

## Validation and research

```sh
node --test tests/core.test.mjs
node node_modules/typescript/bin/tsc --noEmit
python -m unittest discover -s tests -p 'test_*.py'
python -m pip install -r pipeline/requirements.txt
python -m research.experiments
```

Research outputs stay in ignored `research/output/`; they are not public configuration controls. Reports include future-production MAE, Spearman ranking quality, position-specific error, and interval coverage. The initial held-out experiment favored the algorithmic research baseline over ridge, boosted trees, and their blend. This is an offseason PPR research target, not validation of the exact public in-season model or evidence of an advantage over trade-price models.

## Model boundaries

The public baseline uses recency-weighted raw statistical rates, shrinkage toward longer priors, positional age curves, draft priors, and lineup-dependent replacement levels. It values the remainder of the current season plus two future seasons at 0.85 annual discount. Matchup adjustments affect the next-game forecast only. Current form consistently uses PPR; production forecasts use selected supported scoring.

The rating is the inverse of `10000 * (exp(4*(rating-1)/99)-1)/(exp(4)-1)`. Trades use unrounded underlying values; displayed ratings are never summed. Rating change is explicitly a last-game-removed counterfactual, not a fabricated archived daily change. Actual default-scoring ratings are retained on each published snapshot.

The baseline has broad heuristic uncertainty, not a calibrated player-level posterior. Injury availability, future roles, rookies with sparse history, and provisional picks remain material limitations. Historical datasets contain retrospective corrections, and zero-appearance prospects are not yet represented in the research cohort. No model is automatically promoted.

## Scope still requiring follow-through

- Verify the completed cloud publication, subsequent scheduled runs, notification delivery, and daily freshness monitoring.
- Finish user testing on the owner's Sleeper leagues and recruit 5–10 beta managers. Their standard kicker/defense settings are excluded in one scope note; individual special-teams/fumble-recovery rules remain explicitly approximate.
- Add unsuccessful prospects with no NFL statistical appearance; backtest value above replacement, stability, and in-season opportunity changes as separate research targets.
- Calibrate availability and uncertainty, deepen advanced-stat coverage, and research empirical rookie-pick curves.
- Measure hosting/data-job costs before claiming the $100/month target is met.
- Resolve all commercial rights before monetization. See [source inventory](docs/sources.md).

No live scoring, subscriptions, automated trade searching, or account-ownership claims are included. A Sleeper username lookup is public context, not authentication.


## Model 0.2 and league overview

Position-specific continuous aging separates QB passing/rushing. NFL draft-slot cohorts keep early-career evidence after debut and blend it out gradually. Replacement pools exclude stale catalog identities, weight QB roles, and respect the non-QB Superflex alternative. Rankings show a league-scored median ± sample-SD glyph; My league ranks all rosters by total or QB/RB/WR/TE value. See [model research and limitations](docs/model-0.2.md).
