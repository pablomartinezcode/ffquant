'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {ArrowDown,ArrowUp,ArrowDownUp,ArrowLeft,ArrowRight,ArrowUpRight,Plus,Search,X,CircleHelp} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Checkbox} from '@/components/ui/checkbox';
import {Popover,PopoverContent,PopoverTrigger} from '@/components/ui/popover';
import {Table,TableHeader,TableBody,TableRow,TableHead,TableCell} from '@/components/ui/table';
import {positions,qualifiedScoringSample,type Config,type Manifest,type RankedPlayer,type SeasonStats} from '@/lib/football';
import {columnById,rankingColumns,defaultColumns,defaultRankingSort,readColumnPreferences,toggleRankingSort,metricValue,sortRankingTable,type RankingColumn} from '@/lib/ranking-columns';
import {Help,definitions,roleDefinitions} from './stat-help';
import {Spread} from './scoring-spread';
import {api,fmt,Pos} from './ui-support';

const preferenceKey='ffquant:ranking-columns:v1';
const coreHelp:Record<string,string>={rank:definitions.rank,name:definitions.player,age:definitions.age,value:definitions.rating,change:definitions.change,form:definitions.form,ppg:definitions.ppg,median:definitions.spread};
export function RankingsTable({players,manifest,config,query,position,limit,onQuery,onPosition,onLimit,onPlayer}:{players:RankedPlayer[];manifest:Manifest;config:Config;query:string;position:string;limit:number;onQuery:(v:string)=>void;onPosition:(v:string)=>void;onLimit:(v:number)=>void;onPlayer:(p:RankedPlayer)=>void}){
  const [preferences,setPreferences]=useState(()=>readColumnPreferences(null)),[ready,setReady]=useState(false);
  const [sort,setSort]=useState(defaultRankingSort),[qualifiedFirst,setQualifiedFirst]=useState(true),[picker,setPicker]=useState(false);
  const [seasonData,setSeasonData]=useState<{snapshot:string;rows:SeasonStats[]}|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(true),[retry,setRetry]=useState(0);
  const scroller=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(scroller.current)scroller.current.scrollTop=0;},[query,position,sort,preferences.basis,config]);
  useEffect(()=>{try{setPreferences(readColumnPreferences(JSON.parse(localStorage.getItem(preferenceKey)??'null')));}catch{}setReady(true);},[]);
  useEffect(()=>{if(ready)try{localStorage.setItem(preferenceKey,JSON.stringify(preferences));}catch{}},[preferences,ready]);
  useEffect(()=>{
    const controller=new AbortController();setBusy(true);setError('');
    api<SeasonStats[]>(`/api/history/${manifest.season}?snapshot=${encodeURIComponent(manifest.id)}`,undefined,controller.signal)
      .then(rows=>{if(!controller.signal.aborted)setSeasonData({snapshot:manifest.id,rows});})
      .catch(e=>{if(!controller.signal.aborted)setError(e.message);})
      .finally(()=>{if(!controller.signal.aborted)setBusy(false);});
    return()=>controller.abort();
  },[manifest.id,manifest.season,retry]);
  const stats=useMemo(()=>new Map((seasonData?.snapshot===manifest.id?seasonData.rows:[]).map(s=>[s.id,s])),[seasonData,manifest.id]);
  const columns=useMemo(()=>rankingColumns.filter(c=>preferences.columns.includes(c.id)),[preferences.columns]);
  const filtered=useMemo(()=>sortRankingTable(players.filter(p=>(position==='ALL'||p.position===position)&&`${p.name} ${p.team}`.toLowerCase().includes(query.toLowerCase())),sort,stats,preferences.basis,config,qualifiedFirst),[players,position,query,sort,stats,preferences.basis,config,qualifiedFirst]);
  const domain=useMemo<[number,number]>(()=>[Math.min(-5,...players.map(p=>p.spread?.low??0)),Math.max(40,...players.map(p=>p.spread?.high??0))],[players]);
  const columnWidth=(c:RankingColumn)=>c.id==='name'?'var(--player-column-width)':c.id==='rank'?'48px':`min(${c.width}px, var(--metric-max-width, 999px))`;
  const sortColumn=columnById.get(sort.key)!;
  const sampleSort=['form','median','sd'].includes(sort.key);
  const hasObserved=columns.some(c=>c.observed);
  const changeColumn=(id:string,checked:boolean)=>{
    setPreferences(p=>({...p,columns:checked?[...p.columns,id]:p.columns.filter(c=>c!==id)}));
    if(!checked&&sort.key===id)setSort({key:'rank',direction:'asc'});
  };
  const scrollMetrics=(direction:1|-1)=>{
    const el=scroller.current;if(!el)return;
    const pinned=el.querySelector<HTMLElement>('th.sticky-player')?.offsetWidth??0;
    const stops=[0,...Array.from(el.querySelectorAll<HTMLElement>('thead th:not(.sticky-player):not(.column-action)')).map(th=>Math.max(0,th.offsetLeft-pinned)),el.scrollWidth-el.clientWidth];
    const target=direction===1?Math.min(...stops.filter(x=>x>el.scrollLeft+2)):Math.max(...stops.filter(x=>x<el.scrollLeft-2));
    if(Number.isFinite(target))el.scrollTo({left:target,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  };
  const sortBy=(id:string)=>{setSort(s=>toggleRankingSort(s,id));onLimit(50);};
  const renderMetric=(p:RankedPlayer,c:RankingColumn)=>{
    if(c.id==='rank')return String(p.rank).padStart(2,'0');
    if(c.id==='name')return <div className="player-entry"><button className="player-name" onClick={()=>onPlayer(p)}><span className={`avatar avatar-${p.position}`}>{p.name.split(' ').map(n=>n[0]).slice(0,2).join('')}</span><span><strong>{p.name}</strong><small><Pos p={p.position}/>{p.team}<span className="subtle-separator">·</span>{p.position}{p.positionRank}</small></span></button><div className="player-labels">{p.qbRole&&p.qbRole.label!=='Starter'&&<Help className="prior-label" text={`${roleDefinitions[p.qbRole.label]??p.qbRole.label} ${p.qbRole.basis}`}>{p.qbRole.label}</Help>}{p.confidence==='low'&&<Help className="prior-label" text={definitions.prior}>Prior-led</Help>}</div></div>;
    if(c.id==='value')return <div className="rating-cell"><Help text={definitions.rating}><strong>{fmt(p.rating)}</strong></Help><span className="rating-track"><i style={{width:`${p.rating.toFixed(4)}%`}}/></span></div>;
    if(c.id==='median')return <><Spread spread={p.spread} domain={domain}/>{!qualifiedScoringSample(p)&&<Help className="sample-note" text={definitions.sample}>Limited sample / role</Help>}</>;
    const value=metricValue(p,c,stats,preferences.basis,config);
    const signed=c.id==='change'||c.id==='form';
    const digits=c.id==='age'||c.id==='ppg'||signed?1:c.observed&&c.id!=='games'&&preferences.basis==='perGame'?1:c.digits??0;
    const display=typeof value==='number'&&Number.isFinite(value)?`${signed&&value>=0?'+':''}${fmt(value,digits)}${c.id==='form'?' pts':''}`:'—';
    return <Help text={coreHelp[c.id]??c.help??c.label}><span className={signed&&value!=null?(Number(value)>=0?'positive':'negative'):value==null?'muted':''}>{display}</span></Help>;
  };
  return <>
    <section className="rankings-panel" aria-label="Dynasty player rankings">
      <div className="table-toolbar"><div className="position-tabs" aria-label="Filter position">{['ALL',...positions].map(p=><Button key={p} variant="ghost" aria-pressed={position===p} className={position===p?'selected':''} onClick={()=>{onPosition(p);onLimit(50);}}>{p==='ALL'?'All players':p}</Button>)}</div><div className="search-field"><Search size={16}/><Input aria-label="Search players" placeholder="Search player or team" value={query} onChange={e=>{onQuery(e.target.value);onLimit(50);}}/></div></div>
      <div className="ranking-controls"><div className="season-scope"><span className="live-dot"/>{manifest.season} REGULAR SEASON <span>Through W{manifest.statsThroughWeek??manifest.coverage.find(c=>c.season===manifest.season)?.lastWeek??0}</span></div><div className="stat-basis" role="group" aria-label="Season statistics basis"><button aria-pressed={preferences.basis==='total'} onClick={()=>setPreferences(p=>({...p,basis:'total'}))}>Totals</button><button aria-pressed={preferences.basis==='perGame'} onClick={()=>setPreferences(p=>({...p,basis:'perGame'}))}>Per game</button></div></div>
      <div className="ranking-sort-status"><span aria-live="polite">Sorted by <strong>{sortColumn.label==='Scoring Spread'?'Median score':sortColumn.label}</strong> · {sort.direction==='asc'?'ascending':'descending'}</span>{sampleSort&&<label className="qualification-toggle"><Checkbox checked={qualifiedFirst} onCheckedChange={v=>setQualifiedFirst(v===true)}/>Qualified samples first</label>}<div className="scroll-controls"><span>Scroll for more</span><Button variant="ghost" size="icon" aria-label="Scroll metrics left" onClick={()=>scrollMetrics(-1)}><ArrowLeft size={15}/></Button><Button variant="ghost" size="icon" aria-label="Scroll metrics right" onClick={()=>scrollMetrics(1)}><ArrowRight size={15}/></Button></div></div>
      {hasObserved&&busy&&<p className="table-data-status" role="status">Loading season statistics…</p>}{error&&<div className="table-data-status" role="alert">Season statistics unavailable. {error} <Button variant="outline" size="sm" onClick={()=>setRetry(n=>n+1)}>Retry</Button></div>}
      <Table className="ranking-table" style={{width:`calc(40px + ${columns.map(columnWidth).join(' + ')})`}} containerRef={scroller} containerProps={{className:'ranking-scroll',tabIndex:0,role:'region','aria-label':'Player metrics, scroll horizontally to see all columns'}}>
        <colgroup>{columns.map(c=><col key={c.id} style={{width:columnWidth(c)}}/>)}<col style={{width:40}}/></colgroup>
        <TableHeader><TableRow>{columns.map(c=><TableHead key={c.id} scope="col" className={`${c.id==='name'?'sticky-player':''} ${c.id==='rank'?'rank-cell':''} ${sort.key===c.id?'sorted-column':''}`} aria-sort={sort.key===c.id?(sort.direction==='asc'?'ascending':'descending'):undefined}><Help text={`${coreHelp[c.id]??c.help} ${c.id==='median'?'Click to sort by median score. ':''}Click again to reverse order.`} asChild><button className="column-sort" onClick={()=>sortBy(c.id)}>{c.shortLabel??c.label}{c.observed&&c.id!=='games'&&preferences.basis==='perGame'&&<span className="per-game-label">/ G</span>}{sort.key===c.id?(sort.direction==='asc'?<ArrowUp size={12}/>:<ArrowDown size={12}/>):<ArrowDownUp size={12}/>}</button></Help></TableHead>)}<TableHead className="column-action" scope="col"><Popover open={picker} onOpenChange={setPicker}><PopoverTrigger asChild><Button variant="ghost" size="icon" className="add-column" aria-label="Customize columns"><Plus size={19}/></Button></PopoverTrigger><PopoverContent className="column-picker" align="end" sideOffset={8} aria-label="Customize ranking columns"><div className="column-picker-heading"><div><h2>Make it your board.</h2><p>Add the numbers you care about.</p></div><Button variant="ghost" size="icon" aria-label="Close column picker" onClick={()=>setPicker(false)}><X size={16}/></Button></div><div className="column-options">{(['Core','Opportunity','Yards','Touchdowns','Other'] as const).map(group=><fieldset key={group}><legend>{group}</legend>{rankingColumns.filter(c=>c.group===group).map(c=><label key={c.id}><Checkbox checked={preferences.columns.includes(c.id)} disabled={c.id==='rank'||c.id==='name'} onCheckedChange={v=>changeColumn(c.id,v===true)}/><span>{c.label}</span>{(c.id==='rank'||c.id==='name')&&<small>Always shown</small>}</label>)}</fieldset>)}</div><div className="column-picker-footer"><Button variant="ghost" onClick={()=>{setPreferences({columns:defaultColumns,basis:'total'});setSort(defaultRankingSort);}}>Reset defaults</Button><Button onClick={()=>setPicker(false)}>Done</Button></div><small className="saved-columns-note">Column choices are saved on this device.</small></PopoverContent></Popover></TableHead></TableRow></TableHeader>
        <TableBody>{filtered.slice(0,limit).map(p=><TableRow key={p.id}>{columns.map(c=><TableCell key={c.id} className={`${c.id==='name'?'sticky-player':''} ${c.id==='rank'?'rank-cell':''} ${sort.key===c.id?'sorted-column':''}`}>{renderMetric(p,c)}</TableCell>)}<TableCell className="column-action"><Button variant="ghost" size="icon" aria-label={`View ${p.name}`} onClick={()=>onPlayer(p)}><ArrowUpRight size={16}/></Button></TableCell></TableRow>)}</TableBody>
      </Table>
      {!filtered.length&&<div className="empty-state">No current NFL players match this search. Retired and unrostered players are in Historical archive.</div>}
      <div className="table-footer"><span>Showing {Math.min(limit,filtered.length)} of {filtered.length} players</span>{limit<filtered.length&&<Button variant="outline" onClick={()=>onLimit(limit+50)}>Show 50 more</Button>}<span>— = unavailable · Click a heading to sort</span></div>
    </section>
    <div className="research-note"><CircleHelp size={17}/><p><strong>Built to be questioned.</strong> FFQ Ratings estimate dynasty value; added statistics describe this season’s production. Totals / per game applies to season statistics only. Scoring spread shows median ± 1 sample SD. Qualified samples have 4+ appearances and an established QB role. Hover or focus a heading for its definition, or tap a statistic. Open any player for weekly ranking history.</p></div>
  </>;
}
