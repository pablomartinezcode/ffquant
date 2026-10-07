import test from 'node:test';
import assert from 'node:assert/strict';
import {ageRetention,ageForecast,scoringSpread,defaultConfig,rankPlayers,roleAvailability} from '../lib/football.ts';
import {teamValues} from '../lib/league-values.ts';

test('aging preserves QB passing runway, separates rushing and keeps continuous position curves',()=>{
 assert.equal(ageRetention('QB',30,2),1);
 assert.ok(ageRetention('QB',30,2)>ageRetention('TE',30,2));
 assert.ok(ageRetention('TE',30,2)>ageRetention('WR',30,2));
 assert.ok(ageRetention('WR',30,2)>ageRetention('RB',30,2));
 assert.ok(ageRetention('QB',30,2,true)<ageRetention('QB',30,2));
 for(const pos of ['QB','RB','WR','TE'])for(let age=22;age<40;age+=.5){assert.ok(ageRetention(pos,age,2)<=ageRetention(pos,age,1));assert.ok(Math.abs(ageRetention(pos,age,2)-ageRetention(pos,age+.001,2))<.002);}
 const f=ageForecast({passing_yards:250,rushing_yards:50},'QB',30,2);assert.equal(f.passing_yards,250);assert.ok(f.rushing_yards<50);
});
test('spread uses median and sample SD, including negatives and selected scoring',()=>{
 const p={position:'WR',scoreSamples:[{season:2026,week:1,stats:{receptions:0,fumbles_lost_total:1}},{season:2026,week:2,stats:{receptions:2}},{season:2026,week:3,stats:{receptions:8}}]};
 const s=scoringSpread(p,defaultConfig);assert.equal(s.median,2);assert.ok(Math.abs(s.sd-Math.sqrt(76/3))<1e-10);assert.equal(s.low,2-s.sd);assert.equal(s.q25,0);assert.equal(s.q75,5);assert.equal(s.count,3);
 assert.equal(scoringSpread(p,{...defaultConfig,ppr:0}).median,0);
 assert.equal(scoringSpread({...p,scoreSamples:[]},defaultConfig),null);
 assert.equal(scoringSpread({...p,scoreSamples:p.scoreSamples.slice(0,1)},defaultConfig).sd,null);
});
test('retired/stale records cannot create replacement value; Superflex permits a non-QB alternative',()=>{
 const make=(id,position,ppg,more={})=>({id,name:id,sleeperId:id,position,team:'BUF',age:26,forecast:{receptions:ppg},previousForecast:null,currentForm:null,remainingGames:13,gamesThisSeason:4,experience:4,matchupFactor:1,confidence:'medium',depthOrder:1,valuationEligible:true,...more});
 const players=[...Array.from({length:32},(_,i)=>make('q'+i,'QB',25-i*.3)),...Array.from({length:100},(_,i)=>make('w'+i,'WR',15-i*.05))];
 const c={...defaultConfig,superflex:true};const r=rankPlayers(players,c);
 const stale=make('retired','QB',100,{valuationEligible:false});assert.equal(roleAvailability(stale),0);
 assert.equal(rankPlayers([...players,stale],c).find(p=>p.id==='q0').value,r.find(p=>p.id==='q0').value);
 const q=r.find(p=>p.id==='q0');assert.ok(q.replacementPpg>=r.find(p=>p.position==='WR').replacementPpg);
});
test('team totals sum underlying values, deduplicate IR/taxi and retain empty teams',()=>{
 const ranked=[{sleeperId:'a',position:'QB',value:100.25,rating:50},{sleeperId:'b',position:'RB',value:200.5,rating:60}];
 const v=teamValues([{roster_id:1,players:['a','b','DEF'],reserve:['a'],taxi:['b']},{roster_id:2,players:null}],ranked);
 assert.equal(v[0].total,300.75);assert.equal(v[0].positions.QB,100.25);assert.equal(v[0].valued,2);assert.equal(v[0].excluded,1);assert.equal(v[1].total,0);
});
