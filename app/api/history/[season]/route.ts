import { seedDataset } from '@/lib/dataset';
import { env } from 'cloudflare:workers';
import { dataset,db,json,failure } from '@/lib/server';
import type {Manifest} from '@/lib/football';
export async function GET(request:Request,{params}:{params:Promise<{season:string}>}){
  try{
    const {season}=await params,wanted=new URL(request.url).searchParams.get('snapshot');
    let manifest:Manifest;
    if(wanted){
      if(!/^nfl-[a-f0-9]{20}$/.test(wanted))return json({error:'Invalid snapshot.'},400);
      if(wanted===seedDataset.manifest.id)manifest=seedDataset.manifest;
      else{
        const snapshot=await db().prepare("SELECT manifest FROM snapshots WHERE id=? AND state='ready'").bind(wanted).first<{manifest:string}>();
        if(!snapshot)return json({error:'Published snapshot is unavailable. Refresh the rankings and try again.'},404);
        manifest=JSON.parse(snapshot.manifest);
      }
    }else manifest=(await dataset()).manifest;
    if(!/^\d{4}$/.test(season)||Number(season)<1999||Number(season)>manifest.season)throw new Error('Season is outside available coverage.');
    const stored=await env.BUCKET?.get(`${manifest.id}/history/${season}.json`);
    if(stored)return new Response(stored.body,{headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-FFQuant-Snapshot':manifest.id}});
    if(manifest.id!==seedDataset.manifest.id)return json({error:'History artifact is missing from the published snapshot.'},503);
    return Response.redirect(new URL(`/data/history/${season}.json`,request.url),307);
  }catch(e){return failure(e,503);}
}
