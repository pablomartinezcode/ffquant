"""Current roster membership and conservative QB role context, using explicit IDs."""
from collections import defaultdict

ROSTER_STATUSES = {'ACT', 'INA', 'DEV', 'RES', 'PUP', 'RSN', 'SUS', 'EXE', 'E14'}

def roster_index(rows):
    latest = defaultdict(int)
    by_gsis, by_sleeper = {}, {}
    for row in rows:
        latest[row['team']] = max(latest[row['team']], int(row.get('week') or 0))
        for index, key in ((by_gsis, row.get('gsis_id')), (by_sleeper, row.get('sleeper_id'))):
            if key and key not in ('NA', 'nan'):
                old = index.get(key)
                if old is None or int(row.get('week') or 0) >= int(old.get('week') or 0):
                    index[key] = row
    if len(latest) != 32:
        raise ValueError('Current roster source must cover all 32 teams; preserve the last published snapshot.')
    return by_gsis, by_sleeper, latest

def current_roster(row, sleeper, latest):
    if not row or row.get('status') not in ROSTER_STATUSES:
        return False
    if 'retir' in str(sleeper.get('status', '')).lower():
        return False
    # Use each team's latest week: bye-week teams legitimately lag the league week.
    if int(row.get('week') or 0) == latest.get(row['team']):
        return True
    # Season-long reserves may stop appearing weekly; require corroboration.
    return (row.get('status') in {'RES', 'PUP', 'RSN'}
            and sleeper.get('team') == row['team']
            and (sleeper.get('injury_status') or sleeper.get('status')) in {'IR', 'PUP', 'Injured Reserve', 'Physically Unable to Perform'})

def assign_qb_roles(players, weekly, year):
    teams = defaultdict(list)
    for p in players:
        if p['position'] == 'QB': teams[p['team']].append(p)
    injured_statuses = {'Questionable', 'Out', 'Doubtful', 'IR', 'PUP', 'Injured Reserve', 'Physically Unable to Perform'}
    for team, group in teams.items():
        evidence = {}
        for p in group:
            games = [g for g in weekly.get(p['id'], []) if g['team'] == team and g['season'] >= year-1 and (g['stats'].get('attempts') or 0) >= 15]
            current = [g for g in games if g['season'] == year]
            prior = sum(g['season'] == year-1 for g in games)
            evidence[p['id']] = {'current':current, 'prior':prior}
        # Opening-game workload identifies continuity without treating an injury
        # flag clearing before a depth-chart update as a permanent demotion.
        opening_games = [(g['week'], -(g['stats'].get('attempts') or 0), p['id']) for p in group for g in evidence[p['id']]['current']]
        incumbent = min(opening_games)[2] if opening_games else None
        if incumbent:
            incumbent_player = next(p for p in group if p['id'] == incumbent)
            replacements = [p for p in group if p['id'] != incumbent and p['depthOrder'] == 1]
            sustained = any(len(evidence[p['id']]['current']) >= 4 for p in replacements)
            if incumbent_player['status'] not in injured_statuses and sustained:
                incumbent = None
        # A prior starter injured before the opener can still retain his role.
        preseason_injured = [(evidence[p['id']]['prior'], p['id']) for p in group if p['status'] in injured_statuses and evidence[p['id']]['prior'] >= 8 and not evidence[p['id']]['current']]
        if preseason_injured and (incumbent is None or evidence[incumbent]['prior'] < 8):
            incumbent = max(preseason_injured)[1]
        for p in group:
            depth = p['depthOrder']
            role = 1 if depth == 1 else .2 if depth == 2 else .08 if depth else .15
            unavailable = p['status'] in injured_statuses-{'Questionable'}
            if p['id'] == incumbent:
                dynasty = 1
                label = 'Injured incumbent' if p['status'] in injured_statuses else 'Starter continuity' if depth != 1 else 'Starter'
            elif incumbent and depth == 1:
                dynasty, label = .2, 'Temporary starter'
            else:
                dynasty, label = role, 'Starter' if depth == 1 else 'Backup'
            p['qbRole'] = {'current':0 if unavailable else role, 'dynasty':dynasty, 'label':label,
                           'basis':'Opening-game QB workload retains dynasty continuity through injury/return. A healthy incumbent yields after a depth-chart replacement has 4 games of 15+ attempts. Prior-season starters injured before the opener need 8 such games. These are role heuristics, not confirmed return dates.'}
