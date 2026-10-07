import { z } from 'zod';
import { db, audit } from './server';
import { configSchema, scoringWarnings } from './football';
const leagueSchema=z.object({league_id:z.string(),name:z.string(),season:z.string(),status:z.string(),total_rosters:z.number(),scoring_settings:z.record(z.number()),roster_positions:z.array(z.string()),settings:z.record(z.unknown()).nullable().optional(),previous_league_id:z.string().nullable().optional()}).passthrough();
const rosterSchema=z.object({roster_id:z.number().int(),owner_id:z.string().nullable(),players:z.array(z.string()).nullable(),starters:z.array(z.string()).nullable().optional(),reserve:z.array(z.string()).nullable().optional(),taxi:z.array(z.string()).nullable().optional()}).passthrough();
export async function sleeper(path:string,ttl=300_000){
  if(!/^\/(user|league|state)\/[A-Za-z0-9_\/-]+$/.test(path))throw new Error('Invalid Sleeper path.');
  const key=`sleeper:${path}`,cached=await db().prepare('SELECT payload, expires, fetched_at FROM upstream_cache WHERE key=?').bind(key).first<{payload:string;expires:number;fetched_at:string}>();
  if(cached&&cached.expires>Date.now())return {data:JSON.parse(cached.payload),fetchedAt:cached.fetched_at,stale:false};
  try{
    let response:Response|undefined;
    for(let i=0;i<3;i++){response=await fetch(`https://api.sleeper.app/v1${path}`,{signal:AbortSignal.timeout(12000)});if(response.ok||![429,500,502,503,504].includes(response.status))break;await new Promise(r=>setTimeout(r,300*2**i));}
    if(!response?.ok)throw new Error(`Sleeper is unavailable (${response?.status??'network'}).`);
    const data=await response.json();if(data==null)throw new Error('Sleeper could not find this username or league.');
    const fetchedAt=new Date().toISOString();await db().prepare('INSERT INTO upstream_cache (key,payload,expires,fetched_at) VALUES (?,?,?,?) ON CONFLICT(key) DO UPDATE SET payload=excluded.payload,expires=excluded.expires,fetched_at=excluded.fetched_at').bind(key,JSON.stringify(data),Date.now()+ttl,fetchedAt).run();
    return {data,fetchedAt,stale:false};
  }catch(e){if(cached)return {data:JSON.parse(cached.payload),fetchedAt:cached.fetched_at,stale:true};throw e;}
}
export async function importLeague(id:string){
  if(!/^\d{8,24}$/.test(id))throw new Error('Enter a valid Sleeper league ID.');
  const [l,r,u,p,d]=await Promise.all([sleeper(`/league/${id}`),sleeper(`/league/${id}/rosters`),sleeper(`/league/${id}/users`),sleeper(`/league/${id}/traded_picks`),sleeper(`/league/${id}/drafts`)]);
  const league=leagueSchema.parse(l.data),rosters=z.array(rosterSchema).parse(r.data);
  const supported=['QB','RB','WR','TE','FLEX','SUPER_FLEX','REC_FLEX','WRRB_FLEX'];
  const warnings=scoringWarnings(league.scoring_settings);
  const unsupported=league.roster_positions.filter(s=>!supported.includes(s)&&s!=='BN');
  if(unsupported.length)warnings.push(`Unsupported lineup positions: ${[...new Set(unsupported)].join(', ')}. Rankings cover offensive players only.`);
  if([l,r,u,p,d].some(x=>x.stale))warnings.push('Sleeper refresh failed. Showing the last cached league snapshot.');
  const config=configSchema.parse({teams:league.total_rosters,superflex:league.roster_positions.includes('SUPER_FLEX'),ppr:league.scoring_settings.rec??0,tep:league.scoring_settings.bonus_rec_te??0,slots:league.roster_positions.filter(s=>supported.includes(s)),rosterSize:league.roster_positions.filter(s=>s==='BN'||supported.includes(s)).length,scoring:league.scoring_settings});
  await audit('league_import',{leagueId:id,rosters:rosters.length});
  return {league,rosters,users:u.data,tradedPicks:p.data,drafts:d.data,config,warnings,fetchedAt:l.fetchedAt};
}
