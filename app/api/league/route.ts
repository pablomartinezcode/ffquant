import { z } from 'zod';
import { body,failure,json } from '@/lib/server';
import { importLeague,sleeper } from '@/lib/sleeper';
export async function POST(request:Request){try{const input=z.object({query:z.string().trim().min(1).max(60),season:z.number().int().min(2017).max(2100)}).strict().parse(await body(request,1000));if(/^\d{8,24}$/.test(input.query))return json(await importLeague(input.query));if(!/^[\w-]{1,40}$/.test(input.query))throw new Error('Enter a Sleeper username or numeric league ID.');const user=await sleeper(`/user/${input.query}`);const leagues=await sleeper(`/user/${user.data.user_id}/leagues/nfl/${input.season}`);return json({user:user.data,leagues:leagues.data,fetchedAt:leagues.fetchedAt});}catch(e){return failure(e);}}
