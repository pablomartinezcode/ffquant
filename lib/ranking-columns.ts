import {isDynastyPlayer,points,scoringMap,defaultScoring,qualifiedScoringSample,type Config,type RankedPlayer,type SeasonStats} from './football.ts';

export type SortDirection='asc'|'desc';
export type StatBasis='total'|'perGame';
export interface RankingColumn {id:string;label:string;shortLabel?:string;group:'Core'|'Opportunity'|'Yards'|'Touchdowns'|'Other';width:number;direction:SortDirection;help?:string;fields?:string[];digits?:number;observed?:boolean}
export const rankingColumns:RankingColumn[]=[
  {id:'rank',label:'RK',group:'Core',width:48,direction:'asc'},
  {id:'name',label:'Player',group:'Core',width:212,direction:'asc'},
  {id:'age',label:'Age',group:'Core',width:70,direction:'asc'},
  {id:'value',label:'FFQ Rating',group:'Core',width:132,direction:'desc'},
  {id:'change',label:'Last Game Δ',group:'Core',width:128,direction:'desc'},
  {id:'form',label:'Current Form',group:'Core',width:138,direction:'desc'},
  {id:'ppg',label:'Projected PPG',shortLabel:'Proj. PPG',group:'Core',width:126,direction:'desc'},
  {id:'median',label:'Scoring Spread',group:'Core',width:196,direction:'desc'},
  {id:'games',label:'Games',group:'Opportunity',width:110,direction:'desc',observed:true,help:'Regular-season statistical appearances. Byes and games with no recorded statistics may be absent. This count is also the denominator for per-game statistics.'},
  {id:'targets',label:'Targets',group:'Opportunity',width:122,direction:'desc',observed:true,fields:['targets'],help:'Recorded passes targeted to this player. Observed regular-season production, not a projection.'},
  {id:'receptions',label:'Receptions',group:'Opportunity',width:134,direction:'desc',observed:true,fields:['receptions'],help:'Completed catches credited to this player during the regular season.'},
  {id:'carries',label:'Carries',group:'Opportunity',width:118,direction:'desc',observed:true,fields:['carries'],help:'Recorded rushing attempts during the regular season.'},
  {id:'attempts',label:'Pass Attempts',group:'Opportunity',width:152,direction:'desc',observed:true,fields:['attempts'],help:'Recorded pass attempts during the regular season.'},
  {id:'receiving_yards',label:'Receiving Yards',shortLabel:'Rec. Yards',group:'Yards',width:134,direction:'desc',observed:true,fields:['receiving_yards'],help:'Regular-season yards gained on receptions.'},
  {id:'rushing_yards',label:'Rushing Yards',shortLabel:'Rush Yards',group:'Yards',width:134,direction:'desc',observed:true,fields:['rushing_yards'],help:'Regular-season yards gained on rushing plays.'},
  {id:'passing_yards',label:'Passing Yards',shortLabel:'Pass Yards',group:'Yards',width:134,direction:'desc',observed:true,fields:['passing_yards'],help:'Regular-season passing yards credited to the passer.'},
  {id:'total_yards',label:'Total Yards',group:'Yards',width:134,direction:'desc',observed:true,fields:['passing_yards','rushing_yards','receiving_yards'],help:'Passing + rushing + receiving yards. Passing yards are included; use the individual yardage columns to compare specific roles.'},
  {id:'receiving_tds',label:'Receiving TDs',shortLabel:'Rec. TDs',group:'Touchdowns',width:126,direction:'desc',observed:true,fields:['receiving_tds'],help:'Regular-season receiving touchdowns.'},
  {id:'rushing_tds',label:'Rushing TDs',shortLabel:'Rush TDs',group:'Touchdowns',width:126,direction:'desc',observed:true,fields:['rushing_tds'],help:'Regular-season rushing touchdowns.'},
  {id:'passing_tds',label:'Passing TDs',shortLabel:'Pass TDs',group:'Touchdowns',width:126,direction:'desc',observed:true,fields:['passing_tds'],help:'Regular-season passing touchdowns credited to the passer.'},
  {id:'total_tds',label:'Total TDs',group:'Touchdowns',width:126,direction:'desc',observed:true,fields:['passing_tds','rushing_tds','receiving_tds'],help:'Passing + rushing + receiving touchdowns. Excludes return and fumble-recovery touchdowns.'},
  {id:'fantasy_points',label:'Fantasy Points',group:'Other',width:150,direction:'desc',observed:true,digits:1,help:'Observed regular-season fantasy points under the selected supported scoring rules, including the TE reception premium. Missing required source fields produce no value.'},
  {id:'sd',label:'Scoring SD',group:'Other',width:134,direction:'asc',digits:1,help:'Sample standard deviation of this season’s fantasy scores. Lower means less variation, not better production. Unavailable with fewer than two statistical appearances.'},
  {id:'trade_value',label:'Trade Value',group:'Other',width:138,direction:'desc',help:'Underlying dynasty value used by the trade calculator, before package-level roster adjustments. This is not the 1–100 FFQ Rating.'},
];
export const columnById=new Map(rankingColumns.map(c=>[c.id,c]));
export const defaultColumns=rankingColumns.filter(c=>c.group==='Core').map(c=>c.id);
export interface RankingSortState {key:string;direction:SortDirection}
export const defaultRankingSort:RankingSortState={key:'value',direction:'desc'};
export function toggleRankingSort(current:RankingSortState,key:string):RankingSortState{
  const column=columnById.get(key);if(!column)return current;
  return {key,direction:current.key===key?(current.direction==='asc'?'desc':'asc'):column.direction};
}

export function metricValue(p:RankedPlayer,column:RankingColumn,stats:Map<string,SeasonStats>,basis:StatBasis,config:Config):number|string|null{
  if(!column.observed){
    switch(column.id){
      case 'rank':return p.rank;case 'name':return p.name;case 'age':return p.age;
      case 'value':case 'trade_value':return p.value;
      case 'change':return p.change;case 'form':return p.currentForm;case 'ppg':return p.ppg;
      case 'median':return p.spread?.median??null;case 'sd':return p.spread?.sd??null;
      default:return null;
    }
  }
  const s=stats.get(p.id);if(!s)return null;
  if(column.id==='games')return s.games;
  let total:number;
  if(column.id==='fantasy_points'){
    // A supported score must not quietly treat absent data as zero.
    const scoring=config.scoring??{...defaultScoring,rec:config.ppr};
    const required=Object.entries(scoring).filter(([key,weight])=>weight!==0&&key in scoringMap).map(([key])=>scoringMap[key]);
    if(p.position==='TE'&&config.tep!==0)required.push('receptions');
    if(required.some(k=>s.stats[k]==null))return null;
    total=points(s.stats,p.position,config);
  }else{
    if(!column.fields||column.fields.some(k=>s.stats[k]==null))return null;
    total=column.fields.reduce((sum,k)=>sum+s.stats[k]!,0);
  }
  return basis==='perGame'?(s.games>0?total/s.games:null):total;
}

export function sortRankingTable(players:RankedPlayer[],sort:RankingSortState,stats:Map<string,SeasonStats>,basis:StatBasis,config:Config,qualifiedFirst:boolean){
  const column=columnById.get(sort.key)??columnById.get('value')!;
  return players.filter(isDynastyPlayer).slice().sort((a,b)=>{
    if(qualifiedFirst&&['form','median','sd'].includes(sort.key)){
      const qa=qualifiedScoringSample(a),qb=qualifiedScoringSample(b);
      if(qa!==qb)return qa?-1:1;
    }
    const av=metricValue(a,column,stats,basis,config),bv=metricValue(b,column,stats,basis,config);
    const am=av==null||(typeof av==='number'&&!Number.isFinite(av)),bm=bv==null||(typeof bv==='number'&&!Number.isFinite(bv));
    if(am!==bm)return am?1:-1; // Missing stays last in both directions.
    const delta=am&&bm?0:typeof av==='string'?av.localeCompare(String(bv)):Number(av)-Number(bv);
    return delta*(sort.direction==='asc'?1:-1)||a.rank-b.rank||a.id.localeCompare(b.id);
  });
}

export function readColumnPreferences(value:unknown):{columns:string[];basis:StatBasis}{
  const input=value as {columns?:unknown;basis?:unknown}|null;
  const selected=Array.isArray(input?.columns)?new Set(input.columns.filter((x):x is string=>typeof x==='string'&&columnById.has(x))):new Set(defaultColumns);
  selected.add('rank');selected.add('name');
  return {columns:rankingColumns.filter(c=>selected.has(c.id)).map(c=>c.id),basis:input?.basis==='perGame'?'perGame':'total'};
}
