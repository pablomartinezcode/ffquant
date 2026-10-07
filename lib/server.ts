import { env } from 'cloudflare:workers';
import { seedDataset } from './dataset';
import type { Dataset, Manifest, Player } from './football';
export function db(){if(!env.DB)throw new Error('Database binding is unavailable.');return env.DB;}
export async function dataset():Promise<Dataset>{
  const active=await db().prepare("SELECT snapshot_id FROM active_snapshot WHERE key='official'").first<{snapshot_id:string}>();
  if(!active)return seedDataset;
  const [snapshot,rows]=await Promise.all([db().prepare("SELECT manifest FROM snapshots WHERE id=? AND state='ready'").bind(active.snapshot_id).first<{manifest:string}>(),db().prepare('SELECT payload FROM players WHERE snapshot_id=?').bind(active.snapshot_id).all<{payload:string}>()]);
  if(!snapshot)throw new Error('Published snapshot is unavailable.');
  return {manifest:JSON.parse(snapshot.manifest) as Manifest,players:rows.results.map(r=>JSON.parse(r.payload) as Player)};
}
export function json(value:unknown,status=200){return Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
export function failure(e:unknown,status=400){console.error('ffquant',e instanceof Error?e.message:'Request failed');return json({error:e instanceof Error?e.message:'Request failed'},status);}
export async function body(request:Request,max=2_000_000){
  if(Number(request.headers.get('content-length')??0)>max)throw new Error('Request too large.');
  const reader=request.body?.getReader();if(!reader)throw new Error('Missing request body.');
  const parts:Uint8Array[]=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();throw new Error('Request too large.');}parts.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.byteLength;}return JSON.parse(new TextDecoder().decode(bytes));
}
export async function audit(kind:string,detail:unknown){await db().prepare('INSERT INTO events (id,kind,detail,created_at) VALUES (?,?,?,?)').bind(crypto.randomUUID(),kind,JSON.stringify(detail),new Date().toISOString()).run();}
export async function ingestionAuth(request:Request){const secret=env.FFQUANT_INGEST_TOKEN;if(!secret||secret.length<32)return false;const sent=request.headers.get('authorization')??'';const hash=async(s:string)=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));const [a,b]=await Promise.all([hash(sent),hash(`Bearer ${secret}`)]);return a.reduce((d,v,i)=>d|(v^b[i]),0)===0;}
