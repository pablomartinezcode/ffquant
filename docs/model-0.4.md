# Baseline 0.4: opportunity, efficiency and weekly history

The purpose of this revision is lower single-game sensitivity without freezing
weekly rankings. There are no player-specific overrides or rank caps.

## Forecasts

The prior uses the most recent 17 statistical appearances in the previous two
seasons. Fewer than eight old appearances blend with available draft-cohort or
position priors rather than treating one old relief performance as established.
No-history rookies retain draft priors. Raw historical stats are never changed.

| Component | Current season | Future-season base |
|---|---:|---:|
| Opportunity prior, equivalent games | 4 | 8 |
| Current appearance half-life | 4 | 8 |
| Yardage/catch/first-down rate prior, equivalent games of exposure | 8 | 12 |
| TD/interception rate prior, equivalent games of exposure | 16 | 24 |
| Two-point conversion/fumble prior, equivalent games | 16 | 24 |

Opportunity means passing attempts, carries and targets. Projected yards, catches,
touchdowns and first downs equal projected opportunity times a shrunk rate.
Rates use weighted numerator/denominator pairs only when both are observed.
Prior exposure is at least a small position-specific floor so one new carry or
target cannot create an extreme rate. An incomplete prior without exposure keeps
the direct metric estimate. Future forecasts still blend early-career draft
cohorts and then apply existing age, role, replacement and discount adjustments.

These strengths are versioned assumptions, not fitted optimal parameters.
Current form, last-game counterfactuals and raw scoring spread remain separate:
form is descriptive PPR; spread is the unmodified sample median and SD; the
counterfactual reruns this model without the latest appearance under today's
scoring/replacement/role assumptions. It is not last week's archived rating.

## Diagnostic evidence

`python -m research.smoothing_audit` predicts the next four observed appearances
within eight weeks at 2025 weeks 1, 4, 8 and 12. All historical players are eligible;
there is no current-roster selection. Priors are draft-blind to avoid future cohort
information. Outcomes are conditional on four observed future appearances, so
this is not an availability or full dynasty-value backtest. Cutoffs repeat players.

| Position | Observations | Old PPR MAE | Revised current-season MAE |
|---|---:|---:|---:|
| QB | 128 | 4.0089 | 3.9199 |
| RB | 342 | 3.1317 | 3.1464 |
| WR | 556 | 2.7901 | 2.8289 |
| TE | 287 | 2.3196 | 2.3510 |

The accuracy result is mixed, not evidence of an across-position improvement.
No smoothing strength was optimized on these diagnostic outcomes. The slower
future forecast is not expected to beat the current forecast on a four-game
target. Full future-value and uncertainty validation remain research work.

## Immutable ranking observations

Migration 0003 adds `ranking_history`. On publication, the server calculates
all current players under two canonical formats: 12-team PPR, no TE premium,
standard lineup with either 1QB or Superflex. Every row stores overall rank,
position rank, unrounded FFQ Rating/value/PPG, full configuration, data season,
statistical through-week, snapshot ID and build timestamp. Snapshot manifests
retain model version, source timestamps, checksums and source provenance.

The key `(snapshot_id, format, player_id)` makes retries idempotent. Counts must
match before the snapshot becomes ready and the active pointer changes. Staging
history is invisible. Prior revisions are retained; correction jobs do not erase
the earlier observations. Existing `rating_history` publication data is retained.

`GET /api/player/:id/ratings?format=1qb|sf` returns one complete universe
publication per season/statistical week, then selects the player. Thus a player
removed in a later revision cannot silently retain an earlier rank for that week.
The API returns up to 156 recorded weeks. Rank change compares consecutive weeks
only, and flags model changes. A week with no observations has no fabricated delta.
`statsThroughWeek` comes from actual statistical coverage, not Sleeper's current
calendar week. An in-progress week's entry may change as more data arrives.

Tracking starts with 0.4 publications. We do not claim backfilled older ranks were
known historically. Custom league scoring is not represented by these canonical
archives; profiles explicitly label their separate archive configuration.

Scheduled six-hour refreshes already run through GitHub Actions. Each completed
publication automatically records rankings. No additional schedule is necessary.
