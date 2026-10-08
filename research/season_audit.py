"""Retrospective chronological diagnostic, not an availability or dynasty backtest."""
import csv,statistics,json
from collections import defaultdict
from pipeline.build import ROOT,FIELDS,PRIOR,forecast,fantasy,num,dump

def main():
    careers=defaultdict(list);positions={}
    for year in range(2022,2026):
        with (ROOT/'.data-cache'/f'stats_player_week_{year}.csv').open(encoding='utf-8-sig') as f:
            for r in csv.DictReader(f):
                if r['season_type']!='REG' or r['position'] not in PRIOR:continue
                positions[r['player_id']]=r['position']
                careers[r['player_id']].append({'season':year,'week':int(r['week']),'stats':{k:num(r.get(k)) for k in FIELDS}})
    results={}
    for year in (2024,2025):
        errors=defaultdict(lambda:defaultdict(list));excluded=0
        for pid,games in careers.items():
            pos=positions[pid];games=sorted(games,key=lambda g:(g['season'],g['week']))
            for cutoff in (3,4,6,8):
                known=[g for g in games if year-2<=g['season']<year or g['season']==year and g['week']<=cutoff]
                if not any(g['season']==year for g in known):continue
                future=[g for g in games if g['season']==year and cutoff<g['week']<=cutoff+8][:4]
                if len(future)<4:excluded+=1;continue
                target=statistics.mean(fantasy(g['stats']) for g in future)
                old=forecast(known,pos,year,season_adaptation=False)[0];new=forecast(known,pos,year)[0]
                for group in ('all',pos):
                    errors[group]['baseline'].append(abs(fantasy(old)-target));errors[group]['season_reset'].append(abs(fantasy(new)-target))
                    if old!=new:
                        errors[group]['triggered_baseline'].append(abs(fantasy(old)-target));errors[group]['triggered_reset'].append(abs(fantasy(new)-target))
        results[year]={'excludedIncompleteOutcomes':excluded,'groups':{g:{k:{'n':len(v),'mae':round(statistics.mean(v),5)} for k,v in models.items()} for g,models in errors.items()}}
    report={'target':'Mean PPR in next four statistical appearances within eight weeks','cutoffWeeks':[3,4,6,8],
            'limitations':['Conditional on future appearances; excludes incomplete outcomes and is not an availability/dynasty-value validation.','No current-roster filtering; draft-blind priors. Retrospective source corrections and correlated repeated cutoffs apply.','Parameters fixed before this comparison, but prior model research already inspected these seasons; not a pristine holdout.','Small aggregate improvement does not establish better RB predictions; review position and triggered subsets.'], 'results':results}
    dump(ROOT/'research'/'output'/'season-audit.json',report);print(json.dumps(report,indent=2))
if __name__=='__main__':main()
