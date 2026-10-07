"""Reproducible public-data import. No fuzzy name matching or fabricated statistics."""
from __future__ import annotations
import argparse, concurrent.futures, csv, hashlib, io, json, math, os, time
import urllib.request, urllib.error
from collections import defaultdict
from datetime import datetime, timezone, date
from pathlib import Path
from pipeline.priors import build_priors, bucket
from pipeline.rosters import roster_index, current_roster, assign_qb_roles

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / '.data-cache'
POSITIONS = ('QB', 'RB', 'WR', 'TE')
FIELDS = ['attempts','passing_yards','passing_tds','passing_interceptions','passing_2pt_conversions','carries','rushing_yards','rushing_tds','rushing_2pt_conversions','targets','receptions','receiving_yards','receiving_tds','receiving_2pt_conversions','fumbles_lost_total','passing_first_downs','rushing_first_downs','receiving_first_downs','receiving_air_yards','receiving_yards_after_catch','passing_epa','rushing_epa','receiving_epa','target_share']
PRIOR = {'QB':{'passing_yards':170,'passing_tds':1,'passing_interceptions':.7,'carries':2.5,'rushing_yards':12,'rushing_tds':.1},'RB':{'carries':4,'rushing_yards':16,'rushing_tds':.1,'targets':1.5,'receptions':1,'receiving_yards':7},'WR':{'targets':3,'receptions':1.8,'receiving_yards':22,'receiving_tds':.12},'TE':{'targets':2,'receptions':1.3,'receiving_yards':14,'receiving_tds':.08}}

def now(): return datetime.now(timezone.utc).isoformat()
def dump(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp=path.with_suffix(path.suffix+'.tmp')
    temp.write_text(json.dumps(value,separators=(',',':'),allow_nan=False),encoding='utf-8')
    temp.replace(path)

def fetch(url, key, ttl=21600):
    CACHE.mkdir(exist_ok=True)
    path=CACHE/key; meta=path.with_suffix(path.suffix+'.meta.json')
    if path.exists() and time.time()-path.stat().st_mtime < ttl:
        return path.read_bytes(), json.loads(meta.read_text())
    headers={'User-Agent':'FFQuant-noncommercial-research/0.1'}
    old=json.loads(meta.read_text()) if meta.exists() else {}
    if old.get('etag'): headers['If-None-Match']=old['etag']
    for attempt in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url,headers=headers),timeout=90) as r:
                data=r.read(); info={'url':url,'fetchedAt':now(),'sourceUpdatedAt':r.headers.get('Last-Modified'),'etag':r.headers.get('ETag'),'sha256':hashlib.sha256(data).hexdigest()}
            path.write_bytes(data); dump(meta,info)
            return data,info
        except urllib.error.HTTPError as e:
            if e.code==304 and path.exists():
                os.utime(path,None); return path.read_bytes(),old
            if e.code not in (429,500,502,503,504) or attempt==3: raise
        except (TimeoutError,urllib.error.URLError):
            if attempt==3: raise
        time.sleep(2**attempt)
    raise RuntimeError('Download failed')

def rows(data): return list(csv.DictReader(io.StringIO(data.decode('utf-8-sig'))))
def num(v):
    try:
        n=float(v); return n if math.isfinite(n) else None
    except (ValueError,TypeError): return None
def age_at(birth, year):
    try: return round((date(year,9,1)-date.fromisoformat(birth[:10])).days/365.25,1)
    except (ValueError,TypeError): return None
def canonical_team(team):
    return {'LAR':'LA','JAC':'JAX','WSH':'WAS'}.get(team,team) if team else 'FA'
def fantasy(s,ppr=1):
    n=lambda k:s.get(k) or 0
    return n('passing_yards')*.04+n('passing_tds')*4-n('passing_interceptions')*2+(n('rushing_yards')+n('receiving_yards'))*.1+(n('rushing_tds')+n('receiving_tds'))*6+n('receptions')*ppr-n('fumbles_lost_total')*2+2*sum(n(k) for k in ('passing_2pt_conversions','rushing_2pt_conversions','receiving_2pt_conversions'))

def forecast(games,pos,year,draft_round=None,draft_prior=None):
    previous=[g for g in games if year-2<=g['season']<year]
    current=[g for g in games if g['season']==year]
    prior=previous[-17:]
    out={}
    for k in FIELDS:
        values=[g['stats'][k] for g in prior if g['stats'][k] is not None]
        base=sum(values)/len(values) if values else (draft_prior or PRIOR.get(pos,{})).get(k,0)
        # Only forecasting uses priors. Observed null values remain null.
        weighted=[(g['stats'][k],2**(-(len(current)-1-i)/4)) for i,g in enumerate(current) if g['stats'][k] is not None]
        out[k]=round((base*4+sum(v*w for v,w in weighted))/(4+sum(w for _,w in weighted)),5)
    # Rookies have no NFL history; use an explicit draft-capital prior.
    if not prior and not current and not draft_prior:
        boost=({1:1.25,2:1.1,3:1.0} if pos=='QB' else {1:2.0,2:1.65,3:1.3}).get(draft_round,1)
        out={k:round(v*boost,5) for k,v in out.items()}
    baseline=sum(fantasy(g['stats']) for g in prior)/len(prior) if prior else fantasy(PRIOR.get(pos,{}))
    recent=current[-3:]
    form=round(sum(fantasy(g['stats']) for g in recent)/len(recent)-baseline,2) if recent else None
    return out,form,len(current),('low' if len(previous)+len(current)<8 else 'medium')

def build(start=1999):
    state_b,state_meta=fetch('https://api.sleeper.app/v1/state/nfl','state.json',300)
    state=json.loads(state_b); year=int(state['season'])
    catalog_b,catalog_meta=fetch('https://api.sleeper.app/v1/players/nfl','sleeper.json',86400)
    sleeper=json.loads(catalog_b)
    roster_b,roster_meta=fetch(f'https://github.com/nflverse/nflverse-data/releases/download/rosters/roster_{year}.csv',f'roster_{year}.csv')
    roster_gsis,roster_sleeper,roster_weeks=roster_index(rows(roster_b))
    people_b,people_meta=fetch('https://github.com/nflverse/nflverse-data/releases/download/players/players.csv','players.csv',86400)
    people={r['gsis_id']:r for r in rows(people_b) if r['gsis_id']}
    schedule_b,schedule_meta=fetch('https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv','games.csv')
    schedule=rows(schedule_b)
    draft_b,draft_meta=fetch('https://github.com/nflverse/nflverse-data/releases/download/draft_picks/draft_picks.csv','draft.csv',86400)
    draft_rows=rows(draft_b)
    drafts={r['gsis_id']:r for r in draft_rows if r['gsis_id']}
    cross_b,cross_meta=fetch('https://raw.githubusercontent.com/DynastyProcess/data/master/files/db_playerids.csv','crosswalk.csv',86400)
    cross=defaultdict(set)
    for row in rows(cross_b):
        if row.get('sleeper_id') not in ('',None,'NA') and row.get('gsis_id') in people:
            cross[row['sleeper_id']].add(row['gsis_id'])
    sources=[catalog_meta,roster_meta,people_meta,schedule_meta,draft_meta,cross_meta]
    release='https://github.com/nflverse/nflverse-data/releases/download/stats_player/'
    def season(s):
        key=f'stats_player_week_{s}.csv'
        data,meta=fetch(release+key,key,21600 if s==year else 30*86400)
        return s,rows(data),meta
    seasons={}; coverage=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        for s,records,meta in pool.map(season,range(start,year+1)):
            seasons[s]=records; sources.append(meta)
            print(f'Loaded {s}: {len(records)} source rows',flush=True)
    weekly=defaultdict(list); history=defaultdict(list)
    opponent_ppg=defaultdict(list)
    for s,records in sorted(seasons.items()):
        reg=[r for r in records if r['season_type']=='REG' and r['position'] in POSITIONS]
        for r in reg:
            g={'season':s,'week':int(r['week']),'team':r['team'],'opponent':r['opponent_team'],'stats':{k:num(r.get(k)) for k in FIELDS}}
            weekly[r['player_id']].append(g)
            if s>=year-1: opponent_ppg[(r['opponent_team'],r['position'])].append(fantasy(g['stats']))
        coverage.append({'season':s,'rows':len(reg),'players':len({r['player_id'] for r in reg}),'lastWeek':max((int(r['week']) for r in reg),default=0),'fields':{k:sum(r.get(k,'')!='' for r in reg) for k in FIELDS}})
    for pid,games in weekly.items():
        games.sort(key=lambda g:(g['season'],g['week']))
        groups=defaultdict(list)
        for g in games: groups[g['season']].append(g)
        meta=people.get(pid,{})
        for s,group in groups.items():
            sample=next(r for r in seasons[s] if r['player_id']==pid)
            stats={k:round(sum(g['stats'][k] for g in group if g['stats'][k] is not None),3) if any(g['stats'][k] is not None for g in group) else None for k in FIELDS}
            shares=[g['stats']['target_share'] for g in group if g['stats']['target_share'] is not None]
            stats['target_share']=round(sum(shares)/len(shares),4) if shares else None
            entry={'id':pid,'name':meta.get('display_name') or sample['player_display_name'],'position':sample['position'],'season':s,'age':age_at(meta.get('birth_date'),s),'careerYear':s-int(float(meta.get('rookie_season') or s))+1,'team':group[-1]['team'],'games':len(group),'stats':stats,'ppg':round(sum(fantasy(g['stats']) for g in group)/len(group),2)}
            history[s].append(entry)
    for s,entries in history.items():
        for pos in POSITIONS:
            group=sorted([e for e in entries if e['position']==pos],key=lambda e:e['ppg'])
            for i,e in enumerate(group): e['percentile']=round(100*i/max(1,len(group)-1),1)
    priors,prior_report=build_priors(draft_rows,people,weekly,year,FIELDS,fantasy)
    dump(ROOT/'research'/'output'/'draft-priors.json',prior_report)
    espn=defaultdict(list)
    for pid,p in people.items():
        if p.get('espn_id'): espn[str(p['espn_id']).split('.')[0]].append(pid)
    active=[]; unmatched=[]; excluded=[]; seen=set()
    schedules=[s for s in schedule if int(s['season'])==year and s['game_type']=='REG']
    for sid,p in sleeper.items():
        if p.get('position') not in POSITIONS: continue
        roster=roster_sleeper.get(sid) or roster_gsis.get(p.get('gsis_id'))
        pid=(roster.get('gsis_id') if roster else p.get('gsis_id') or '').strip()
        method='gsis'
        if (not pid or pid not in people) and len(cross.get(sid,set()))==1:
            pid=next(iter(cross[sid])); method='crosswalk'
        if not pid or pid not in people:
            ids=espn.get(str(p.get('espn_id')),[])
            if len(ids)==1: pid=ids[0]; method='espn'
            else: pid='sleeper-'+sid; method='unmatched'
        roster=roster or roster_gsis.get(pid)
        if not current_roster(roster,p,roster_weeks):
            excluded.append({'sleeperId':sid,'id':pid,'name':p.get('full_name'),'reason':'Not on a current NFL roster or reserve list','rosterStatus':roster.get('status') if roster else None})
            continue
        if pid in seen:
            unmatched.append({'sleeperId':sid,'name':p.get('full_name'),'reason':'duplicate authoritative identity'}); continue
        seen.add(pid)
        if method=='unmatched': unmatched.append({'sleeperId':sid,'name':p.get('full_name'),'reason':'no unambiguous GSIS/ESPN mapping'})
        meta=people.get(pid,{})
        draft=drafts.get(pid,{})
        dr=int(float(draft.get('round') or meta.get('draft_round') or 0)) or None
        pick=num(draft.get('pick') or meta.get('draft_pick'))
        games=weekly.get(pid,[])
        experience=p.get('years_exp')
        cohort=priors.get(f"{p['position']}:{bucket(pick)}") if pick and experience is not None and experience<4 else None
        draft_prior=cohort['profiles'][min(2,experience)] if cohort else None
        fc,form,n,confidence=forecast(games,p['position'],year,dr,draft_prior)
        recent_games=[g for g in games if g['season']>=year-2]
        # Smoothly retain draft evidence through the early career; no first-game or eighth-game cliff.
        def dynasty_forecasts(current,observations):
            weight=math.exp(-observations/24)*max(0,1-(experience or 0)/4) if cohort else 0
            return [{k:round((1-weight)*current[k]+weight*cohort['profiles'][min(2,experience+y)][k],5) for k in FIELDS} if cohort else current.copy() for y in (1,2)]
        dynasty=dynasty_forecasts(fc,len(games))
        team=canonical_team(roster['team'])
        upcoming=[g for g in schedules if team in (g['home_team'],g['away_team']) and not g.get('home_score')]
        next_game=upcoming[0] if upcoming else None
        opp=(next_game['away_team'] if next_game['home_team']==team else next_game['home_team']) if next_game else None
        allowance=opponent_ppg.get((opp,p['position']),[])
        all_allowed=[v for (t,pos),vs in opponent_ppg.items() if pos==p['position'] for v in vs]
        avg=sum(all_allowed)/len(all_allowed) if all_allowed else 1
        modifier=max(.9,min(1.1,(sum(allowance)+avg*40)/(len(allowance)+40)/max(avg,.1))) if allowance else 1
        previous_fc=forecast(games[:-1],p['position'],year,dr,draft_prior)[0] if n else None
        active.append({'id':pid,'sleeperId':sid,'name':p.get('full_name') or ((p.get('first_name') or '')+' '+(p.get('last_name') or '')).strip(),'position':p['position'],'team':team,'age':age_at(p.get('birth_date') or meta.get('birth_date'),year),'status':p.get('injury_status') or p.get('status') or 'Unknown','statusAsOf':catalog_meta['fetchedAt'],'draftRound':dr,'draftPick':num(draft.get('pick') or meta.get('draft_pick')),'experience':p.get('years_exp'),'mapping':method,'forecast':fc,'previousForecast':previous_fc,'currentForm':form,'gamesThisSeason':n,'remainingGames':len(upcoming) if team!='FA' else 0,'nextOpponent':opp,'matchupFactor':round(modifier,4),'confidence':confidence})
        compact=lambda stats:{k:v for k,v in stats.items() if v is not None and v!=0}
        active[-1]['forecast']=compact(fc)
        active[-1]['previousForecast']=compact(previous_fc) if previous_fc else None
        active[-1].update({'dynastyForecasts':[compact(f) for f in dynasty] if cohort else None,'previousDynastyForecasts':[compact(f) for f in dynasty_forecasts(previous_fc,len(games)-1)] if previous_fc and cohort else None,
                          'draftPrior':{k:v for k,v in cohort.items() if k!='profiles'} if cohort else None,
                          'depthOrder':num(p.get('depth_chart_order')), 'recentAppearances':len(recent_games),
                          'valuationEligible':True,'dynastyEligible':True,'rosterStatus':roster['status'],'rosterWeek':int(roster.get('week') or 0),'rosterAsOf':roster_meta['fetchedAt'],'sampleSeason':year,
                          'scoreSamples':[{'season':g['season'],'week':g['week'],'stats':{k:v for k,v in compact(g['stats']).items() if k not in ['attempts','targets','carries','receiving_air_yards','receiving_yards_after_catch','passing_epa','rushing_epa','receiving_epa','target_share']}} for g in [g for g in recent_games if g['season']==year][-17:]]})
    assign_qb_roles(active,weekly,year)
    dump(ROOT/'research'/'output'/'roster-review.json',{'excluded':excluded,'currentCount':len(active),'teamWeeks':roster_weeks,'source':roster_meta})
    model_hash=hashlib.sha256(Path(__file__).read_bytes()+(ROOT/'pipeline'/'priors.py').read_bytes()+(ROOT/'pipeline'/'rosters.py').read_bytes()+(ROOT/'lib'/'football.ts').read_bytes()).hexdigest()
    digest=hashlib.sha256((model_hash+catalog_meta['fetchedAt']+''.join(s['sha256'] for s in sorted(sources,key=lambda x:x['url']))).encode()).hexdigest()[:20]
    built=now(); snapshot='nfl-'+digest
    latest_source=next(s for s in sources if s['url'].endswith(f'week_{year}.csv'))
    manifest={'id':snapshot,'modelVersion':'baseline-0.3.0','season':year,'week':int(state['week']),'builtAt':built,'sourceUpdatedAt':latest_source.get('sourceUpdatedAt') or latest_source['fetchedAt'],'firstSeason':start,'playerCount':len(active),'historicalPlayerCount':len(weekly),'historyRows':sum(map(len,history.values())),'unmatchedCount':len(unmatched),'coverage':coverage,'sources':sources,'limitations':['Experimental projections; not a validated advantage over market models.','Position-specific aging curves are research-informed assumptions, not fitted causal effects.','Draft priors use completed historical cohorts including matched players with zero production; talent is proxied by NFL draft capital.','Status and depth order are daily Sleeper snapshots, not a live injury feed.','Dynasty rankings include current NFL rosters and reserves, excluding retired and unrostered players. Membership is source-timestamped.', 'QB incumbent protection is a usage-based heuristic, not a confirmed recovery date.', 'Scoring spread uses current-season statistical appearances only; byes and missing zero-stat games are excluded. Median ± SD is descriptive, not a prediction interval.','Advanced statistics are available only where provided.','Pick curves are provisional research assumptions.']}
    data=ROOT/'data'; public=ROOT/'public'/'data'
    dump(ROOT/'research'/'output'/'mapping-review.json',unmatched)
    for s,entries in history.items(): dump(public/'history'/f'{s}.json',entries)
    active_by_id={p['id']:p for p in active}
    all_ids=set(weekly)|set(active_by_id)
    # Remove only obsolete generated profiles inside this exact output directory.
    for old in (public/'players').glob('*.json'):
        if old.stem not in all_ids: old.unlink()
    for pid in all_ids:
        summaries=sorted([e for s in history.values() for e in s if e['id']==pid],key=lambda e:e['season'])
        p=active_by_id.get(pid)
        dump(public/'players'/f'{pid}.json',{'id':pid,'player':p,'seasons':summaries,'weekly':weekly.get(pid,[]),'snapshotId':snapshot})
    dump(public/'history-index.json',[{'id':pid,'name':people.get(pid,{}).get('display_name') or next((e['name'] for s in history.values() for e in s if e['id']==pid),pid),'position':next(e['position'] for entries in history.values() for e in entries if e['id']==pid),'seasons':sorted({g['season'] for g in games}),'current':pid in active_by_id} for pid,games in weekly.items()])
    manifest['artifacts']={p.relative_to(public).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for folder in ('players','history') for p in sorted((public/folder).glob('*.json'))}
    manifest['artifacts']['history-index.json']=hashlib.sha256((public/'history-index.json').read_bytes()).hexdigest()
    manifest['playerChecksums']={p['id']:hashlib.sha256(json.dumps(p,separators=(',',':'),allow_nan=False).encode()).hexdigest() for p in active}
    manifest['modelCodeHash']=model_hash
    dump(data/'catalog.json',{'manifest':manifest,'players':active});dump(public/'manifest.json',manifest)
    dump(ROOT/'research'/'output'/'coverage.json',manifest)
    # One import contract for local seeding and authenticated hosted publication.
    dump(ROOT/'research'/'output'/'snapshot.json',{'manifest':manifest,'players':active})
    print(json.dumps({'snapshot':snapshot,'currentPlayers':len(active),'historicalPlayers':len(weekly),'historyRows':manifest['historyRows'],'unmatched':len(unmatched)}),flush=True)

if __name__=='__main__':
    parser=argparse.ArgumentParser(); parser.add_argument('--start',type=int,default=1999); args=parser.parse_args(); build(args.start)
