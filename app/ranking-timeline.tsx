'use client';
import {useEffect,useState} from 'react';
import {Table,TableBody,TableCell,TableHead,TableHeader,TableRow} from '@/components/ui/table';
import type {WeeklyRanking,HistoryFormat} from '@/lib/ranking-history';
import {Choice,api,fmt} from './ui-support';
import {Help} from './stat-help';

export function RankingTimeline({id,superflex}:{id:string;superflex:boolean}){
  const [format,setFormat]=useState<HistoryFormat>(superflex?'sf':'1qb');
  const [rows,setRows]=useState<WeeklyRanking[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true);
  useEffect(()=>{const c=new AbortController();setLoading(true);setError('');setRows([]);
    api<{history:WeeklyRanking[]}>(`/api/player/${encodeURIComponent(id)}/ratings?format=${format}`,undefined,c.signal)
      .then(d=>setRows(d.history)).catch(e=>{if(!c.signal.aborted)setError(e.message);}).finally(()=>{if(!c.signal.aborted)setLoading(false);});
    return()=>c.abort();
  },[id,format]);
  const chronological=[...rows].reverse(),best=Math.min(...rows.map(r=>r.rank)),worst=Math.max(...rows.map(r=>r.rank));
  const x=(i:number)=>30+i*440/Math.max(1,rows.length-1),y=(rank:number)=>25+(rank-best)*90/Math.max(5,worst-best);
  return <section aria-label="Weekly ranking history"><div className="section-heading"><h3>Weekly ranking history</h3><Choice label="Archive format" value={format} onChange={v=>setFormat(v as HistoryFormat)} options={[["1qb","1 QB"],["sf","Superflex"]]}/></div>
    <p className="chart-caption">12-team PPR · no TE premium · standard lineup. Independent of your custom league settings. Latest publication through each statistical week; earlier revisions remain archived.</p>
    {loading?<p role="status">Loading ranking history…</p>:error?<p className="error" role="alert">Ranking history unavailable: {error}</p>:rows.length===0?<p className="muted">Weekly tracking starts with the first publication of this model. Earlier ranks have not been reconstructed.</p>:<>
      {rows.length>1&&<svg className="rank-timeline" viewBox="0 0 500 150" role="img" aria-label={`Overall dynasty rank by week: ${chronological.map(r=>`${r.season} week ${r.week}, rank ${r.rank}`).join('; ')}. A higher line means a better rank.`}>
        <path d={chronological.map((r,i)=>`${i?'L':'M'}${x(i)},${y(r.rank)}`).join(' ')} fill="none" stroke="#618841" strokeWidth="2"/>
        {chronological.map((r,i)=><g key={r.snapshot_id}><circle cx={x(i)} cy={y(r.rank)} r={3} fill={r.model_changed?'#a16b3e':'#618841'}/><title>{r.season} W{r.week}: #{r.rank} · {r.model_version}</title></g>)}
        <text x="10" y="14">Best #{best}</text><text x="10" y="145">{chronological[0].season} W{chronological[0].week}</text><text x="490" y="145" textAnchor="end">{rows[0].season} W{rows[0].week}</text>
      </svg>}
      <div className="compact-table"><Table><TableHeader><TableRow><TableHead>Through week</TableHead><TableHead>Overall / pos.</TableHead><TableHead><Help text="Improvement in overall rank versus the previous consecutive recorded statistical week. Positive means a rise. Gaps have no delta. Model changes are flagged and may account for some movement.">Rank Δ</Help></TableHead><TableHead>FFQ Rating</TableHead><TableHead>Value / PPG</TableHead></TableRow></TableHeader><TableBody>{rows.map(r=><TableRow key={r.snapshot_id}>
        <TableCell><Help text={`Published ${new Date(r.recorded_at).toLocaleString()}. Source timestamp ${r.source_updated_at}. Model ${r.model_version}. Snapshot ${r.snapshot_id}.`}>{r.season} {r.week===0?'preseason':`W${r.week}`}</Help><small className="history-model">{r.model_version}{r.model_changed?' · model changed':''}</small></TableCell>
        <TableCell>#{r.rank} / {r.position_rank}</TableCell><TableCell className={(r.rank_change??0)>=0?'positive':'negative'}>{r.rank_change===null?'—':`${r.rank_change>0?'+':''}${r.rank_change}`}</TableCell><TableCell>{fmt(r.rating)}</TableCell><TableCell>{fmt(r.value,0)} / {fmt(r.ppg)}</TableCell>
      </TableRow>)}</TableBody></Table></div>
    </>}
  </section>;
}
