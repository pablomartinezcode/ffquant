import { env } from 'cloudflare:workers';
import { z } from 'zod';
import { db,body,json,failure,ingestionAuth,audit } from '@/lib/server';
import { rankPlayers,defaultConfig,type Player } from '@/lib/football';
const idSchema=z.string().regex(/^nfl-[a-f0-9]{20}$/);
const stats=z.record(z.number().finite().nullable());
const playerSchema=z.object({id:z.string().regex(/^[\w-]+$/),sleeperId:z.string(),name:z.string(),position:z.enum(['QB','RB','WR','TE']),team:z.string(),age:z.number().nullable(),status:z.string(),statusAsOf:z.string(),forecast:stats,previousForecast:stats.nullable(),currentForm:z.number().nullable(),remainingGames:z.number().min(0).max(17),gamesThisSeason:z.number().min(0).max(18),matchupFactor:z.number().min(.9).max(1.1),confidence:z.string(),mapping:z.string()}).passthrough();
async function checksum(content:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(content)))).map(b=>b.toString(16).padStart(2,'0')).join('');}
export async function GET(request:Request){if(!await ingestionAuth(request))return json({error:'Unauthorized'},401);return json({ready:!!env.DB&&!!env.BUCKET,protocol:1});}
export async function POST(request:Request){
  if(!await ingestionAuth(request))return json({error:'Unauthorized'},401);
  try{const input=await body(request),id=idSchema.parse(input.id);
    if(input.action==='begin'){
      const m=z.object({id:idSchema,playerCount:z.number().int().min(1).max(10000),sourceUpdatedAt:z.string(),modelVersion:z.literal('baseline-0.1.0'),builtAt:z.string(),artifacts:z.record(z.string().regex(/^[a-f0-9]{64}$/)),playerChecksums:z.record(z.string().regex(/^[a-f0-9]{64}$/))}).passthrough().parse(input.manifest);
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
      const count=await db().prepare('SELECT COUNT(*) AS n FROM players WHERE snapshot_id=?').bind(id).first<{n:number}>();if(count?.n!==snapshot.expected)throw new Error(`Incomplete snapshot: ${count?.n??0}/${snapshot.expected} players.`);
      const artifactCount=await db().prepare('SELECT COUNT(*) AS n FROM artifacts WHERE snapshot_id=?').bind(id).first<{n:number}>(),expectedArtifacts=Object.keys(JSON.parse(snapshot.manifest).artifacts??{}).length;if(artifactCount?.n!==expectedArtifacts)throw new Error(`Incomplete snapshot: ${artifactCount?.n??0}/${expectedArtifacts} artifacts.`);
      const rows=await db().prepare('SELECT payload FROM players WHERE snapshot_id=?').bind(id).all<{payload:string}>(),ranked=rankPlayers(rows.results.map(r=>JSON.parse(r.payload) as Player),defaultConfig);
      for(let offset=0;offset<ranked.length;offset+=100)await db().batch(ranked.slice(offset,offset+100).map(p=>db().prepare('INSERT INTO rating_history (snapshot_id,player_id,rating,value,recorded_at) VALUES (?,?,?,?,?) ON CONFLICT(snapshot_id,player_id) DO NOTHING').bind(id,p.id,String(p.rating),String(p.value),JSON.parse(snapshot.manifest).builtAt)));
      await db().batch([db().prepare("UPDATE snapshots SET state='ready' WHERE id=?").bind(id),db().prepare("INSERT INTO active_snapshot (key,snapshot_id,previous_id,updated_at) VALUES ('official',?,NULL,?) ON CONFLICT(key) DO UPDATE SET previous_id=CASE WHEN snapshot_id<>excluded.snapshot_id THEN snapshot_id ELSE previous_id END,snapshot_id=excluded.snapshot_id,updated_at=excluded.updated_at").bind(id,new Date().toISOString())]);await audit('snapshot_published',{id});return json({published:id});
    }
    if(input.action==='rollback'){
      if(snapshot.state!=='ready')throw new Error('Can only roll back to a published snapshot.');await db().prepare("UPDATE active_snapshot SET previous_id=snapshot_id,snapshot_id=?,updated_at=? WHERE key='official'").bind(id,new Date().toISOString()).run();await audit('snapshot_rollback',{id});return json({published:id});
    }
    throw new Error('Unknown ingestion action.');
  }catch(e){return failure(e);}
}
