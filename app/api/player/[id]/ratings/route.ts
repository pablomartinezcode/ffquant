import { db,json,failure } from '@/lib/server';
import {weeklyHistorySql,withRankChanges,type WeeklyRanking} from '@/lib/ranking-history';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const {id}=await params;if(!/^[\w-]{1,80}$/.test(id))return json({error:'Invalid player ID.'},400);
    const format=new URL(request.url).searchParams.get('format')??'1qb';
    if(!['1qb','sf'].includes(format))return json({error:'Format must be 1qb or sf.'},400);
    const rows=await db().prepare(weeklyHistorySql).bind(format,id,format).all<Omit<WeeklyRanking,'rank_change'|'model_changed'>>();
    return json({format,config:`12-team, ${format==='sf'?'Superflex':'1QB'}, PPR, no TE premium`,history:withRankChanges(rows.results)});
  }catch(e){return failure(e,503);}
}
