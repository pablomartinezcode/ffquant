import type { RankedPlayer, Position } from './football';
const positions = ['QB','RB','WR','TE'] as const;

export function teamValues(rosters:{roster_id:number;players:string[]|null;reserve?:string[]|null;taxi?:string[]|null}[],ranked:RankedPlayer[]){
  const map=new Map(ranked.map(p=>[p.sleeperId,p]));
  return rosters.map(r=>{
    // Sleeper often includes IR/taxi in players; a union prevents double counting.
    const ids=[...new Set([...(r.players??[]),...(r.reserve??[]),...(r.taxi??[])])];
    const totals=Object.fromEntries(positions.map(pos=>[pos,0])) as Record<Position,number>;
    let valued=0,excluded=0;
    for(const id of ids){const p=map.get(id);if(p){totals[p.position]+=p.value;valued++;}else excluded++;}
    return {rosterId:r.roster_id,total:positions.reduce((s,pos)=>s+totals[pos],0),positions:totals,valued,excluded};
  });
}
