"""Draft-capital cohorts: only complete pre-current-season NFL outcomes.

Unmatched draft identities are reported, never silently counted as NFL failures.
Matched drafted players without a statistical appearance remain in the denominator.
"""
from collections import defaultdict

BUCKETS = [(10, '1–10'), (32, '11–32'), (64, '33–64'), (100, '65–100'), (300, '101+')]

def bucket(pick):
    return next((label for upper, label in BUCKETS if pick <= upper), '101+')

def build_priors(drafts, people, weekly, year, fields, fantasy):
    pfr = {p.get('pfr_id'): pid for pid, p in people.items() if p.get('pfr_id')}
    cohorts = defaultdict(list)
    excluded = []
    for d in drafts:
        season = int(d['season'])
        pos = d['position']
        if pos not in ('QB', 'RB', 'WR', 'TE') or not 2000 <= season <= year - 3:
            continue
        pid = d.get('gsis_id') or pfr.get(d.get('pfr_player_id'))
        if not pid:
            excluded.append({'name': d['pfr_player_name'], 'season': season, 'pick': d['pick']})
            continue
        outcomes = []
        hit = False
        for career in range(3):
            games = [g for g in weekly.get(pid, []) if g['season'] == season + career]
            stats = {k: sum(g['stats'].get(k) or 0 for g in games) / max(1, len(games)) for k in fields}
            # A full-season threshold, normalized for 16/17-game eras; injuries and no-play seasons count.
            full_season_ppg = sum(fantasy(g['stats']) for g in games) / (17 if season + career >= 2021 else 16)
            hit |= full_season_ppg >= {'QB': 18, 'RB': 12, 'WR': 12, 'TE': 9}[pos]
            outcomes.append(stats)
        cohorts[(pos, bucket(int(d['pick'])))].append({'stats': outcomes, 'hit': hit, 'id': pid})
    result = {}
    for (pos, label), cohort in cohorts.items():
        # Sparse exact-pick bands borrow from adjacent bands; never claim a tiny cohort is precise.
        broad = [p for (p_pos, band), rows in cohorts.items() if p_pos == pos and
                 (band in ('1–10', '11–32') if label in ('1–10', '11–32') else band not in ('1–10', '11–32')) for p in rows]
        n = len(cohort)
        weight = n / (n + 5)
        profiles = []
        for career in range(3):
            profiles.append({k: round(weight * sum(p['stats'][career][k] for p in cohort) / n +
                                      (1-weight) * sum(p['stats'][career][k] for p in broad) / len(broad), 5) for k in fields})
        result[f'{pos}:{label}'] = {'position': pos, 'bucket': label, 'count': n,
                                  'hitRate': sum(p['hit'] for p in cohort) / n,
                                  'profiles': profiles, 'throughDraft': year - 3}
    return result, {'throughDraft': year-3, 'cohorts': list(result.values()), 'unmatchedDrafts': excluded,
                    'hitDefinition': 'At least one of first three seasons with PPR per scheduled team game >= QB 18, RB/WR 12, TE 9. Includes no-appearance failures; excludes unresolved identities.',
                    'limitations': ['Conditional per-appearance forecasts are not injury-adjusted.', 'Small draft bands shrink toward broader draft capital.', 'Draft capital proxies opportunity/talent; no individual scouting grade is implied.']}
