import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {rankingObservations,weeklyHistorySql,withRankChanges} from '../lib/ranking-history.ts';
const data=JSON.parse(readFileSync(new URL('../data/catalog.json',import.meta.url)));

test('archives the entire ranked universe in both explicit configurations',()=>{
 const rows=rankingObservations({...data,manifest:{...data.manifest,statsThroughWeek:4}});
 for(const format of ['1qb','sf']){
  const sample=rows.filter(r=>r.format===format);assert.equal(sample.length,data.players.length);
  assert.equal(new Set(sample.map(r=>r.player_id)).size,sample.length);
  assert.deepEqual(sample.map(r=>r.rank),Array.from({length:sample.length},(_,i)=>i+1));
  assert.equal(JSON.parse(sample[0].config).superflex,format==='sf');
  assert.equal(sample[0].week,4);assert.equal(sample[0].snapshot_id,data.manifest.id);
 }
 assert.throws(()=>rankingObservations({...data,manifest:{...data.manifest,statsThroughWeek:undefined}}));
});

test('weekly SQL is idempotent, excludes staging, selects whole-universe revisions and preserves original publications',()=>{
 const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');
 for(const file of readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())db.exec(readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
 const snapshot=db.prepare('INSERT INTO snapshots (id,manifest,state,expected,created_at) VALUES (?,?,?,?,?)');
 const insert=db.prepare('INSERT INTO ranking_history VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING');
 const add=(id,week,time,rank,state='ready',player='p')=>{
  snapshot.run(id,JSON.stringify({season:2026,statsThroughWeek:week,builtAt:time,modelVersion:'v1',sourceUpdatedAt:time}),state,1,time);
  for(let i=0;i<2;i++)insert.run(id,player,'sf',2026,week,rank,rank,50,2000,15,'{}',time);
 };
 add('a',3,'2026-09-23',10);add('b',4,'2026-09-29',8);add('c',4,'2026-09-30',7);add('d',5,'2026-10-08',1,'staging');
 const get=()=>db.prepare(weeklyHistorySql).all('sf','p','sf');
 assert.deepEqual(get().map(r=>r.snapshot_id),['c','a']);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM ranking_history').get().n,4);
 assert.equal(withRankChanges(get())[0].rank_change,3);
 add('e',4,'2026-10-01',1,'ready','other');assert.deepEqual(get().map(r=>r.snapshot_id),['a']);
 db.close();
});

test('rank movement handles missing weeks and model changes honestly',()=>{
 const rows=[{season:2026,week:5,rank:9,model_version:'v2'},{season:2026,week:4,rank:12,model_version:'v1'},{season:2026,week:2,rank:4,model_version:'v1'}];
 const changed=withRankChanges(rows);assert.equal(changed[0].rank_change,3);assert.equal(changed[0].model_changed,true);assert.equal(changed[1].rank_change,null);assert.equal(changed[2].rank_change,null);
});
