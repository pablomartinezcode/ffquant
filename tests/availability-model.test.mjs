import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {rankPlayers,defaultConfig,isDynastyPlayer} from '../lib/football.ts';
const dataset=JSON.parse(fs.readFileSync(new URL('../data/catalog.json',import.meta.url)));
test('unavailable players lose next-game and remaining-season value without erasing conditional talent or future value',()=>{
  const players=dataset.players;
  const target=players.find(p=>p.name==='James Conner');assert.ok(target?.availability);
  const actual=rankPlayers(players,defaultConfig).find(p=>p.id===target.id);
  const available=rankPlayers(players.map(p=>p.id===target.id?{...p,availability:{...p.availability,nextGameWeight:1,rosWeight:1}}:p),defaultConfig).find(p=>p.id===target.id);
  assert.equal(actual.nextGamePoints,0);
  assert.equal(actual.ppg,available.ppg);
  assert.ok(actual.rosPoints<available.rosPoints);assert.ok(actual.value<available.value);assert.ok(actual.value>0);
  assert.ok(Math.abs(actual.rosPoints-actual.ppg*actual.remainingGames*target.availability.rosWeight)<1e-8);
});
test('missed-game history does not keep penalizing a restored active player',()=>{
  const puka=dataset.players.find(p=>p.name==='Puka Nacua');assert.ok(puka?.availability);
  assert.equal(puka.availability.label,'Available');assert.equal(puka.availability.rosWeight,1);
  assert.equal(puka.availability.missedGames,2);assert.deepEqual(puka.availability.missedWeeks,[2,3]);
  assert.equal(dataset.players.find(p=>p.name==='James Conner').availability.missedGames,4);
});
test('stale active flags cannot revive retired or released players in rankings',()=>{
  const template=dataset.players[0];
  for(const status of ['RET','CUT','UFA','RFA','RSR','TRC','TRD','TRT','NWT'])assert.equal(isDynastyPlayer({...template,status:'Active',rosterStatus:status}),false);
  assert.equal(isDynastyPlayer({...template,status:'Active',team:'FA'}),false);
});
