"""Owner-only chronological model comparison. Never automatically publishes a model."""
import json, math
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.linear_model import Ridge
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_absolute_error
from scipy.stats import spearmanr

ROOT=Path(__file__).resolve().parents[1]
OUTPUT=ROOT/'research'/'output'
POSITIONS=['QB','RB','WR','TE']
FEATURES=['age','games','ppg','targets_pg','carries_pg','pass_yd_pg','rush_yd_pg','rec_yd_pg','td_pg','QB','RB','WR','TE']

def load():
    manifest=json.loads((ROOT/'data'/'catalog.json').read_text())['manifest']
    last_complete=manifest['season']-1
    seasons={int(p.stem):json.loads(p.read_text()) for p in (ROOT/'public'/'data'/'history').glob('*.json') if int(p.stem)<=last_complete}
    lookup={(r['id'],y):r for y,rs in seasons.items() for r in rs}
    data=[]
    for year,players in sorted(seasons.items()):
        if year+3>last_complete: continue # exclude censored future labels
        for p in players:
            g=max(1,p['games']);s=p['stats'];n=lambda k:s.get(k) or 0
            row={'id':p['id'],'cutoff':year,'labelThrough':year+3,'position':p['position'],'age':p['age'] or 25,'games':g,'ppg':p['ppg'],'targets_pg':n('targets')/g,'carries_pg':n('carries')/g,'pass_yd_pg':n('passing_yards')/g,'rush_yd_pg':n('rushing_yards')/g,'rec_yd_pg':n('receiving_yards')/g,'td_pg':sum(n(k) for k in ['passing_tds','rushing_tds','receiving_tds'])/g}
            for pos in POSITIONS: row[pos]=int(pos==p['position'])
            row['target']=sum((lookup.get((p['id'],year+y),{}).get('ppg',0)*lookup.get((p['id'],year+y),{}).get('games',0))*.85**(y-1) for y in (1,2,3))
            row['baseline']=sum(max(0,p['ppg'])*min(17,g)*math.exp(-max(0,(p['age'] or 25)+y-{'QB':30,'RB':25,'WR':27,'TE':28}[p['position']])*{'QB':.06,'RB':.15,'WR':.09,'TE':.07}[p['position']]*y)*.85**(y-1) for y in (1,2,3))
            data.append(row)
    return pd.DataFrame(data),manifest

def metrics(y,pred,pos):
    return {'mae':float(mean_absolute_error(y,pred)),'spearman':float(spearmanr(y,pred).statistic),'byPosition':{p:float(mean_absolute_error(y[pos==p],pred[pos==p])) for p in POSITIONS if (pos==p).any()}}

def main():
    OUTPUT.mkdir(parents=True,exist_ok=True);df,manifest=load();df.to_parquet(OUTPUT/'historical_features.parquet',index=False)
    folds=sorted(df.cutoff.unique())[-3:];reports=[];predictions=[]
    for cutoff in folds:
        eligible=df[df.labelThrough<=cutoff] # every training label was complete at test cutoff
        calibration_cutoff=eligible.cutoff.max();train=eligible[eligible.cutoff<calibration_cutoff];cal=eligible[eligible.cutoff==calibration_cutoff];test=df[df.cutoff==cutoff]
        assert train.labelThrough.max()<=cutoff and test.labelThrough.max()<manifest['season']
        models={'ridge':make_pipeline(StandardScaler(),Ridge(alpha=20)),'boosted':HistGradientBoostingRegressor(max_iter=150,max_leaf_nodes=15,l2_regularization=10,learning_rate=.05,random_state=42)}
        outputs={'baseline':test.baseline.to_numpy()};cal_outputs={'baseline':cal.baseline.to_numpy()}
        for name,model in models.items():
            model.fit(train[FEATURES],train.target);outputs[name]=np.maximum(0,model.predict(test[FEATURES]));cal_outputs[name]=np.maximum(0,model.predict(cal[FEATURES]))
        outputs['blend']=(outputs['ridge']+outputs['boosted']+outputs['baseline'])/3
        cal_outputs['blend']=(cal_outputs['ridge']+cal_outputs['boosted']+cal_outputs['baseline'])/3
        for name,pred in outputs.items():
            residual=np.abs(cal.target.to_numpy()-cal_outputs[name]);radius=float(np.quantile(residual,.8));m=metrics(test.target.to_numpy(),pred,test.position.to_numpy());m['interval80Coverage']=float(np.mean(np.abs(test.target.to_numpy()-pred)<=radius));m['intervalRadius']=radius
            reports.append({'cutoff':int(cutoff),'model':name,'trainingRows':len(train),'testRows':len(test),'trainingLabelsThrough':int(train.labelThrough.max()),**m})
            predictions.extend({'id':pid,'cutoff':int(cutoff),'model':name,'prediction':float(v),'actual':float(y),'position':p} for pid,v,y,p in zip(test.id,pred,test.target,test.position))
        print(f'Completed chronological fold {cutoff}',flush=True)
    summary={name:float(np.mean([r['mae'] for r in reports if r['model']==name])) for name in ['baseline','ridge','boosted','blend']}
    candidate=min(summary,key=summary.get)
    position_regressions=[p for p in POSITIONS if np.mean([r['byPosition'][p] for r in reports if r['model']==candidate])>1.05*np.mean([r['byPosition'][p] for r in reports if r['model']=='baseline'])]
    report={'snapshotId':manifest['id'],'target':'Discounted PPR production over next three complete seasons; not observed trade prices.','folds':reports,'meanMae':summary,'bestCandidate':candidate,'passesResearchGate':candidate!='baseline' and summary[candidate]<.97*summary['baseline'] and not position_regressions,'positionalRegressions':position_regressions,'publishedModel':'baseline-0.1.0','promotion':'Manual owner review required. These offseason experiments do not establish in-season responsiveness.','limitations':['Historical input files contain retrospective corrections; as-known-then source snapshots are unavailable.','Players with historical NFL statistical appearances are retained even if retired or absent in future seasons. Zero future production is a valid label.','Undrafted and unsuccessful prospects without any NFL statistical appearance are not represented in this feature cohort.','Current team, active status, injury status, and later draft/career achievements are not historical features.','No market-lag advantage has been established. No auto-promotion.']}
    (OUTPUT/'backtest-report.json').write_text(json.dumps(report,indent=2));pd.DataFrame(predictions).to_parquet(OUTPUT/'predictions.parquet',index=False)
    print(json.dumps({'meanMae':summary,'bestCandidate':candidate,'passesResearchGate':report['passesResearchGate']}))
if __name__=='__main__':main()
