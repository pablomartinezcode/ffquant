import { z } from 'zod';
import { assetSchema,configSchema,rankPlayers,evaluateTrade } from '@/lib/football';
import { body,dataset,failure,json } from '@/lib/server';
import { importLeague } from '@/lib/sleeper';
export async function POST(request:Request){try{
  const input=z.object({sides:z.tuple([z.array(assetSchema).max(60),z.array(assetSchema).max(60)]),config:configSchema,leagueId:z.string().optional(),rosterIds:z.tuple([z.number().int(),z.number().int()]).optional()}).strict().parse(await body(request,50000));
  const d=await dataset();let config=input.config,context;let warnings:string[]=[];
  if(input.leagueId&&input.rosterIds){
    if(input.rosterIds[0]===input.rosterIds[1])throw new Error('Choose two different rosters.');
    const league=await importLeague(input.leagueId);config=league.config;warnings=league.warnings;
    const map=new Map(d.players.map(p=>[p.sleeperId,p.id]));
    const selected=input.rosterIds.map(id=>{const r=league.rosters.find(r=>r.roster_id===id);if(!r)throw new Error('Roster not found.');return r;});
    const allRosterIds=selected.map(r=>(r.players??[]).map(id=>map.get(id)).filter((id):id is string=>!!id));
    const ids=selected.map(r=>(r.players??[]).filter(id=>!(r.reserve??[]).includes(id)&&!(r.taxi??[]).includes(id)).map(id=>map.get(id)).filter((id):id is string=>!!id)) as [string[],string[]];
    input.sides.forEach((side,i)=>side.forEach(asset=>{
      if(asset.kind==='player'&&!allRosterIds[i].includes(asset.id))throw new Error('A selected player is not on the sending roster.');
      if(asset.kind==='player'&&!ids[i].includes(asset.id))throw new Error('IR/taxi transfers require eligibility decisions this beta does not model. Use generic analysis for this package.');
      if(asset.kind==='pick'&&asset.originalRosterId!==undefined){const traded=league.tradedPicks.find((p:{season:string;round:number;roster_id:number})=>Number(p.season)===asset.year&&p.round===asset.round&&p.roster_id===asset.originalRosterId);const owner=traded?.owner_id??asset.originalRosterId;if(owner!==input.rosterIds![i])throw new Error('The selected roster does not own that pick.');}
    }));
    const owned=new Set(league.rosters.flatMap(r=>r.players??[]));
    const unsupportedStarters=league.league.roster_positions.filter(s=>!['QB','RB','WR','TE','FLEX','SUPER_FLEX','REC_FLEX','WRRB_FLEX','BN'].includes(s)).length;
    context={rosters:ids,available:d.players.filter(p=>!owned.has(p.sleeperId)).map(p=>p.id),capacity:config.rosterSize+unsupportedStarters,reservedSlots:selected.map((r,i)=>(r.players??[]).filter(id=>!(r.reserve??[]).includes(id)&&!(r.taxi??[]).includes(id)).length-ids[i].length) as [number,number]};
  }
  const result=evaluateTrade(input.sides,rankPlayers(d.players,config),config,d.manifest.season+(d.manifest.week>0?1:0),context);
  return json({...result,limitations:[...result.limitations,...warnings],snapshotId:d.manifest.id,modelVersion:d.manifest.modelVersion});
}catch(e){return failure(e);}}
