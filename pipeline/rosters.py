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
    for team, group in teams.items():
        injured = []
        for p in group:
            games = [g for g in weekly.get(p['id'], []) if g['team'] == team and g['season'] >= year-1 and (g['stats'].get('attempts') or 0) >= 15]
            prior = sum(g['season'] == year-1 for g in games)
            current = sum(g['season'] == year for g in games)
            if p['status'] in {'Questionable', 'Out', 'Doubtful', 'IR', 'PUP', 'Injured Reserve', 'Physically Unable to Perform'} and (prior >= 8 or current >= 2):
                injured.append((prior+current, p['id']))
        incumbent = max(injured, default=(0, None))[1]
        for p in group:
            depth = p['depthOrder']
            role = 1 if depth == 1 else .2 if depth == 2 else .08 if depth else .15
            unavailable = p['status'] in {'Out', 'Doubtful', 'IR', 'PUP', 'Injured Reserve', 'Physically Unable to Perform'}
            if p['id'] == incumbent:
                dynasty, label = 1, 'Injured incumbent'
            elif incumbent and depth == 1:
                dynasty, label = .2, 'Temporary starter'
            else:
                dynasty, label = role, 'Starter' if depth == 1 else 'Backup'
            p['qbRole'] = {'current':0 if unavailable else role, 'dynasty':dynasty, 'label':label,
                           'basis':'Sleeper depth order; an injured same-team QB retains incumbent status with 8 prior-season or 2 current-season games of 15+ attempts. Return date is unknown.'}
