import { dataset,json,failure,body } from '@/lib/server';
import { configSchema,rankPlayers } from '@/lib/football';
export async function POST(request:Request){try{const config=configSchema.parse(await body(request,10000)),d=await dataset();return json({manifest:d.manifest,config,players:rankPlayers(d.players,config)});}catch(e){return failure(e);}}
