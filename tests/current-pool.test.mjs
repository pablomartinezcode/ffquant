import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {rankPlayers,sortRankings,defaultConfig} from '../lib/football.ts';
const data=JSON.parse(fs.readFileSync(new URL('../data/catalog.json',import.meta.url)));
test('retired and unrostered entries never enter any ranking sort or affect current values',()=>{
 const active=rankPlayers(data.players,defaultConfig);
 const fake={...data.players[0],id:'retired-test',name:'Retired test',team:'FA',dynastyEligible:false,forecast:{passing_yards:10000},currentForm:10000,scoreSamples:Array.from({length:17},(_,i)=>({season:2026,week:i+1,stats:{passing_yards:10000}}))};
 const mixed=rankPlayers([...data.players,fake],defaultConfig);
 assert.deepEqual(mixed,active);
 for(const sort of ['value','ppg','form','median','sd'])assert.ok(!sortRankings([...mixed,{...fake,value:1e9,ppg:999}],sort).some(p=>p.id===fake.id));
 const geno=active.find(p=>p.name==='Geno Smith');assert.ok(geno&&geno.gamesThisSeason>0);
 for(const name of ['Tom Brady','Drew Brees','Matt Ryan','Joe Mixon'])assert.ok(!active.some(p=>p.name===name));
});
test('one-game and backup samples follow qualified current-season samples',()=>{
 const ranked=rankPlayers(data.players,{...defaultConfig,superflex:true});
 const keenum=ranked.find(p=>p.name==='Case Keenum'),caleb=ranked.find(p=>p.name==='Caleb Williams');
 assert.ok(keenum&&caleb);assert.equal(keenum.spread.count,1);assert.equal(keenum.spread.sd,null);
 assert.ok(caleb.value>keenum.value);assert.equal(caleb.qbRole.label,'Injured incumbent');
 for(const sort of ['median','sd','form']){const qbs=sortRankings(ranked.filter(p=>p.position==='QB'),sort);assert.ok(qbs.findIndex(p=>p.name==='Geno Smith')<qbs.findIndex(p=>p.name==='Case Keenum'));}
});
test('archive retains retired careers while scoring samples contain only the current season',()=>{
 for(const p of data.players)assert.ok(p.scoreSamples.every(g=>g.season===data.manifest.season));
 const index=JSON.parse(fs.readFileSync(new URL('../public/data/history-index.json',import.meta.url)));
 for(const name of ['Tom Brady','Joe Mixon']){const p=index.find(p=>p.name===name);assert.ok(p&&!p.current);const detail=JSON.parse(fs.readFileSync(new URL(`../public/data/players/${p.id}.json`,import.meta.url)));assert.ok(detail.seasons.length>0&&detail.weekly.length>0);assert.equal(detail.player,null);}
});
