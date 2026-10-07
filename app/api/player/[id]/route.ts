import { seedDataset } from '@/lib/dataset';
import { env } from 'cloudflare:workers';
import { dataset,json,failure } from '@/lib/server';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){try{const {id}=await params;if(!/^[\w-]{1,80}$/.test(id))throw new Error('Invalid player ID.');const d=await dataset();const stored=await env.BUCKET?.get(`${d.manifest.id}/players/${id}.json`);if(stored)return new Response(stored.body,{headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});if(d.manifest.id!==seedDataset.manifest.id)return json({error:'Player artifact is missing from the active snapshot.'},503);return Response.redirect(new URL(`/data/players/${id}.json`,request.url),307);}catch(e){return failure(e,503);}}
