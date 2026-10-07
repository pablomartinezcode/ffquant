// Read-only application smoke checks plus authenticated staging rejection tests.
// Run against loopback or the explicitly configured deployment; secrets stay in env.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base=process.env.FFQUANT_BASE_URL??'http://127.0.0.1:5173';
const service=process.env.FFQUANT_SITE_AUTH;
const headers=service?{'OAI-Sites-Authorization':`Bearer ${service}`} : {};
async function call(path,value,extra={}){const r=await fetch(base+path,{headers:{...headers,'Content-Type':'application/json',...extra},...(value?{method:'POST',body:JSON.stringify(value)}:{})});return {status:r.status,data:await r.json()};}
const d=(await call('/api/catalog')).data;
assert.ok(d.players.length>1000);
const p=d.players.find(p=>p.name==='Josh Allen');
assert.ok(p);
const profile=await call(`/api/player/${p.id}`);assert.equal(profile.status,200);assert.ok(profile.data.seasons.length>=8);
const history=await call('/api/history/2007');assert.ok(history.data.some(p=>p.name==='Tom Brady'));
const config={teams:12,superflex:false,ppr:1,tep:0,rosterSize:25};
const ranks=await call('/api/rankings',config);assert.equal(ranks.status,200);assert.equal(ranks.data.players.length,d.players.length);
const duplicate=await call('/api/trade',{config,sides:[[{kind:'player',id:p.id}],[{kind:'player',id:p.id}]]});assert.equal(duplicate.status,400);
assert.equal((await call('/api/ingest')).status,401);
const token=process.env.FFQUANT_INGEST_TOKEN;
if(token){
 const auth={Authorization:`Bearer ${token}`};assert.equal((await call('/api/ingest',undefined,auth)).data.ready,true);
 // Staging an incomplete actual source manifest cannot change the active snapshot.
 const manifest=JSON.parse(fs.readFileSync('data/catalog.json','utf8')).manifest;
 const begun=await call('/api/ingest',{action:'begin',id:manifest.id,manifest},auth);assert.equal(begun.status,200);
 if(begun.data.state!=='ready'){
   const publish=await call('/api/ingest',{action:'publish',id:manifest.id},auth);assert.equal(publish.status,400);assert.match(publish.data.error,/Incomplete/);
   const bad=await call('/api/ingest',{action:'artifact',id:manifest.id,key:Object.keys(manifest.artifacts)[0],content:'{}'},auth);assert.equal(bad.status,400);assert.match(bad.data.error,/checksum/);
 }
 assert.equal((await call('/api/catalog')).data.manifest.id,d.manifest.id);
}
console.log('PASS: catalog, real profile/history, rankings, duplicate rejection, ingestion auth, and staging integrity.');
