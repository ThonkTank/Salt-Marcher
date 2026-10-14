import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {parseHTML} from 'linkedom';
import {CampaignStore} from '../../src/app/storage/store';
import {initTutorial,lessons,tutorialLessonRevision,tutorialSurfaceLessons,type TutorialRun} from '../../src/app/tutorial';

const settle=()=>new Promise<void>(resolve=>setImmediate(resolve));

test('a changed lesson revision creates a new optional tutorial run in the same application version',()=>{
 const root=mkdtempSync(join(tmpdir(),'tutorial-revision-')),path=join(root,'campaign.sqlite');let store=new CampaignStore(path,'1.0.0');try{const initial=store.tutorial();assert.equal(initial.lessonRevision,tutorialLessonRevision);const finished=store.tutorial('finished');assert.equal(finished.state,'finished');const db=(store as unknown as {db:any}).db,legacy={...finished,lessonRevision:'desktop-tutorial-accessibility-v12'};db.prepare('UPDATE settings SET value=? WHERE key=?').run(JSON.stringify(legacy),'tutorial:app:1.0.0');const updated=store.tutorial();assert.equal(updated.state,'new');assert.equal(updated.lessonRevision,tutorialLessonRevision);assert.notEqual(updated.runId,finished.runId);store.close();store=new CampaignStore(path,'1.0.0');assert.deepEqual(store.tutorial(),updated);
 }finally{store.close();rmSync(root,{recursive:true,force:true});}
});

test('application updates start once and skip remains a terminal choice',()=>{
 const root=mkdtempSync(join(tmpdir(),'tutorial-update-')),path=join(root,'campaign.sqlite');let store=new CampaignStore(path,'1.0.0');try{const first=store.tutorial('skipped');assert.equal(first.state,'skipped');assert.equal(store.tutorial('shown').state,'skipped');store.close();store=new CampaignStore(path,'1.1.0');const update=store.tutorial();assert.equal(update.state,'new');assert.notEqual(update.runId,first.runId);assert.equal(store.tutorial('shown').state,'shown');assert.equal(store.tutorial('skipped').state,'skipped');
 }finally{store.close();rmSync(root,{recursive:true,force:true});}
});

test('every primary workspace and independent header capability has a current tutorial lesson',()=>{
 const html=readFileSync(join(process.cwd(),'src/app/index.html'),'utf8'),{document}=parseHTML(html),ids=lessons.map(lesson=>lesson.id);assert.equal(new Set(ids).size,ids.length);for(const [surface,lesson] of Object.entries(tutorialSurfaceLessons)){assert.ok(document.getElementById(surface),surface);assert.ok(ids.includes(lesson),`${surface} -> ${lesson}`);}const workspaces=[...document.querySelectorAll<HTMLButtonElement>('nav[aria-label="Arbeitsbereich"] button')].map(button=>button.id.replace(/-tab$/,''));for(const surface of workspaces)assert.ok(surface in tutorialSurfaceLessons,`Arbeitsbereich ohne Lektion: ${surface}`);for(const id of ['campaign-transfer','chronicle','extensions'])assert.ok(ids.includes(id));
});

test('the first-run dialog opens automatically and skip closes it without blocking help',async()=>{
 const parsed=parseHTML(readFileSync(join(process.cwd(),'src/app/index.html'),'utf8')),priorDocument=globalThis.document,priorWindow=globalThis.window,{document,window}=parsed,dialog=document.getElementById('tutorial-dialog') as HTMLDialogElement,calls:(TutorialRun['state']|undefined)[]=[];let state:TutorialRun['state']='new';Object.assign(globalThis,{document,window});Object.defineProperty(dialog,'open',{value:false,writable:true});dialog.showModal=()=>{dialog.open=true;};dialog.close=()=>{dialog.open=false;};window.campaign={tutorial:async(next?:'shown'|'finished'|'skipped')=>{calls.push(next);if(next)state=next;return{ok:true as const,value:{version:'1.0.0',lessonRevision:tutorialLessonRevision,runId:'run',state}};}} as unknown as typeof window.campaign;
 try{await initTutorial();assert.equal(dialog.open,true);assert.deepEqual(calls,[undefined,'shown']);assert.equal(document.querySelectorAll('#tutorial-lessons li').length,lessons.length);document.getElementById('tutorial-skip')!.onclick?.(new window.Event('click') as any);await settle();assert.equal(dialog.open,false);assert.equal(state,'skipped');document.getElementById('help')!.onclick?.(new window.Event('click') as any);assert.equal(dialog.open,true);
 }finally{Object.assign(globalThis,{document:priorDocument,window:priorWindow});}
});
