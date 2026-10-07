"""Descriptive age transitions, retaining exits. Not a causal age curve or model backtest."""
import json
from collections import defaultdict
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]

def main():
    current=json.loads((ROOT/'data'/'catalog.json').read_text())['manifest']['season']
    rows=[p for path in (ROOT/'public'/'data'/'history').glob('*.json') if int(path.stem)<current for p in json.loads(path.read_text())]
    lookup={(p['id'],p['season']):p for p in rows}
    groups=defaultdict(list)
    for p in rows:
        if p['season']>=current-1 or p['age'] is None or p['games']<6 or p['ppg']<{'QB':12,'RB':6,'WR':6,'TE':4}[p['position']]:continue
        nxt=lookup.get((p['id'],p['season']+1))
        band=f'{int(p["age"]//3)*3}–{int(p["age"]//3)*3+2}'
        groups[(p['position'],band)].append((p,nxt))
    report=[]
    for (pos,band),pairs in sorted(groups.items()):
        survivors=[(p,n) for p,n in pairs if n and n['games']>=6]
        report.append({'position':pos,'ageBand':band,'observations':len(pairs),'nextSeasonSixGameRate':len(survivors)/len(pairs),
                       'continuingPpgRatio':sum(n['ppg'] for p,n in survivors)/sum(p['ppg'] for p,n in survivors) if survivors else None,
                       'allPlayerPointsRatio':sum((n['ppg']*n['games'] if n else 0) for p,n in pairs)/sum(p['ppg']*p['games'] for p,n in pairs)})
    output={'throughOutcomeSeason':current-1,'method':'At least 6 statistical appearances and QB12/RB6/WR6/TE4 PPR/G at origin. Next-year absence is zero in total-points outcomes. Continuers need 6 appearances. Repeated players and era/role confounding remain.',
            'warning':'Descriptive audit, not causal aging or an out-of-sample validation of baseline-0.2.0.', 'groups':report}
    path=ROOT/'research'/'output'/'age-audit.json';path.write_text(json.dumps(output,indent=2));print(json.dumps(output,indent=2))
if __name__=='__main__':main()
