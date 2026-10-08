import { z } from 'zod';
export const positions = ['QB','RB','WR','TE'] as const;
export const MODEL_VERSION = 'baseline-0.3.1';
export type Position = typeof positions[number];
export type Stats = Record<string, number | null>;
export interface Player {
  id:string;sleeperId:string;name:string;position:Position;team:string;age:number|null;status:string;statusAsOf:string;draftRound:number|null;draftPick:number|null;experience:number|null;mapping:string;
  forecast:Stats;previousForecast:Stats|null;currentForm:number|null;gamesThisSeason:number;remainingGames:number;nextOpponent:string|null;matchupFactor:number;confidence:string;
  dynastyForecasts?:Stats[]|null;previousDynastyForecasts?:Stats[]|null;
  draftPrior?:{bucket:string;count:number;hitRate:number;throughDraft:number}|null;
  depthOrder?:number|null;recentAppearances?:number;valuationEligible?:boolean;
  dynastyEligible?:boolean;rosterStatus?:string;rosterWeek?:number;rosterAsOf?:string;sampleSeason?:number;
  qbRole?:{current:number;dynasty:number;label:string;basis:string};
  scoreSamples?:{season:number;week:number;stats:Stats}[];
}
export interface Manifest {
  id:string;modelVersion:string;season:number;week:number;builtAt:string;sourceUpdatedAt:string;firstSeason:number;playerCount:number;historicalPlayerCount:number;historyRows:number;unmatchedCount:number;limitations:string[];
  coverage:{season:number;rows:number;players:number;lastWeek:number;fields:Record<string,number>}[];
  sources:{url:string;fetchedAt:string;sourceUpdatedAt:string|null;sha256:string}[];
}
export interface Dataset {manifest:Manifest;players:Player[]}
export interface SeasonStats {id:string;name:string;position:Position;season:number;age:number|null;careerYear:number;team:string;games:number;stats:Stats;ppg:number;percentile:number}
export interface PlayerDetail {id:string;player:Player|null;seasons:SeasonStats[];weekly:{season:number;week:number;team:string;opponent:string;stats:Stats}[];snapshotId:string}
export const scoringMap:Record<string,string>={pass_yd:'passing_yards',pass_td:'passing_tds',pass_int:'passing_interceptions',pass_2pt:'passing_2pt_conversions',rush_yd:'rushing_yards',rush_td:'rushing_tds',rush_2pt:'rushing_2pt_conversions',rec:'receptions',rec_yd:'receiving_yards',rec_td:'receiving_tds',rec_2pt:'receiving_2pt_conversions',fum_lost:'fumbles_lost_total',pass_fd:'passing_first_downs',rush_fd:'rushing_first_downs',rec_fd:'receiving_first_downs'};
export const defaultScoring={pass_yd:.04,pass_td:4,pass_int:-2,pass_2pt:2,rush_yd:.1,rush_td:6,rush_2pt:2,rec:1,rec_yd:.1,rec_td:6,rec_2pt:2,fum_lost:-2};
export const configSchema=z.object({teams:z.number().int().min(4).max(32).default(12),superflex:z.boolean().default(false),ppr:z.number().min(0).max(2).default(1),tep:z.number().min(0).max(2).default(0),slots:z.array(z.enum(['QB','RB','WR','TE','FLEX','SUPER_FLEX','REC_FLEX','WRRB_FLEX'])).max(30).optional(),rosterSize:z.number().int().min(1).max(100).default(25),scoring:z.record(z.number().finite()).optional()}).strict();
export type Config=z.infer<typeof configSchema>;
export const defaultConfig:Config=configSchema.parse({});
export function points(s:Stats,pos:Position,c:Config):number {const scoring=c.scoring??{...defaultScoring,rec:c.ppr};return Object.entries(scoring).reduce((total,[key,w])=>total+(s[scoringMap[key]]??0)*w,0)+(pos==='TE'?(s.receptions??0)*c.tep:0);}
// These categories score the kicker or team defense, not QB/RB/WR/TE assets.
const defenseScoring=new Set(['sack','sack_yd','int','int_ret_yd','ff','fum_rec','fum_ret_yd','safe','blk_kick','def_td','def_st_td','def_st_ff','def_st_fum_rec','def_2pt','def_3_and_out','def_4_and_stop','def_pass_def','tkl','tkl_solo','tkl_ast','tkl_loss','qb_hit']);
export function excludedScoringRule(key:string){return /^(fgm|fgmiss|xpm|pts_allow_|yds_allow_|def_st_)/.test(key)||defenseScoring.has(key);}
const playerRuleNames:Record<string,string>={st_td:'special-teams touchdowns',st_fum_rec:'special-teams fumble recoveries',st_ff:'special-teams forced fumbles',fum_rec_td:'fumble-recovery touchdowns'};
export function scoringWarnings(scoring:Record<string,number>):string[]{
  const unsupported=Object.entries(scoring).filter(([k,v])=>v!==0&&!(k in scoringMap)&&k!=='bonus_rec_te'&&!excludedScoringRule(k)).map(([k])=>k);
  if(!unsupported.length)return [];
  return [`Player-scoring coverage: ${unsupported.map(k=>playerRuleNames[k]??k).join(', ')} are not yet modeled. Values are approximate for players affected by these rules.`];
}
export const valueFromRating=(r:number)=>10000*Math.expm1(4*(Math.max(1,Math.min(100,r))-1)/99)/Math.expm1(4);
export const ratingFromValue=(v:number)=>Math.max(1,Math.min(100,1+99*Math.log1p(Math.max(0,v)*Math.expm1(4)/10000)/4));
export function lineupSlots(c:Config):string[]{return c.slots??['QB','RB','RB','WR','WR','TE','FLEX',...(c.superflex?['SUPER_FLEX']:[])];}
export function eligible(pos:Position,slot:string){return slot===pos||slot==='SUPER_FLEX'||(slot==='FLEX'&&pos!=='QB')||(slot==='REC_FLEX'&&['WR','TE'].includes(pos))||(slot==='WRRB_FLEX'&&['WR','RB'].includes(pos));}
export interface ScoringSpread {count:number;median:number;mean:number;sd:number|null;low:number|null;high:number|null;q25:number;q75:number;first:string;last:string}
export function scoringSpread(p:Player,c:Config):ScoringSpread|null {
  const samples=p.scoreSamples??[];if(!samples.length)return null;
  const scores=samples.map(g=>points(g.stats,p.position,c)).sort((a,b)=>a-b),n=scores.length;
  const quantile=(q:number)=>{const index=(n-1)*q,lo=Math.floor(index);return scores[lo]+(scores[Math.ceil(index)]-scores[lo])*(index-lo);};
  const mean=scores.reduce((a,b)=>a+b,0)/n,median=quantile(.5),sd=n>1?Math.sqrt(scores.reduce((s,v)=>s+(v-mean)**2,0)/(n-1)):null;
  return {count:n,median,mean,sd,low:sd===null?null:median-sd,high:sd===null?null:median+sd,q25:quantile(.25),q75:quantile(.75),first:`${samples[0].season} W${samples[0].week}`,last:`${samples[n-1].season} W${samples[n-1].week}`};
}
// Research-informed regularization, not a hard retirement age. Compare future to today's curve.
export function ageRetention(pos:Position,age:number,years:number,rushing=false){
  const [start,rate,late,lateRate]=pos==='QB'?(rushing?[28,.025,33,.025]:[32,.012,36,.025]):({RB:[24,.035,28,.025],WR:[27,.020,31,.025],TE:[28,.017,32,.025]}[pos]);
  const loss=(a:number)=>rate*Math.max(0,a-start)**2+lateRate*Math.max(0,a-late)**2;
  return Math.exp(-(loss(age+years)-loss(age)));
}
export function ageForecast(fc:Stats,pos:Position,age:number,years:number):Stats {
  return Object.fromEntries(Object.entries(fc).map(([k,v])=>[k,v===null?null:v*ageRetention(pos,age,years,pos==='QB'&&(k.startsWith('rushing_')||k==='carries'))]));
}
export function roleAvailability(p:Player){
  if(p.valuationEligible===false)return 0;
  if(p.qbRole)return p.qbRole.dynasty;
  if(p.team==='FA')return .2;
  if(p.position!=='QB')return 1;
  if(p.depthOrder===1)return 1;
  if(p.depthOrder!=null)return p.depthOrder===2?.2:.08;
  return (p.forecast.passing_yards??0)>=150&&(p.recentAppearances??p.gamesThisSeason)>0?.75:.15;
}
export interface RankedPlayer extends Player {rating:number;value:number;ppg:number;nextGamePoints:number;rosPoints:number;change:number|null;rank:number;positionRank:number;replacementPpg:number;explanation:string[];spread:ScoringSpread|null}
export function isDynastyPlayer(p:Player){
  return p.dynastyEligible!==false&&p.valuationEligible!==false&&p.team!=='FA'&&!!p.team&&!/retir/i.test(p.status??'')&&(!p.rosterStatus||!['RET','CUT','UFA','RFA','TRC','TRD','TRT','RSR'].includes(p.rosterStatus));
}
export type RankingSort='value'|'form'|'ppg'|'median'|'sd';
export function qualifiedScoringSample(p:RankedPlayer){return (p.spread?.count??0)>=4&&(p.position!=='QB'||roleAvailability(p)>=.75);}
export function sortRankings(players:RankedPlayer[],sort:RankingSort){
  return players.filter(isDynastyPlayer).sort((a,b)=>{
    if(['median','sd','form'].includes(sort)){
      const aq=qualifiedScoringSample(a),bq=qualifiedScoringSample(b);
      if(aq!==bq)return aq?-1:1;
      if(!aq)return b.value-a.value||b.ppg-a.ppg||a.id.localeCompare(b.id);
    }
    const delta=sort==='form'?(b.currentForm??-Infinity)-(a.currentForm??-Infinity):sort==='ppg'?b.ppg-a.ppg:sort==='median'?(b.spread?.median??-Infinity)-(a.spread?.median??-Infinity):sort==='sd'?(a.spread?.sd??Infinity)-(b.spread?.sd??Infinity):b.value-a.value;
    return (Number.isNaN(delta)?0:delta)||b.value-a.value||b.ppg-a.ppg||a.id.localeCompare(b.id);
  });
}
export function rankPlayers(players:Player[],config:Config):RankedPlayer[]{
  players=players.filter(isDynastyPlayer);
  const usable=(p:Player)=>Math.max(0,points(p.forecast,p.position,config))*roleAvailability(p);
  const pools=Object.fromEntries(positions.map(pos=>[pos,players.filter(p=>p.position===pos&&p.valuationEligible!==false&&p.team!=='FA').sort((a,b)=>usable(b)-usable(a))])) as Record<Position,Player[]>;
  const demand=Object.fromEntries(positions.map(p=>[p,lineupSlots(config).filter(s=>s===p).length*config.teams])) as Record<Position,number>;
  for(const slot of lineupSlots(config).filter(s=>!positions.includes(s as Position))){for(let i=0;i<config.teams;i++){const candidates=positions.filter(p=>eligible(p,slot)).sort((a,b)=>(pools[b][demand[b]]?usable(pools[b][demand[b]]):0)-(pools[a][demand[a]]?usable(pools[a][demand[a]]):0));demand[candidates[0]]++;}}
  const replacement=Object.fromEntries(positions.map(pos=>{const p=pools[pos][Math.min(pools[pos].length-1,Math.ceil(demand[pos]*1.4))];return [pos,p?usable(p):0];})) as Record<Position,number>;
  // Superflex has a non-QB alternative: an unavailable backup cannot make every starter elite.
  if(lineupSlots(config).includes('SUPER_FLEX')&&lineupSlots(config).filter(s=>s==='QB').length<=1)
    replacement.QB=Math.max(replacement.QB,...positions.filter(p=>p!=='QB').map(p=>replacement[p]));
  function valuation(p:Player,fc:Stats,future=p.dynastyForecasts){
    const role=roleAvailability(p),ppg=Math.max(0,points(fc,p.position,config))*role,age=p.age??25;
    const value=[p.remainingGames,17,17].reduce((sum,g,y)=>{
      // Early-career draft outcomes already describe development; the age curve only handles later decline.
      const forecast=y===0?fc:ageForecast(future?.[y-1]??fc,p.position,age,y);
      // A young QB's draft-based long-term outlook is distinct from his current backup job.
      const futureRole=y>0&&p.draftPrior&&p.position==='QB'&&p.team!=='FA'?Math.max(role,.65*Math.exp(-(p.experience??0)/2)):role;
      return sum+Math.max(0,points(forecast,p.position,config)*futureRole-replacement[p.position])*g*Math.pow(.85,y)*14;
    },0);
    return {value,ppg};
  }
  const ranked=players.map(p=>{const {value,ppg}=valuation(p,p.forecast),rating=ratingFromValue(value),previous=p.previousForecast?ratingFromValue(valuation(p,p.previousForecast,p.previousDynastyForecasts??undefined).value):null;
    return {...p,value,rating,ppg,spread:scoringSpread(p,config),nextGamePoints:Math.max(0,points(p.forecast,p.position,config))*(p.qbRole?.current??roleAvailability(p))*p.matchupFactor,rosPoints:ppg*p.remainingGames,change:previous===null?null:rating-previous,rank:0,positionRank:0,replacementPpg:replacement[p.position],explanation:[`${p.gamesThisSeason} current-season statistical appearances; recent production is shrunk toward established or draft-cohort production.`,`${Math.max(0,ppg-replacement[p.position]).toFixed(1)} projected points per game above a ${replacement[p.position].toFixed(1)}-point ${p.position} replacement.`,`Age ${p.age??'unknown'}; ${p.position==='QB'?'passing and rushing age separately':'position-specific continuous aging'}. Remaining season plus two future seasons, discounted 15% per year.`,...(p.qbRole?[`${p.qbRole.label}: current-role weight ${Math.round(p.qbRole.current*100)}%, dynasty-role weight ${Math.round(p.qbRole.dynasty*100)}%. ${p.qbRole.basis}`]:[]),...(p.draftPrior?[`Draft picks ${p.draftPrior.bucket}: ${p.draftPrior.count} historical ${p.position}s through ${p.draftPrior.throughDraft}; ${(p.draftPrior.hitRate*100).toFixed(0)}% met the disclosed three-year hit threshold. Draft evidence fades gradually with NFL experience.`]:[]),...(roleAvailability(p)<1?[`Role/availability weight ${(roleAvailability(p)*100).toFixed(0)}%; ${p.valuationEligible===false?'no recent NFL evidence or current prospect eligibility':p.team==='FA'?'free agent':'QB depth-order estimate'}. This is not an injury forecast.`]:[]),p.confidence==='low'?'Limited history: wider uncertainty; not a calibrated confidence interval.':'Projection combines recent performance and established production.']};
  }).sort((a,b)=>b.value-a.value||b.ppg-a.ppg||a.id.localeCompare(b.id));
  const counts:Record<string,number>={};return ranked.map((p,i)=>({...p,rank:i+1,positionRank:counts[p.position]=(counts[p.position]??0)+1}));
}
export const pickSchema=z.object({kind:z.literal('pick'),year:z.number().int(),round:z.number().int().min(1).max(5),slot:z.union([z.number().int().min(1).max(32),z.enum(['early','mid','late'])]),originalRosterId:z.number().int().optional()}).strict();
export const assetSchema=z.union([z.object({kind:z.literal('player'),id:z.string().min(1).max(80)}).strict(),pickSchema]);
export type Asset=z.infer<typeof assetSchema>;
export function assetKey(a:Asset){return a.kind==='player'?a.id:`pick:${a.year}:${a.round}:${a.slot}:${a.originalRosterId??''}`;}
export function pickValue(a:z.infer<typeof pickSchema>,c:Config,firstDraft:number){if(a.year<firstDraft||a.year>firstDraft+2)throw new Error('Picks must fall within the next three rookie drafts.');const slot=typeof a.slot==='number'?a.slot:Math.max(1,Math.round(c.teams*({early:.2,mid:.5,late:.85}[a.slot])));if(slot>c.teams)throw new Error('Pick slot exceeds league size.');return 5500*Math.exp(-.1*((a.round-1)*c.teams+slot-1))*Math.pow(.85,a.year-firstDraft)*(c.superflex?1.15:1);}
export function bestLineup(players:RankedPlayer[],slots:string[]):number {
  const n=players.length,m=slots.length,source=0,sink=1+n+m;
  const graph:{to:number;rev:number;cap:number;cost:number}[][]=Array.from({length:sink+1},()=>[]);
  const add=(a:number,b:number,cost:number)=>{graph[a].push({to:b,rev:graph[b].length,cap:1,cost});graph[b].push({to:a,rev:graph[a].length-1,cap:0,cost:-cost});};
  players.forEach((p,i)=>{add(source,i+1,0);slots.forEach((s,j)=>{if(eligible(p.position,s))add(i+1,n+1+j,-p.ppg);});});slots.forEach((_,j)=>add(n+1+j,sink,0));let total=0;
  for(let k=0;k<m;k++){const d=Array(sink+1).fill(Infinity),prev:number[][]=Array(sink+1);d[source]=0;
    for(let it=0;it<sink;it++){let changed=false;graph.forEach((edges,u)=>edges.forEach((e,j)=>{if(e.cap&&d[u]+e.cost<d[e.to]-1e-9){d[e.to]=d[u]+e.cost;prev[e.to]=[u,j];changed=true;}}));if(!changed)break;}
    if(!Number.isFinite(d[sink])||d[sink]>=0)break;total-=d[sink];for(let v=sink;v!==source;){const [u,j]=prev[v],e=graph[u][j];e.cap--;graph[v][e.rev].cap++;v=u;}}
  return total;
}
export interface TradeContext {rosters:[string[],string[]];available:string[];capacity:number;reservedSlots?:[number,number]}
export function evaluateTrade(sides:[Asset[],Asset[]],ranked:RankedPlayer[],config:Config,firstDraft:number,context?:TradeContext){
  const all=sides.flat(),keys=all.map(assetKey);if(new Set(keys).size!==keys.length)throw new Error('The same asset cannot appear more than once.');if(sides.some(s=>!s.length))throw new Error('Add at least one asset to each side.');if(sides.some(s=>s.length>60))throw new Error('At most 60 assets per side.');
  const map=new Map(ranked.map(p=>[p.id,p]));const worth=(a:Asset)=>{if(a.kind==='pick')return pickValue(a,config,firstDraft);const p=map.get(a.id);if(!p)throw new Error('Unknown player.');return p.value;};const raw=sides.map(s=>s.reduce((sum,a)=>sum+worth(a),0));
  const details=sides.map((sent,i)=>{
    const incoming=sides[1-i],outgoingIds=sent.filter(a=>a.kind==='player').map(a=>a.id),incomingIds=incoming.filter(a=>a.kind==='player').map(a=>a.id);
    const before=context?context.rosters[i].map(id=>map.get(id)).filter((p):p is RankedPlayer=>!!p):outgoingIds.map(id=>map.get(id)!);
    if(context&&outgoingIds.some(id=>!context.rosters[i].includes(id)))throw new Error('A selected player is not on the sending roster.');
    let after=[...before.filter(p=>!outgoingIds.includes(p.id)),...incomingIds.map(id=>map.get(id)!)];const capacity=context?Math.max(0,context.capacity-(context.reservedSlots?.[i]??0)):Math.min(config.rosterSize,Math.max(outgoingIds.length,incomingIds.length));
    const cuts=after.sort((a,b)=>b.value-a.value).slice(capacity);after=after.slice(0,capacity);const open=Math.max(0,outgoingIds.length-incomingIds.length);
    const free=(context?context.available.map(id=>map.get(id)).filter((p):p is RankedPlayer=>!!p):ranked.slice(config.teams*config.rosterSize)).filter(p=>!all.some(a=>a.kind==='player'&&a.id===p.id)).sort((a,b)=>b.value-a.value);
    const pickups=free.slice(0,Math.min(open,Math.max(0,capacity-after.length)));after=[...after,...pickups];
    return {sent:raw[i],received:raw[1-i],cuts:cuts.map(p=>({id:p.id,name:p.name,value:p.value})),pickups:pickups.map(p=>({id:p.id,name:p.name,value:p.value})),net:raw[1-i]-raw[i]-cuts.reduce((s,p)=>s+p.value,0)+pickups.reduce((s,p)=>s+p.value,0),lineupDelta:bestLineup(after,lineupSlots(config))-bestLineup(before,lineupSlots(config))};});
  const gap=details[0].net-details[1].net;return {sides:details,gap,edge:Math.abs(gap)<.1?'Even exchange':gap>0?'Side A receives more adjusted value':'Side B receives more adjusted value',limitations:[...(!context?['Generic roster assumptions. Connect a league and select both rosters for actual cuts and waiver replacements.']:[]),...(all.some(a=>a.kind==='pick')?['Pick values are provisional; early/mid/late are scenarios, not predicted draft positions.']:[]),'Ratings are not additive. Values and lineup impact measure different outcomes.','Lineup impact assumes availability; daily statuses are not a live injury feed.']};
}
