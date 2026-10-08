"""Chronological forecast diagnostic; never selects players using today's rosters.

2025 cutoffs at weeks 1/4/8/12. Targets are the next four statistical appearances
within eight weeks, conditional on those appearances being observed. This is NOT
an availability/dynasty-value backtest. Generic priors avoid future draft outcomes.
"""
import csv,json,statistics
from collections import defaultdict
from pathlib import Path
from pipeline.build import ROOT,FIELDS,PRIOR,forecast,fantasy,num,dump

def legacy(games,pos,year):
    prior=[g for g in games if year-2<=g['season']<year][-17:]
    current=[g for g in games if g['season']==year];out={}
    for k in FIELDS:
        values=[g['stats'][k] for g in prior if g['stats'][k] is not None]
        base=statistics.mean(values) if values else PRIOR[pos].get(k,0)
        pairs=[(g['stats'][k],2**(-(len(current)-1-i)/4)) for i,g in enumerate(current) if g['stats'][k] is not None]
        out[k]=(base*4+sum(v*w for v,w in pairs))/(4+sum(w for _,w in pairs))
    return out

def main():
    careers=defaultdict(list);positions={}
    for year in (2023,2024,2025):
        with (ROOT/'.data-cache'/f'stats_player_week_{year}.csv').open(encoding='utf-8-sig') as f:
            for r in csv.DictReader(f):
                if r['season_type']!='REG' or r['position'] not in PRIOR:continue
                positions[r['player_id']]=r['position']
                careers[r['player_id']].append({'season':year,'week':int(r['week']),'stats':{k:num(r.get(k)) for k in FIELDS}})
    errors=defaultdict(lambda:defaultdict(list))
    for pid,games in careers.items():
        games.sort(key=lambda g:(g['season'],g['week']));pos=positions[pid]
        for cutoff in (1,4,8,12):
            known=[g for g in games if g['season']<2025 or g['week']<=cutoff]
            if not any(g['season']==2025 for g in known):continue
            future=[g for g in games if g['season']==2025 and cutoff<g['week']<=cutoff+8][:4]
            if len(future)<4:continue
            target=statistics.mean(fantasy(g['stats']) for g in future)
            predictions={'legacy':fantasy(legacy(known,pos,2025)),
                         'opportunity_rates':fantasy(forecast(known,pos,2025)[0]),
                         'long_term':fantasy(forecast(known,pos,2025,long_term=True)[0])}
            for model,pred in predictions.items():errors[pos][model].append(abs(pred-target))
    report={'target':'Mean PPR over next four statistical appearances within eight weeks',
            'evaluationSeason':2025,'cutoffWeeks':[1,4,8,12],
            'limitations':['Conditional on four observed future appearances; not an availability test.','No current roster filtering. Generic/draft-blind priors. Repeated player cutoffs are correlated.','Diagnostic only; no proof of dynasty ranking superiority. Parameters chosen before this diagnostic; not optimized on these outcomes.'],
            'positions':{pos:{'n':len(models['legacy']),'mae':{k:round(statistics.mean(v),4) for k,v in models.items()}} for pos,models in errors.items()}}
    dump(ROOT/'research'/'output'/'smoothing-audit.json',report);print(json.dumps(report,indent=2))

if __name__=='__main__':main()
