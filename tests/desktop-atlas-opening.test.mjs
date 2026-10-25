import {sourceFunctions} from './helpers/source.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';

// Execute the real entry coordinator without booting unrelated renderer panels.
const renderer=readFileSync('src/app/renderer.ts','utf8');
const coordinator=sourceFunctions(renderer, ['reopenView']);
const {code}=transformSync(`
  export function fixture(){
    let workspace={},activationIntent=1,viewRequest=0,activationFailed=false;
    let resolve,reject;const pending=new Promise((yes,no)=>{resolve=yes;reject=no;});
    const errors=[],calls=[];
    const campaignAtlas={open:()=>{calls.push('atlas');return pending;}};
    const openLive=()=>{calls.push('live');return pending;};
    const showTab=()=>{viewRequest++;return 0;};
    const status=(message,error)=>errors.push({message,error});
    const window={requestAnimationFrame:()=>{}};
    ${coordinator}
    return {open:reopenView,resolve,reject,errors,calls,
      changeOwner:()=>{workspace={};activationIntent++;},
      changeView:()=>{viewRequest++;}};
  }
`,{loader:'ts',format:'cjs'});
const module={exports:{}};new Function('exports','module',code)(module.exports,module);const exported=module.exports;
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('opening the Atlas releases the workspace while its first region is unresolved',async()=>{
 const f=exported.fixture();let settled=false;const opening=f.open('atlas').then(()=>settled=true);
 try {await tick();assert.equal(settled,true);assert.deepEqual(f.calls,['atlas']);}
 finally {f.resolve();await opening;}
});
for(const stale of [null,'changeOwner','changeView'])test(`late Atlas opening errors belong only to the current view: ${stale??'current'}`,async()=>{
 const f=exported.fixture();await f.open('atlas');if(stale)f[stale]();f.reject(Error('Karte nicht verfügbar'));await tick();
 assert.deepEqual(f.errors,stale?[]:[{message:'Karte nicht verfügbar',error:true}]);
});
test('the change preserves awaited entry for other workspace areas',async()=>{
 const f=exported.fixture();let settled=false;const opening=f.open('live').then(()=>settled=true);
 await tick();assert.equal(settled,false);f.resolve();await opening;assert.equal(settled,true);
});
