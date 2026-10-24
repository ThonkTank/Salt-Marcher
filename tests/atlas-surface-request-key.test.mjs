import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const {outputFiles}=await build({entryPoints:['src/app/atlas-surface-request-key.ts'],bundle:true,write:false,platform:'node',format:'esm'});
const {atlasSurfaceRequestKey:key}=await import('data:text/javascript;base64,'+Buffer.from(outputFiles[0].text).toString('base64'));
test('twenty camera moves within the same address set retain their in-flight tile request',()=>{
 const box={x:10,y:10,width:100,height:100},base=key('token',1,'fence',box,1);
 for(let i=0;i<20;i++)assert.equal(key('token',1,'fence',{...box,x:10+i,y:10+i},1),base);
 for(const different of [key('token',2,'fence',box,1),key('token',1,'other',box,1),key('other',1,'fence',box,1),key('token',1,'fence',{...box,x:300},1),key('token',1,'fence',box,.1)])assert.notEqual(different,base);
});

test('moving the fine focus across a retained horizon changes the requested address set',()=>{
 const box={x:-32768,y:-32768,width:65536,height:65536},focus={x:-512,y:-384,width:1024,height:768};
 const a=key('token',1,'fence',box,1,64,focus),b=key('token',1,'fence',box,1,64,{...focus,x:8192});
 assert.notEqual(a,b);assert.equal(a,key('token',1,'fence',box,1,64,{...focus}));
});
