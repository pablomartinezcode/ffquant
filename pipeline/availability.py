"""Source-confirmed absences; active roster membership is not participation."""
from collections import defaultdict
import math

MISSED = {'INA','RES','PUP','RSN','SUS','EXE'}
MEMBERS = MISSED | {'ACT','DEV','E14'}
def team_name(team):
    return {'LAR':'LA','JAC':'JAX','WSH':'WAS'}.get(team,team)

def weekly_index(rows):
    by_gsis, by_sleeper = defaultdict(list), defaultdict(list)
    for row in rows:
        if row.get('game_type') != 'REG': continue
        if row.get('gsis_id'): by_gsis[row['gsis_id']].append(row)
        if row.get('sleeper_id'): by_sleeper[row['sleeper_id']].append(row)
    return by_gsis, by_sleeper

def completed_games(schedule, year, through_week):
    completed = {}
    for game in schedule:
        if int(game['season']) != year or game['game_type'] != 'REG' or int(game['week']) > through_week: continue
        try:
            if not all(math.isfinite(float(game[k])) for k in ('home_score','away_score')): continue
        except (ValueError,TypeError): continue
        for team in ('home_team','away_team'):
            completed[(int(game['week']),team_name(game[team]))] = game.get('game_id') or f"{game['week']}:{game['home_team']}:{game['away_team']}"
    return completed

def availability_context(roster_rows, games, completed, year, through_week, source_time, status, roster_status, roster_week=None):
    observed = {(g['week'],team_name(g['team'])) for g in games if g['season']==year and g['week']<=through_week}
    per_week = defaultdict(list)
    for row in roster_rows:
        week = int(row.get('week') or 0)
        if int(row.get('season') or year)==year and row.get('status') in MEMBERS and (week,team_name(row['team'])) in completed:
            per_week[week].append(row)
    details = []; conflicts = 0
    for week in sorted(set(per_week) | {w for w,t in observed if (w,t) in completed}):
        rows = per_week.get(week, [])
        played = sorted(t for w,t in observed if w==week and (w,t) in completed)
        candidates = {(team_name(r['team']),r['status']) for r in rows}
        if played:
            team = played[0]; result = 'recorded'; code = next((s for t,s in candidates if t==team),'Unknown')
            conflicts += int(any(s in MISSED for t,s in candidates if t==team))
        elif len(candidates)==1:
            team,code = next(iter(candidates))
            result = 'missed' if code in MISSED else 'practice' if code=='DEV' else 'unknown'
        else:
            team,code,result = 'Unknown','Unknown','unknown'
        details.append({'week':week,'team':team,'status':code,'result':result})
    missed = [d['week'] for d in details if d['result']=='missed']
    unknown = sum(d['result']=='unknown' for d in details)
    # No matched weekly rows means no verified absence coverage, never zero missed.
    count = len(missed) if per_week else None
    label,next_weight,ros_weight = 'Available',1,1
    if roster_status in {'RES','PUP','RSN'} or status in {'IR','PUP','Injured Reserve','Physically Unable to Perform'}:
        label,next_weight,ros_weight = 'On reserve',0,.5
        if not observed and len(missed)>=3: ros_weight=.35
    elif roster_status=='DEV': label,next_weight,ros_weight='Practice squad',0,.2
    elif roster_status in {'SUS','EXE'} or status in {'Suspended','Suspension'}: label,next_weight,ros_weight='Suspended / exempt',0,.5
    # A completed-week inactive row can persist through a bye after recovery.
    elif status=='Out' or (roster_status=='INA' and roster_week is not None and roster_week>through_week): label,next_weight,ros_weight='Currently out',0,.85
    elif status=='Doubtful': label,next_weight,ros_weight='Doubtful',.25,.9
    basis = ('Availability weights are model assumptions, not medical return dates. Current reserve: 50% of remaining games, '
             '35% with no appearances and at least three confirmed absences; out: 85%; doubtful: 90%; suspended/exempt: 50%; '
             'practice squad: 20%. Questionable alone is not a missed game. Future seasons retain the role/age forecast.')
    return {'season':year,'throughWeek':through_week,'missedGames':count,'missedWeeks':missed,
            'trackedGames':len(details),'unknownParticipationGames':unknown,'practiceSquadGames':sum(d['result']=='practice' for d in details),
            'asOf':source_time,'label':label,'nextGameWeight':next_weight,'rosWeight':ros_weight,
            'basis':basis,'games':details,'conflicts':conflicts}
