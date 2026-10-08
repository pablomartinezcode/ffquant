import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {rankPlayers,defaultConfig,qualifiedScoringSample,points} from '../lib/football.ts';
import {rankingColumns,columnById,metricValue,sortRankingTable,toggleRankingSort,readColumnPreferences,defaultColumns} from '../lib/ranking-columns.ts';
const data=JSON.parse(fs.readFileSync(new URL('../data/catalog.json',import.meta.url)));
const players=rankPlayers(data.players,defaultConfig);
const rows=JSON.parse(fs.readFileSync(new URL(`../public/data/history/${data.manifest.season}.json`,import.meta.url)));
const stats=new Map(rows.map(s=>[s.id,s]));

test('every metric sorts the entire player pool in both directions, with unavailable values last',()=>{
  for(const column of rankingColumns)for(const direction of ['asc','desc'])for(const basis of ['total','perGame']){
    const sorted=sortRankingTable(players,{key:column.id,direction},stats,basis,defaultConfig,false);
    let previous=null,missing=false;
    for(const player of sorted){
      const value=metricValue(player,column,stats,basis,defaultConfig);
      if(value==null||typeof value==='number'&&!Number.isFinite(value)){missing=true;continue;}
      assert.equal(missing,false,`${column.id}: values follow a missing entry`);
      if(previous!=null){const delta=typeof value==='string'?previous.localeCompare(value):previous-value;assert.ok(direction==='asc'?delta<=0:delta>=0,`${column.id} ${direction}`);}
      previous=value;
    }
  }
});
test('sort direction toggles and switches to appropriate defaults',()=>{
  let sort={key:'value',direction:'desc'};
  sort=toggleRankingSort(sort,'form');assert.deepEqual(sort,{key:'form',direction:'desc'});
  sort=toggleRankingSort(sort,'form');assert.equal(sort.direction,'asc');
  assert.equal(toggleRankingSort(sort,'age').direction,'asc');
  assert.equal(toggleRankingSort(sort,'targets').direction,'desc');
});
test('observed totals and per-game stats reconcile to published records and selected scoring',()=>{
  const player=players.find(p=>p.position==='TE'&&stats.get(p.id)?.stats.targets>0),row=stats.get(player.id);
  assert.equal(metricValue(player,columnById.get('targets'),stats,'total',defaultConfig),row.stats.targets);
  assert.equal(metricValue(player,columnById.get('targets'),stats,'perGame',defaultConfig),row.stats.targets/row.games);
  assert.equal(metricValue(player,columnById.get('games'),stats,'perGame',defaultConfig),row.games);
  for(const config of [defaultConfig,{...defaultConfig,ppr:0,tep:.5},{...defaultConfig,scoring:{rec:2,rec_yd:.1}}]){
    assert.equal(metricValue(player,columnById.get('fantasy_points'),stats,'total',config),points(row.stats,player.position,config));
  }
  const missing=new Map([[player.id,{...row,stats:{...row.stats,targets:null,receptions:null}}]]);
  assert.equal(metricValue(player,columnById.get('targets'),missing,'total',defaultConfig),null);
  assert.equal(metricValue(player,columnById.get('fantasy_points'),missing,'total',defaultConfig),null);
  assert.equal(metricValue(player,columnById.get('fantasy_points'),missing,'total',{...defaultConfig,scoring:{pass_fd:1}}),row.stats.passing_first_downs==null?null:row.stats.passing_first_downs);
  assert.equal(metricValue(player,columnById.get('targets'),new Map(),'total',defaultConfig),null);
});
test('qualification is explicit and can be disabled; retired entries remain excluded in every sort',()=>{
  const retired={...players[0],id:'retired',dynastyEligible:false,value:1e9};
  for(const key of ['form','median','sd'])for(const direction of ['asc','desc']){
    const sorted=sortRankingTable([...players,retired],{key,direction},stats,'total',defaultConfig,true);
    assert.ok(!sorted.some(p=>p.id==='retired'));
    const firstUnqualified=sorted.findIndex(p=>!qualifiedScoringSample(p));
    assert.ok(sorted.slice(firstUnqualified).every(p=>!qualifiedScoringSample(p)));
  }
});
test('preferences validate storage, always retain identity columns and ignore unknown columns',()=>{
  assert.deepEqual(readColumnPreferences(null),{columns:defaultColumns,basis:'total'});
  assert.deepEqual(readColumnPreferences({columns:['targets','targets','invalid'],basis:'perGame'}),{columns:['rank','name','targets'],basis:'perGame'});
  assert.equal(readColumnPreferences({columns:17,basis:'invalid'}).basis,'total');
});
