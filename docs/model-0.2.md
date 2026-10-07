# FFQuant baseline 0.2 — October 7, 2026

## Diagnosis

The previous model ranked Josh Allen QB1 but seventh overall in 12-team Superflex PPR. Its replacement pool included stale and backup quarterbacks with generic starter-sized forecasts. Its future age penalty compounded elapsed years against distance beyond a fixed peak. A first-round rookie lost the draft-adjusted forecasting prior immediately after debut; Jeremiyah Love's forecast fell below replacement and his entire value became the fixed 550-unit bonus.

No player-specific ranks, name exceptions, crowd-price targets, or manual Allen/Love overrides are used in 0.2.

## Research and interpretation

- [PFF quarterback aging study](https://www.pff.com/news/nfl-quarterback-aging-tom-brady-tampa-bay-buccaneers-2021): raw passing-depth decline near 35 does not establish a uniform physical cliff after controlling for context; older samples are small and selected survivors.
- [Apex QB study](https://apexfantasyleagues.com/the-peak-age-for-an-nfl-quarterback/): productive QB seasons extend later than other positions; rushing-heavy and pocket-passing age profiles differ. These are distributions of successful seasons, not causal decline estimates.
- [Apex RB study](https://apexfantasyleagues.com/peak-age-nfl-running-back/): productive RB seasons concentrate earlier; its qualifying seasons average around age 25.5.
- [Apex WR study](https://apexfantasyleagues.com/peak-age-for-nfl-wide-receiver/): modern productive seasons concentrate around 25–27, with fewer after 30.
- [Apex TE study](https://apexfantasyleagues.com/peak-age-nfl-tight-end/): a longer late-career tail is heavily influenced by a few exceptional players. Do not assume every TE ages like Kelce.
- [Fantasy Footballers draft-capital analysis](https://www.thefantasyfootballers.com/articles/draft-capital-its-correlation-to-early-career-fantasy-production/): early NFL capital predicts opportunity and early-career outcomes; position matters. Its hit-rate definition differs from ours.
- [Cardinals draft announcement](https://www.azcardinals.com/news/cardinals-select-jeremiyah-love-in-first-round-of-2026-draft): Love was selected third overall. The pipeline uses the statistical draft record, not a hand-entered scouting grade.

## Age adjustment

Let L(a) = rate × max(0,a-start)^2 + lateRate × max(0,a-late)^2. Future production retention is exp(-(L(age+y)-L(age))). Current observed production is never re-aged downward. These coefficients are research-informed calibration assumptions, not coefficients estimated by the cited studies.

| Component | Start | Rate | Late | Late rate |
|---|---:|---:|---:|---:|
| QB passing/receiving | 32 | .012 | 36 | .025 |
| QB rushing | 28 | .025 | 33 | .025 |
| RB | 24 | .035 | 28 | .025 |
| WR | 27 | .020 | 31 | .025 |
| TE | 28 | .017 | 32 | .025 |

The remainder of this season and two future seasons remain the horizon, discounted .85 annually. Age and draft changes are explicitly a new experimental baseline, not promotion of a trained challenger. No claim of improved held-out predictive accuracy is made.

`python -m research.age_audit` produces a descriptive next-season audit by position and three-year age band. It distinguishes continuing-player PPG from total production including exits, using completed seasons only. Threshold selection, repeated observations, era and role confounding mean neither series is a causal aging curve.

## Draft priors

Use completed 2000–(current year minus 3) draft classes, positions QB/RB/WR/TE, and NFL pick bands 1–10, 11–32, 33–64, 65–100, 101+. Each matched draftee has three career-year stat profiles. No statistical appearances in a matched career year means zero; unresolved draft identities are reported and excluded rather than silently counted as failures. The current cohort excludes 101 unresolved draft identities. They remain a coverage limitation.

Each player's per-appearance rates have equal weight. Exact-band means shrink toward the broader first-round or later-round mean with weight n/(n+5). Full-cohort hit rate means at least one of the first three seasons reached scheduled-game PPR thresholds of QB18/RB12/WR12/TE9; injuries and absences reduce that outcome. It is not a probability calibrated for an individual player.

The top-10 RB band has 17 matched draftees; 13 met that threshold. Draft-based projected production, rather than an additive hit-rate bonus, enters valuations. Current forecasts use the appropriate career-year prior until replaced by NFL history. Future profiles blend with observed forecasts using weight exp(-career appearances/24) × max(0,1-experience/4). No debut or eighth-game bonus cliff remains.

Talent is proxied by draft capital and NFL production. No college film grade, combine model, consensus rookie ADP, or 2026 class-strength adjustment is implied. Per-appearance priors are not missed-game projections.

## Replacement and roles

Stale players without recent NFL evidence or current prospect eligibility have zero modeled value. Free agents do not set replacement level. QB depth order is a daily snapshot: starter 1.0, second .20, deeper .08; missing depth uses disclosed fallback estimates. Early-career QB future role can retain draft-based development value. Non-QB injuries/roles remain an explicit limitation.

Positional demand retains the 1.4 depth buffer. In 1QB-plus-Superflex, the QB replacement benchmark cannot fall below the best non-QB replacement alternative. This avoids making every NFL starter elite simply because a backup is unlikely to play.

## Consistency and league totals

Up to 17 latest statistical appearances from the preceding two seasons plus current season; observed raw scoring fields are converted under selected scoring. Median uses linear interpolation; SD is sample SD around the mean (n-1 denominator). Glyph endpoints are median ± SD, not a confidence interval, floor/ceiling, or an assertion that 68% of scores fall inside. Negative endpoints are retained. Zero/one-observation samples have missing SD. Counts under 8 are visibly marked. Hover/focus exposes dates and quartiles. Spread does not penalize dynasty value automatically.

All rows in the rankings table share a points axis. Teams are sorted by the sum of unrounded player values, or QB/RB/WR/TE values. IR/taxi entries are unioned with regular players to prevent double counting. Picks, K/DEF and unmatched roster entries are excluded and labeled. League rankings always use imported league scoring even after the main ranking controls change. Refresh preserves the selected roster.

## Release integrity

Forecasts, samples and model version publish together. During deployment, a previous-model active snapshot falls back to the compatible new bundled snapshot until ingestion publishes the new version. Historic rating rows show model version; changes across versions are not football-only movements. Existing rollback snapshots remain intact.

Injury probability, market-price estimates, league-specific calibrated uncertainty, full rookie prospect scouting, and observed matchup win probability remain future work.
