import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
buildSync({entryPoints:['src/app/storage/atlas-deferred-geometry.ts'],outfile:'.build/atlas-deferred-geometry-test.cjs',bundle:true,platform:'node',format:'cjs'});
const {AtlasDeferredGeometry}=createRequire(import.meta.url)('../.build/atlas-deferred-geometry-test.cjs');
const source=(changes=[],reset=false)=>({revision:7,fence:'current',reset,changes});
test('bounded deferred keys coalesce geometry edits, ignore terrain and retain reset until accepted',()=>{
 const queue=new AtlasDeferredGeometry();assert.equal(queue.source(source()).reset,true);queue.accepted();
 queue.observe(source([{table:'room',id:'a'},{table:'atlas_landscape',id:'terrain'}]));queue.observe(source([{table:'room',id:'a'},{table:'drawing_hidden',id:'a'}]));
 assert.deepEqual(queue.source(source()),source([{table:'room',id:'a'},{table:'drawing_hidden',id:'a'}]));
 queue.accepted();assert.deepEqual(queue.source(source()),source());
 for(const change of [{table:'room',id:'a'}])queue.observe(source([change],true));
 queue.observe(source([{table:'room',id:'b'}]));assert.deepEqual(queue.source(source()),source([],true));
 queue.accepted();queue.observe(source(Array.from({length:10001},(_,i)=>({table:'room',id:String(i)}))));assert.deepEqual(queue.source(source()),source([],true));
 queue.accepted();queue.observe(source([{table:'room',id:'x'.repeat(600000)}]));assert.equal(queue.source(source()).reset,true);
});
