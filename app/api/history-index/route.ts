import { env } from 'cloudflare:workers';
import { seedDataset } from '@/lib/dataset';
import { dataset,json,failure } from '@/lib/server';
export async function GET(request:Request){try{
  const d=await dataset(),stored=await env.BUCKET?.get(`${d.manifest.id}/history-index.json`);
  if(stored)return new Response(stored.body,{headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
  if(d.manifest.id!==seedDataset.manifest.id)return json({error:'Historical index is missing from the active snapshot.'},503);
  return Response.redirect(new URL('/data/history-index.json',request.url),307);
}catch(e){return failure(e,503);}}
