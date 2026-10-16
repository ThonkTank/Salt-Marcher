import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
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

for(const raw of ['{"summary":','[]'])test(`unreadable stored recap ${raw} leaves the scene readable without weakening write or backup checks`,async t=>{
 const root=mkdtempSync(path.join(tmpdir(),'recap-read-')),store=new CampaignStore(path.join(root,'source.sqlite'));t.after(()=>{store.close();rmSync(root,{recursive:true,force:true});});const cam=store.create('Rückblick'),w=store.activate(cam.id),safe=path.join(root,'safe.sqlite');
 const initial=store.executeLive({commandId:'initialize',campaignId:cam.id,token:w.token,action:{kind:'initialize',expectedRosterRevision:0}}).scene;await store.backup(safe);const backup=readFileSync(safe);
 store.db.prepare('INSERT INTO settings VALUES(?,?)').run('session-recap:'+cam.id,raw);const before=store.db.serialize(),view=store.live(w.token);
 assert.equal(view.scene.id,initial.id);assert.equal(Object.hasOwn(view,'recapDraft'),false);assert.match(view.recapDraftError,/Rückblickentwurf/);assert.ok(store.db.serialize().equals(before));
 assert.throws(()=>store.keepSessionRecapDraft(w.token,{summary:'',handoff:''},null));assert.ok(store.db.serialize().equals(before));await assert.rejects(store.backup(safe));assert.deepEqual(readFileSync(safe),backup);
 store.executeLive({commandId:'edit-scene',campaignId:cam.id,token:w.token,action:{kind:'scene-content',sceneId:initial.id,expectedRevision:initial.revision,title:'Spiel geht weiter',notes:'  Eigene Notizen\r\n',locationId:null}});
 assert.equal(store.live(w.token).scene.notes,'  Eigene Notizen\r\n');assert.equal(store.db.prepare('SELECT value FROM settings WHERE key=?').get('session-recap:'+cam.id).value,raw);assert.throws(()=>store.live('expired'));store.db.prepare('UPDATE live_scene SET revision=-1 WHERE campaign_id=? AND id=?').run(cam.id,initial.id);assert.throws(()=>store.live(w.token),/Sceneinhalt/);
});
