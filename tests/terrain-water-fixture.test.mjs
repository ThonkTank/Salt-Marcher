import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {manifest,terrainWaterRecords,heightPayloadHash,createTerrainWaterFixture} from '../tools/terrain-water-fixture.mjs';

test('versioned terrain workload has exactly thirty fixed attempts and reproducible nonflat sources across signed tile boundaries',async()=>{
 assert.deepEqual(manifest.scalesM,[40000000,1000000,10000,1000,20]);
 assert.deepEqual(manifest.uiScales,[1,2]);
 assert.equal(manifest.attempts.length,30);
 assert.deepEqual(manifest.attempts.map(a=>a.id),Array.from({length:30},(_,i)=>i+1));
 assert(manifest.attempts.every(a=>a.seed===manifest.seed&&a.path[0].atMs===0&&a.path.at(-1).atMs<a.durationMs));
 assert.equal(new Set(manifest.attempts.map(a=>a.kind)).size,3);
 const a=terrainWaterRecords(),b=terrainWaterRecords();assert.equal(heightPayloadHash(a),heightPayloadHash(b));
 assert.equal(heightPayloadHash(a),'65843541bc424801c51bdb697c5487ff9742f9efade1114bec04c680f338f486','Fixture v1 height payloads must not drift after baseline capture');
 assert(a.every(r=>r.height));assert(a.some(r=>r.height.x<0));assert(a.some(r=>r.height.x===0));
 const profile=await mkdtemp(path.join(os.tmpdir(),'terrain-water-fixture-'));
 try{const fixture=await createTerrainWaterFixture(profile);assert.equal(fixture.fixtureHash,heightPayloadHash(a));assert.equal(fixture.records,44);assert(new Set(fixture.heights.map(p=>p.heightM)).size>4);}finally{await rm(profile,{recursive:true,force:true});}
});
