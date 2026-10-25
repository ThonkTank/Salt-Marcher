import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
import {mkdirSync} from 'node:fs';
import path from 'node:path';
const root=path.resolve('.build/A0.13-recovery-'+process.pid);mkdirSync(root,{recursive:true});
buildSync({stdin:{resolveDir:process.cwd(),contents:"export * from './src/app/atlas-write-recovery';export * from './src/app/atlas-write-receipt';"},outfile:path.join(root,'recovery.cjs'),bundle:true,platform:'node',format:'cjs'});
const {atlasWriteReference,dispatchRecoverableAtlasWrite,newGraphPreviewTarget,checkedAtlasWriteReference}=createRequire(import.meta.url)(path.join(root,'recovery.cjs'));
const command=()=>({commandId:crypto.randomUUID(),campaignId:'campaign',token:'original',action:{kind:'drawing',command:{commandId:'nested',token:'original',campaignId:'campaign',action:{kind:'undo'}}}});

test('reference hashes the original nested token; new authority is not rewritten into its identity',async()=>{
 const c=command(),before=structuredClone(c),ref=await atlasWriteReference({kind:'atlas',command:c});
 assert.deepEqual(c,before);assert.equal(ref.fingerprint,(await atlasWriteReference({kind:'atlas',command:{...c,token:'new'}})).fingerprint);
 assert.notEqual(ref.fingerprint,(await atlasWriteReference({kind:'atlas',command:{...c,action:{...c.action,command:{...c.action.command,token:'new'}}}})).fingerprint);
 assert.equal(JSON.stringify(ref).includes('original'),false);assert.equal(JSON.stringify(ref).includes('action'),false);
});

test('capture before awaiting persistence dispatches exactly the original command; no implicit clearing',async()=>{
 const c=command(),before=structuredClone(c),events=[];let saved,release,entered;
 const started=new Promise(r=>entered=r),gate=new Promise(r=>release=r),task=dispatchRecoverableAtlasWrite({keepAtlasWriteReference:async(ref,token)=>{events.push('save');entered();saved=ref;assert.equal(token,'original');await gate;return{ok:true,value:undefined};}},{kind:'atlas',command:c},async value=>{events.push('dispatch');assert.deepEqual(value,before);return 42;});
 c.action.command.token='new';await started;assert.deepEqual(events,['save']);release();assert.equal(await task,42);
 assert.deepEqual(events,['save','dispatch']);assert.deepEqual(saved,await atlasWriteReference({kind:'atlas',command:before}));
});

for(const mode of ['result','throw'])test(`persistence ${mode} failure sends no command`,async()=>{
 let dispatches=0;
 await assert.rejects(dispatchRecoverableAtlasWrite({keepAtlasWriteReference:async()=>{if(mode==='throw')throw Error('disk');return{ok:false,error:'disk'};}},{kind:'atlas',command:command()},async()=>dispatches++),/disk/);
 assert.equal(dispatches,0);
});

test('first graph reference includes a newly assigned preview; huge payload stays out of persistence',async()=>{
 const target=newGraphPreviewTarget('local'),c={commandId:'first',campaignId:'campaign',token:'old',scopeId:'local',target,action:{kind:'graph-layout',layout:{description:'x'.repeat(2000000)}}};
 const ref=await atlasWriteReference({kind:'graph',command:c});assert.equal(ref.family,'preview');assert.deepEqual(ref.target,target);assert(JSON.stringify(ref).length<500);
 assert.equal((await atlasWriteReference({kind:'graph',command:{...c,action:{kind:'accept'}}})).family,'atlas');
 await assert.rejects(atlasWriteReference({kind:'graph',command:{...c,action:{kind:'select',roomId:'room'}}}),/keinen Schreibbeleg/);
});

test('invalid and payload-carrying references fail closed',async()=>{
 const ref=await atlasWriteReference({kind:'atlas',command:command()});
 for(const bad of [null,{}, {...ref,action:{}},{...ref,token:'new'},{...ref,fingerprint:'bad'},{...ref,family:'preview'},{...ref,target:{kind:'graph-preview',previewId:'../../escape',scopeId:'local',revision:0}}])assert.throws(()=>checkedAtlasWriteReference(bad));
});

test('standalone reference preparation captures target and IDs before asynchronous hashing',async()=>{
 const c={...command(),target:newGraphPreviewTarget('local')},before=structuredClone(c),pending=atlasWriteReference({kind:'atlas',command:c});
 c.commandId='mutated';c.target.previewId='changed';c.action.command.token='changed';
 assert.deepEqual(await pending,await atlasWriteReference({kind:'atlas',command:before}));
});
