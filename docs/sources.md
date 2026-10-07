# Source and rights inventory

Reviewed 2026-10-07. Keep this inventory with every new provider and dataset; upstream terms can change. This is a non-commercial research beta, not a determination of commercial rights.

| Source | Use | Coverage / constraints | Reference |
| --- | --- | --- | --- |
| nflverse player statistics | Weekly raw statistics, seasonal totals, efficiency fields | Regular season 1999–present loaded; nullable advanced fields retain missingness. Statistical appearances are not guaranteed games played for zero-stat players. | [Releases](https://github.com/nflverse/nflverse-data/releases/tag/stats_player), [CC BY 4.0 repository license](https://github.com/nflverse/nflverse-data/blob/main/LICENSE.md) |
| nflverse season rosters | Current NFL membership, reserve/practice-squad status, and explicit Sleeper/GSIS mappings | Latest week per team preserves bye weeks. Retired/released rows are excluded; long-term reserves require current corroboration. | [Roster releases](https://github.com/nflverse/nflverse-data/releases/tag/rosters), [status dictionary](https://nflreadr.nflverse.com/articles/dictionary_roster_status.html) |
| nflverse player metadata | GSIS identity, birth date, career stage, source IDs | Coverage varies; explicit IDs only. | [Player releases](https://github.com/nflverse/nflverse-data/releases/tag/players) |
| nflverse draft and schedule data | Draft priors, remaining games, next opponent | Missing draft data remains unknown. Upstream provenance must remain attached. | [nflverse data](https://github.com/nflverse/nflverse-data) |
| DynastyProcess player IDs | Supplemental Sleeper↔GSIS crosswalk | Only unique authoritative ID mappings; no name-based guesses. Review upstream license/provenance before commercial use. | [Repository](https://github.com/DynastyProcess/data) |
| Sleeper read-only API | Player pool, status, NFL state, leagues, rosters, drafts, traded picks | Free API documented for non-commercial use. Player catalog daily, league cache five minutes; retries respect bounded backoff. Status is timestamped, not promised live. | [API documentation](https://docs.sleeper.com/) |

Manifest source entries preserve download URL, retrieval time, source update metadata when available, and content hash. All transformations and valuation assumptions are FFQuant's. The interface attributes nflverse, Sleeper, and DynastyProcess and disclaims affiliation.

The model currently derives features from nflverse's prepared player statistics; it does not download the entire raw play-by-play corpus. Add raw PBP/Parquet as a separate feature pipeline if a validated model needs it. Do not claim complete historical snaps, routes, or reliable live injuries. Consult the [nflverse availability schedule](https://nflreadr.nflverse.com/articles/nflverse_data_schedule.html) before adding those fields.

FantasyCalc and DynastyCalc are product references, not scraped input datasets. No proprietary market values, projections, photos, or logos are copied.
