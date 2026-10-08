import { env } from 'cloudflare:workers';
import { z } from 'zod';
import { db,body,json,failure,ingestionAuth,audit } from '@/lib/server';
import { rankPlayers,defaultConfig,MODEL_VERSION,type Player } from '@/lib/football';
import { rankingObservations } from '@/lib/ranking-history';
import type { Manifest } from '@/lib/football';
const idSchema=z.string().regex(/^nfl-[a-f0-9]{20}$/);
const stats=z.record(z.number().finite().nullable());
const availabilitySchema=z.object({season:z.number().int(),throughWeek:z.number().int().min(0).max(18),missedGames:z.number().int().min(0).max(17).nullable(),missedWeeks:z.array(z.number().int().min(1).max(18)).max(17),trackedGames:z.number().int().min(0).max(18),unknownParticipationGames:z.number().int().min(0).max(18),practiceSquadGames:z.number().int().min(0).max(18),asOf:z.string(),label:z.string(),nextGameWeight:z.number().min(0).max(1),rosWeight:z.number().min(0).max(1),basis:z.string(),games:z.array(z.object({week:z.number().int().min(1).max(18),team:z.string(),status:z.string(),result:z.enum(['recorded','missed','practice','unknown'])})).max(18),conflicts:z.number().int().nonnegative()});
const transitionSchema=z.array(z.object({metric:z.enum(['attempts','carries','targets']),prior:z.number().finite(),openingMedian:z.number().finite(),observations:z.number().int().min(3).max(6),direction:z.enum(['up','down']),priorReduction:z.number().min(0).max(.75)})).max(3);
const playerSchema=z.object({availability:availabilitySchema,seasonTransition:transitionSchema,id:z.string().regex(/^[\w-]+$/),sleeperId:z.string(),name:z.string(),position:z.enum(['QB','RB','WR','TE']),team:z.string(),age:z.number().nullable(),status:z.string(),statusAsOf:z.string(),forecast:stats,previousForecast:stats.nullable(),currentForm:z.number().nullable(),remainingGames:z.number().min(0).max(17),gamesThisSeason:z.number().min(0).max(18),matchupFactor:z.number().min(.9).max(1.1),confidence:z.string(),mapping:z.string(),dynastyEligible:z.literal(true),rosterStatus:z.string(),rosterWeek:z.number().int(),rosterAsOf:z.string(),sampleSeason:z.number().int(),qbRole:z.object({current:z.number().min(0).max(1),dynasty:z.number().min(0).max(1),label:z.string(),basis:z.string()}).optional(),depthOrder:z.number().nonnegative().nullable(),recentAppearances:z.number().int().nonnegative(),valuationEligible:z.boolean(),dynastyForecasts:z.array(stats).length(2).nullable(),previousDynastyForecasts:z.array(stats).length(2).nullable(),scoreSamples:z.array(z.object({season:z.number().int(),week:z.number().int().min(1).max(18),stats})).max(17),draftPrior:z.object({bucket:z.string(),count:z.number().int().positive(),hitRate:z.number().min(0).max(1),throughDraft:z.number().int()}).passthrough().nullable()}).passthrough();
async function checksum(content:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(content)))).map(b=>b.toString(16).padStart(2,'0')).join('');}
export async function GET(request:Request){
  if(!await ingestionAuth(request))return json({error:'Unauthorized'},401);
  try{
    const rows=await db().prepare('SELECT id,state,expected,manifest,(SELECT COUNT(*) FROM players WHERE snapshot_id=s.id) AS players,(SELECT COUNT(*) FROM artifacts WHERE snapshot_id=s.id) AS artifacts,(SELECT COUNT(*) FROM ranking_history WHERE snapshot_id=s.id) AS rankingObservations FROM snapshots s ORDER BY created_at DESC LIMIT 3').all<{id:string;state:string;expected:number;manifest:string;players:number;artifacts:number;rankingObservations:number}>();
    return json({ready:!!env.BUCKET,protocol:2,snapshots:rows.results.map(s=>({id:s.id,state:s.state,players:s.players,expectedPlayers:s.expected,artifacts:s.artifacts,rankingObservations:s.rankingObservations,expectedArtifacts:Object.keys(JSON.parse(s.manifest).artifacts??{}).length}))});
  }catch(e){return failure(e,503);}
}
export async function POST(request:Request){
  if(!await ingestionAuth(request))return json({error:'Unauthorized'},401);
  try{const input=await body(request),id=idSchema.parse(input.id);
    if(input.action==='begin'){
      const m=z.object({id:idSchema,playerCount:z.number().int().min(1).max(10000),season:z.number().int().min(1999).max(2100),statsThroughWeek:z.number().int().min(0).max(18),sourceUpdatedAt:z.string(),modelVersion:z.literal(MODEL_VERSION),builtAt:z.string().datetime({offset:true}),artifacts:z.record(z.string().regex(/^[a-f0-9]{64}$/)),playerChecksums:z.record(z.string().regex(/^[a-f0-9]{64}$/))}).passthrough().parse(input.manifest);
      if(m.id!==id)throw new Error('Manifest identity mismatch.');
      if(Object.keys(m.playerChecksums).length!==m.playerCount)throw new Error('Player checksum count mismatch.');
      await db().prepare('INSERT INTO snapshots (id,manifest,state,expected,created_at) VALUES (?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(id,JSON.stringify(m),'staging',m.playerCount,new Date().toISOString()).run();const state=await db().prepare('SELECT state FROM snapshots WHERE id=?').bind(id).first<{state:string}>();return json({id,action:'begun',state:state?.state});
    }
    const snapshot=await db().prepare('SELECT state,expected,manifest FROM snapshots WHERE id=?').bind(id).first<{state:string;expected:number;manifest:string}>();if(!snapshot)throw new Error('Begin snapshot first.');
    if(input.action==='players'){
      if(snapshot.state==='ready')return json({id,immutable:true});
      const contents=z.array(z.string().max(20000)).min(1).max(100).parse(input.players),expected=JSON.parse(snapshot.manifest).playerChecksums as Record<string,string>;
      const players=await Promise.all(contents.map(async content=>{const p=playerSchema.parse(JSON.parse(content));if(expected[p.id]!==await checksum(content))throw new Error('Player checksum mismatch.');return {p,content};}));await db().batch(players.map(({p,content})=>db().prepare('INSERT INTO players (snapshot_id,id,sleeper_id,position,name,payload) VALUES (?,?,?,?,?,?) ON CONFLICT(snapshot_id,id) DO UPDATE SET payload=excluded.payload,sleeper_id=excluded.sleeper_id,position=excluded.position,name=excluded.name').bind(id,p.id,p.sleeperId,p.position,p.name,content)));return json({received:players.length});
    }
    if(input.action==='artifact'){
      if(snapshot.state==='ready')throw new Error('Published snapshots are immutable.');
      const key=z.string().regex(/^(players\/[\w-]+|history\/\d{4}|history-index|report)\.json$/).parse(input.key),content=z.string().max(1_500_000).parse(input.content);
      const sha=await checksum(content);
      if(JSON.parse(snapshot.manifest).artifacts?.[key]!==sha)throw new Error('Artifact checksum does not match manifest.');JSON.parse(content);
      if(!env.BUCKET)throw new Error('Artifact storage unavailable.');await env.BUCKET.put(`${id}/${key}`,content,{httpMetadata:{contentType:'application/json'}});
      await db().prepare('INSERT INTO artifacts (snapshot_id,key,sha256) VALUES (?,?,?) ON CONFLICT(snapshot_id,key) DO UPDATE SET sha256=excluded.sha256').bind(id,key,sha).run();return json({stored:key});
    }
    if(input.action==='publish'){
      const manifest=JSON.parse(snapshot.manifest) as Manifest;
      if(manifest.modelVersion!==MODEL_VERSION)throw new Error('Snapshot model version is no longer current.');
      const count=await db().prepare('SELECT COUNT(*) AS n FROM players WHERE snapshot_id=?').bind(id).first<{n:number}>();if(count?.n!==snapshot.expected)throw new Error(`Incomplete snapshot: ${count?.n??0}/${snapshot.expected} players.`);
      const artifactCount=await db().prepare('SELECT COUNT(*) AS n FROM artifacts WHERE snapshot_id=?').bind(id).first<{n:number}>(),expectedArtifacts=Object.keys(JSON.parse(snapshot.manifest).artifacts??{}).length;if(artifactCount?.n!==expectedArtifacts)throw new Error(`Incomplete snapshot: ${artifactCount?.n??0}/${expectedArtifacts} artifacts.`);
      const rows=await db().prepare('SELECT payload FROM players WHERE snapshot_id=?').bind(id).all<{payload:string}>(),ranked=rankPlayers(rows.results.map(r=>JSON.parse(r.payload) as Player),defaultConfig);
      const observations=rankingObservations({manifest,players:rows.results.map(r=>JSON.parse(r.payload) as Player)});
      for(let offset=0;offset<observations.length;offset+=50)await db().batch(observations.slice(offset,offset+50).map(r=>db().prepare('INSERT INTO ranking_history (snapshot_id,player_id,format,season,week,rank,position_rank,rating,value,ppg,config,recorded_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(snapshot_id,format,player_id) DO NOTHING').bind(r.snapshot_id,r.player_id,r.format,r.season,r.week,r.rank,r.position_rank,r.rating,r.value,r.ppg,r.config,r.recorded_at)));
      const historyCount=await db().prepare('SELECT COUNT(*) AS n FROM ranking_history WHERE snapshot_id=?').bind(id).first<{n:number}>();
      if(historyCount?.n!==observations.length)throw new Error('Incomplete ranking history; snapshot remains unpublished.');
      for(let offset=0;offset<ranked.length;offset+=100)await db().batch(ranked.slice(offset,offset+100).map(p=>db().prepare('INSERT INTO rating_history (snapshot_id,player_id,rating,value,recorded_at) VALUES (?,?,?,?,?) ON CONFLICT(snapshot_id,player_id) DO NOTHING').bind(id,p.id,String(p.rating),String(p.value),JSON.parse(snapshot.manifest).builtAt)));
      await db().batch([db().prepare("UPDATE snapshots SET state='ready' WHERE id=?").bind(id),db().prepare("INSERT INTO active_snapshot (key,snapshot_id,previous_id,updated_at) VALUES ('official',?,NULL,?) ON CONFLICT(key) DO UPDATE SET previous_id=CASE WHEN snapshot_id<>excluded.snapshot_id THEN snapshot_id ELSE previous_id END,snapshot_id=excluded.snapshot_id,updated_at=excluded.updated_at").bind(id,new Date().toISOString())]);await audit('snapshot_published',{id});return json({published:id});
    }
    if(input.action==='rollback'){
      if(snapshot.state!=='ready')throw new Error('Can only roll back to a published snapshot.');await db().prepare("UPDATE active_snapshot SET previous_id=snapshot_id,snapshot_id=?,updated_at=? WHERE key='official'").bind(id,new Date().toISOString()).run();await audit('snapshot_rollback',{id});return json({published:id});
    }
    throw new Error('Unknown ingestion action.');
  }catch(e){return failure(e);}
}
