import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {buildSync} from 'esbuild';
buildSync({entryPoints:['src/app/storage/store.ts'],outfile:'.build/session-recap-shape.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {CampaignStore}=createRequire(import.meta.url)('../.build/session-recap-shape.cjs');
for(const [name,make] of [
 ['array with text properties',()=>Object.assign([],{summary:'Anderer Rückblick',handoff:'Weiter'})],
 ['inherited serializer',()=>Object.assign(Object.create({toJSON(){return null;}}),{summary:'Anderer Rückblick',handoff:'Weiter'})],
 ['hidden serializer',()=>Object.defineProperty({summary:'Anderer Rückblick',handoff:'Weiter'},'toJSON',{value(){return [];}})],
 ['hidden text field',()=>Object.defineProperty({handoff:'Weiter'},'summary',{value:'Anderer Rückblick'})],
 ['accessor text',()=>Object.defineProperty({handoff:'Weiter'},'summary',{enumerable:true,get(){return 'Anderer Rückblick';}})],
])for(const field of ['draft','expected'])test(`recap rejects ${name} as ${field} without changing the readable saved draft`,t=>{
 const root=mkdtempSync(path.join(tmpdir(),'recap-shape-')),store=new CampaignStore(path.join(root,'source.sqlite'));
 t.after(()=>{store.close();rmSync(root,{recursive:true,force:true});});const cam=store.create('Rückblick'),w=store.activate(cam.id),original={summary:'  Rückblick\r\n[[Tor]]',handoff:'Nächster Abend\r\n  bleibt'};
 store.keepSessionRecapDraft(w.token,original,null);const before=store.db.serialize(),bad=make(),next={summary:'Nächste Fassung',handoff:'Weiter'};
 assert.throws(()=>store.keepSessionRecapDraft(w.token,field==='draft'?bad:next,field==='expected'?bad:original),/Rückblickentwurf/);
 assert.ok(store.db.serialize().equals(before));assert.deepEqual(store.live(w.token).recapDraft,original);
});
test('recap plain data keeps exact author bytes and a matching compare-and-set basis',t=>{
 const root=mkdtempSync(path.join(tmpdir(),'recap-plain-')),file=path.join(root,'source.sqlite'),store=new CampaignStore(file);t.after(()=>{store.close();rmSync(root,{recursive:true,force:true});});const cam=store.create('Rückblick'),w=store.activate(cam.id),original={summary:'  Rückblick\r\n[[Tor]]',handoff:'Nächster Abend\r\n  bleibt'},next={summary:'Später\r\n[Hinweis](https://example.invalid)',handoff:''};
 store.keepSessionRecapDraft(w.token,original,null);store.keepSessionRecapDraft(w.token,next,original);store.keepSessionRecapDraft(w.token,next,original);assert.deepEqual(store.live(w.token).recapDraft,next);
 const fresh=new CampaignStore(file);try{assert.deepEqual(fresh.live(fresh.activate(cam.id).token).recapDraft,next);}finally{fresh.close();}
});
