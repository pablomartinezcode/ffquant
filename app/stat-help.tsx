'use client';
import {useState,type ReactNode,type ReactElement} from 'react';
import {Tooltip,TooltipContent,TooltipProvider,TooltipTrigger} from '@/components/ui/tooltip';

export const definitions={
  rank:'Overall dynasty rank under the selected league settings. Position rank appears beside the team. Sorting another column does not change these ranks.',
  player:'Current NFL roster and reserve players. Open a player to inspect production, forecasts and weekly ranking history.',
  age:'Age on September 1 of this NFL season. Future production uses separate aging curves for QB, RB, WR and TE.',
  rating:'FFQ Rating is a 1–100 display of estimated dynasty value above replacement over the remaining season and next two seasons. It accounts for position, age, role, draft evidence and league settings. Higher is better. The scale is nonlinear: never add ratings in a trade.',
  change:'Change in FFQ Rating caused by including the latest statistical appearance, compared with excluding it under today’s model and league settings. This is not a change in rank or a comparison with last week’s published rating.',
  form:'Average PPR points over the last three current-season statistical appearances, minus the prior baseline (up to 17 appearances from the previous two seasons). This descriptive stat can jump after a big game; it is not directly added to dynasty value and always uses PPR.',
  ppg:'Projected fantasy points per statistical appearance under your selected scoring. Opportunity adjusts faster than efficiency and touchdown rates. Includes the dynasty role weight and describes production conditional on an appearance. Availability weights affect rest-of-season totals and dynasty value separately; this is not a live injury or next-game forecast.',
  spread:'The middle bar is the median score; outer bars are one sample standard deviation below and above it. Uses current-season statistical appearances and selected scoring. Wider means more variable results. This describes observed scores, not a prediction interval or a guarantee that 68% of scores fall inside.',
  missed:'Confirmed inactive/reserve/suspended games on the weekly roster, matched to completed regular-season games through the statistical cutoff. Excludes byes, future games, practice-squad weeks and unverified absences. Active roster membership with no statistics is unknown participation, not a missed game. A recorded statistical appearance overrides a conflicting status. This is a confirmed count, not a complete injury log.',
  prior:'Fewer than eight statistical appearances in the current and previous two seasons. Limited history means the projection depends more on position and available draft-cohort priors. Confidence is lower; this is not an injury label.',
  sample:'Fewer than four current-season statistical appearances, or a QB with a dynasty role weight below 75%. With “Qualified samples first” enabled, these players follow qualified players when sorting by form, median or spread. Their dynasty rank is unaffected by this sorting rule.',
  lowSpread:'Sort qualified players by the lowest sample standard deviation first. At least four current-season statistical appearances are required; backup QB samples follow. A small spread measures consistency, not how many points a player scores.',
  ros:'Projected points per appearance × remaining scheduled team games × the published availability weight. The weight reduces expected usable production for reserve, out, suspended, doubtful and practice-squad players. It is a model assumption, not a confirmed return date.',
  next:'Projected points adjusted for the upcoming opponent (at most ±10%) and the published current role and availability status for every position. Out/reserve/inactive players receive zero while that snapshot applies. Daily snapshots cannot guarantee game-day availability.',
  value:'Unrounded dynasty value above a replacement player, summed over the remaining season and two future seasons with a 15% annual discount. Trades use these value units, with roster adjustments, instead of adding FFQ Ratings.',
};
export const roleDefinitions:Record<string,string>={
  'Injured incumbent':'An established starting QB whose published status indicates injury. Long-term value retains his established role; the next-game projection uses a separate current role/status weight. Questionable alone does not imply a missed game. Recovery timing is unknown.',
  'Starter continuity':'The established starting QB retains the long-term role through a short absence or brief replacement run. Sustained healthy replacement starts can change this estimate.',
  'Temporary starter':'Currently listed as the starting QB, but another QB has the stronger established starting role. Immediate opportunity and long-term dynasty opportunity receive different weights.',
  'Backup':'A QB without an established starting role. His projection receives a reduced role weight; a strong relief appearance alone does not establish a long-term starting job.',
  'Starter':'The model’s current estimate of the established starting QB, based on roster and passing-usage evidence.',
};

// Existing buttons stay buttons. Text badges become sibling buttons, never
// nested inside the profile opener. Click opens help on touch as well as focus.
export function Help({text,children,asChild=false,className=''}:{text:string;children:ReactNode;asChild?:boolean;className?:string}){
  const [open,setOpen]=useState(false);
  return <TooltipProvider delayDuration={180}><Tooltip open={open} onOpenChange={setOpen}>
    <TooltipTrigger asChild>{asChild?children as ReactElement:<button type="button" className={`stat-help ${className}`} onClick={()=>setOpen(v=>!v)}>{children}</button>}</TooltipTrigger>
    <TooltipContent side="top" sideOffset={7} className="stat-tooltip">{text}</TooltipContent>
  </Tooltip></TooltipProvider>;
}
