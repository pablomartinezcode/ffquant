import {defaultConfig,rankPlayers,type Dataset,type Config} from './football.ts';

export const historyFormats=['1qb','sf'] as const;
export type HistoryFormat=typeof historyFormats[number];
export function historyConfig(format:HistoryFormat):Config{return {...defaultConfig,superflex:format==='sf'};}
export function rankingObservations(data:Dataset){
  const m=data.manifest,week=m.statsThroughWeek;
  if(!Number.isInteger(week)||week!<0||week!>18)throw new Error('A statistical through-week is required for ranking history.');
  return historyFormats.flatMap(format=>{
    const config=historyConfig(format);
    return rankPlayers(data.players,config).map(p=>({snapshot_id:m.id,player_id:p.id,format,
      season:m.season,week:week!,rank:p.rank,position_rank:p.positionRank,rating:p.rating,
      value:p.value,ppg:p.ppg,config:JSON.stringify(config),recorded_at:m.builtAt}));
  });
}

// Select a publication for the entire universe first, so a player removed later
// in the same week cannot leave a misleading stale row in the weekly view.
export const weeklyHistorySql=`WITH publications AS (
  SELECT s.id,s.manifest,s.created_at,
    ROW_NUMBER() OVER (PARTITION BY json_extract(s.manifest,'$.season'),json_extract(s.manifest,'$.statsThroughWeek')
      ORDER BY json_extract(s.manifest,'$.builtAt') DESC,s.created_at DESC,s.id DESC) AS revision
  FROM snapshots s WHERE s.state='ready' AND EXISTS (SELECT 1 FROM ranking_history h WHERE h.snapshot_id=s.id AND h.format=?)
)
SELECT h.*,json_extract(s.manifest,'$.modelVersion') AS model_version,
  json_extract(s.manifest,'$.sourceUpdatedAt') AS source_updated_at
FROM ranking_history h JOIN publications s ON s.id=h.snapshot_id
WHERE s.revision=1 AND h.player_id=? AND h.format=?
ORDER BY h.season DESC,h.week DESC LIMIT 156`;

export interface WeeklyRanking {snapshot_id:string;player_id:string;format:HistoryFormat;season:number;week:number;rank:number;position_rank:number;rating:number;value:number;ppg:number;config:string;recorded_at:string;model_version:string;source_updated_at:string;rank_change:number|null;model_changed:boolean}
export function withRankChanges(rows:Omit<WeeklyRanking,'rank_change'|'model_changed'>[]):WeeklyRanking[]{
  return rows.map((r,i)=>{
    const prior=rows[i+1],consecutive=!!prior&&r.season===prior.season&&r.week===prior.week+1;
    return {...r,rank_change:consecutive?prior.rank-r.rank:null,model_changed:consecutive&&r.model_version!==prior.model_version};
  });
}
