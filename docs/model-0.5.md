# Baseline 0.5: new-season opportunity and current availability

No player-specific overrides. Ratings and trade values still use the same
three-season, age-adjusted value-above-replacement framework and anchored scale.

## Opening-season adaptation

The old opportunity prior can become stale when a player starts a season in a
different role. The detector examines calendar weeks 1–6, with at least three
valid current observations and eight valid observations among the previous
17 appearances in the last two seasons. It uses QB pass attempts/carries,
RB carries/targets and WR/TE targets. Team changes alone do not award value.

The opening median must differ from the prior average by at least 25% and an
absolute floor (5 pass attempts, 2 carries, 1 target). At least 75% of opening
observations must cross that same directional threshold. Missing data is excluded.

For each opportunity metric:

```
signal = min(1, (opening_observations - 2) / 2)
         * clamp((abs(opening_median - prior) / max(prior, floor) - 0.25) / 0.5, 0, 1)
prior_reduction = 0.75 * signal
```

The relative-change denominator floors are 20 attempts, 4 carries and 2 targets.
Prior strength becomes `old_strength * (1 - prior_reduction)`: as low as one
game equivalent for current production and two for the future-season base.
The rule applies to increases and decreases. No reset is possible after week 6;
opening evidence remains available later, while ordinary current-season updates
continue. Previous-game counterfactuals recompute the signal without that game.

Yardage/catch-rate, touchdown-rate, turnover and two-point shrinkage are unchanged.
A touchdown-only outlier cannot activate this detector. Draft/sparse-history
priors retain their existing protection. Player cards explain triggered changes.

## Availability and missed games

The pipeline imports nflverse weekly rosters in addition to latest season rosters.
It matches explicit GSIS/Sleeper IDs and each week's team to completed regular-season
games, requiring both final scores (zero is valid), through the published statistical
week. Byes, pending games and later weeks do not count.

INA/RES/PUP/RSN/SUS/EXE with no statistical appearance are confirmed missed games.
DEV is tracked separately as practice squad. ACT without statistics is unknown
participation, not missed. Ambiguous assignments stay unknown; duplicate rows do
not double count. An observed statistical appearance wins a conflicting status;
the conflict count remains in the artifact. No matching weekly roster coverage
produces a null count, not zero. Counts are confirmed absences, not complete injury logs.

Current roster and reserve membership controls the dynasty pool. Free agents,
released players and retired players remain excluded until a verified roster return;
Sleeper's stale `active` flag is insufficient. Their historical careers remain browsable.

Availability is separate from per-appearance production and QB role. Current status
uses these explicit **unvalidated assumptions**, never inferred medical return dates:

| Current status | Next-game weight | Remaining-season weight |
|---|---:|---:|
| Active / Questionable | 1 | 1 |
| Out / inactive | 0 | 0.85 |
| Doubtful | 0.25 | 0.90 |
| Reserve / IR / PUP / non-football reserve | 0 | 0.50 |
| Same reserve states, no appearances and ≥3 confirmed absences | 0 | 0.35 |
| Suspended / exempt | 0 | 0.50 |
| Practice squad | 0 | 0.20 |

Rest-of-season points and current-season value above replacement receive the
remaining-season factor. Next-game points receive the next-game factor. Conditional
PPG and future-season role/age forecasts remain intact; an IR designation does not
establish a season-ending injury or a permanent talent loss. Healthy returns restore
current weights to 1 without deleting historical absences. The current Conner source
has reserve subtype R48, so assuming a season-ending absence would be unjustified.

## Diagnostic and limits

`python -m research.season_audit` compares this detector with the unchanged 0.4
forecast at weeks 3, 4, 6 and 8 of 2024/2025. The target is mean PPR over the next
four statistical appearances within eight weeks. The report includes all-position
and triggered-only subsets and excludes incomplete future labels. No current-roster
filtering or future draft outcomes are used.

Observed mean absolute error in PPR points per appearance (lower is better):

| Season / group | Eligible cutoffs | Previous forecast | Season adaptation |
|---|---:|---:|---:|
| 2024 all positions | 1,354 | 2.97299 | 2.97533 |
| 2025 all positions | 1,362 | 2.89967 | 2.88773 |
| 2024 RB | 369 | 3.05536 | 3.07991 |
| 2025 RB | 349 | 3.02473 | 3.03201 |

Results are mixed and small. This conditional-on-appearance test does not validate
availability assumptions or dynasty value. It has survivor selection, correlated
cutoffs and retrospective data corrections; earlier model research already examined
these seasons. Parameters were specified before the comparison, not fitted to the
named players. Do not describe it as proof of ranking superiority or a pristine holdout.

Sources: [weekly rosters](https://nflreadr.nflverse.com/reference/load_rosters_weekly.html),
[roster status dictionary](https://nflreadr.nflverse.com/articles/dictionary_roster_status.html),
[reserve subtype discussion](https://github.com/nflverse/nflreadr/issues/232).
