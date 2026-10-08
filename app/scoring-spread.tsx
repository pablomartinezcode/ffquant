import type { ScoringSpread } from '@/lib/football';
import { fmt } from './ui-support';
import {Help,definitions} from './stat-help';

export function Spread({spread,domain}:{spread:ScoringSpread|null;domain?:[number,number]}){
  if(!spread)return <span className="muted">— <small>No sample</small></span>;
  domain??=[Math.min(-5,spread.low??spread.median),Math.max(40,spread.high??spread.median)];
  const s=spread,x=(v:number)=>Number((8+124*Math.max(0,Math.min(1,(v-domain[0])/(domain[1]-domain[0])))).toFixed(4));
  const label=`Median ${fmt(s.median)} points; sample standard deviation ${s.sd===null?'unavailable':fmt(s.sd)}; ${s.count} statistical appearances, ${s.first} to ${s.last}. Middle 50%: ${fmt(s.q25)} to ${fmt(s.q75)}. Median ± SD is descriptive, not a forecast interval.`;
  return <Help className="spread-help" text={`${definitions.spread} ${label}`}><span className="scoring-spread" aria-label={label}>
    <svg viewBox="0 0 140 24" role="img" aria-label={label}>
      <line x1={8} y1={12} x2={132} y2={12} className="spread-guide"/>
      {s.sd!==null&&<><line x1={x(s.low!)} x2={x(s.high!)} y1={12} y2={12} className="spread-line"/>
      <line x1={x(s.low!)} x2={x(s.low!)} y1={7} y2={17} className="spread-line"/>
      <line x1={x(s.high!)} x2={x(s.high!)} y1={7} y2={17} className="spread-line"/></>}
      <line x1={x(s.median)} x2={x(s.median)} y1={3} y2={21} className="spread-median"/>
    </svg>
    <small><b>{fmt(s.median)}</b> ± {s.sd===null?'—':fmt(s.sd)} <span>· n={s.count}{s.count<8?' · small sample':''}</span></small>
  </span></Help>;
}
