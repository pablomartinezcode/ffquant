'use client';
import type {Availability} from '@/lib/football';
import {Help,definitions} from './stat-help';

export function AvailabilityCard({availability:a}:{availability?:Availability}){
  if(!a)return <p className="chart-caption">Missed-game coverage is unavailable for this snapshot.</p>;
  return <section className="availability-card" aria-label="Player availability">
    <div className="availability-summary"><div><small><Help text={definitions.missed}>Missed games</Help></small><strong>{a.missedGames??'—'}</strong><span>{a.season} · through W{a.throughWeek}</span></div><div><small>Current status</small><b>{a.label}</b><Help className="availability-weight" text={a.basis}>{Math.round(a.rosWeight*100)}% rest-of-season availability</Help></div></div>
    <p>{a.missedGames==null?'Weekly roster coverage unavailable.':a.missedWeeks.length?`Confirmed absences: ${a.missedWeeks.map(w=>`W${w}`).join(', ')}.`:'No confirmed inactive/reserve absences.'} {a.unknownParticipationGames>0&&`${a.unknownParticipationGames} active-roster game${a.unknownParticipationGames===1?' has':'s have'} unverified participation.`} {a.practiceSquadGames>0&&`${a.practiceSquadGames} practice-squad games tracked separately.`}</p>
    {a.games.length>0&&<details><summary>View game-by-game availability</summary><div className="availability-weeks">{a.games.map(g=><div key={g.week}><span>W{g.week} · {g.team}</span><strong>{({recorded:'Statistical appearance',missed:'Missed · '+g.status,practice:'Practice squad',unknown:'Participation unverified'})[g.result]}</strong></div>)}</div></details>}
    <small className="availability-source">Weekly roster source observed {new Date(a.asOf).toLocaleDateString()}. Confirmed absences only; byes are excluded.</small>
  </section>;
}
