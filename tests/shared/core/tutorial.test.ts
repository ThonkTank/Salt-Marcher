import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {parseHTML} from 'linkedom';
import {LiveEncounterGenerator} from '../../../src/app/runtime/live-generation-ui';
import {SessionCopy} from '../../../src/app/campaign/session-copy-ui';
import {initNarrativeJournal} from '../../../src/app/runtime/narrative-journal-ui';
import {initQuickReference} from '../../../src/app/catalog/quick-reference-ui';
import {initWorld} from '../../../src/app/runtime/world-ui';
import {WorldLinksMap} from '../../../src/app/campaign/world-links-map';
import {initNpcs} from '../../../src/app/campaign/npc-ui';
import {initMusic} from '../../../src/app/runtime/music-ui';
import {initSoundboard} from '../../../src/app/runtime/live-soundboard-ui';
import {CampaignStore} from '../../../src/app/storage/store';
import {lessons,tutorialCapabilityLessons,tutorialSurfaceLessons} from '../../../src/app/workspace/tutorial';
import {tutorialLessonRevision} from '../../../src/app/workspace/tutorial-contracts';
const capabilityExists=(sources:string,id:string)=>{
 const escaped=id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 return new RegExp(String.raw`\bid\s*=\s*["']${escaped}["']`).test(sources);
};


test("changed help preserves this installed version's completed tutorial across restart",()=>{
 const root=mkdtempSync(join(tmpdir(),'tutorial-revision-')),path=join(root,'campaign.sqlite');let store=new CampaignStore(path,'1.0.0');try{const initial=store.tutorial();assert.equal(initial.lessonRevision,tutorialLessonRevision);const finished=store.tutorial('finished');assert.equal(finished.state,'finished');const db=(store as unknown as {db:any}).db,legacy={...finished,lessonRevision:'desktop-tutorial-accessibility-v12'};db.prepare('UPDATE settings SET value=? WHERE key=?').run(JSON.stringify(legacy),'tutorial:app:1.0.0');const updated=store.tutorial();assert.deepEqual(updated,legacy);assert.equal(updated.state,'finished');assert.equal(updated.runId,finished.runId);store.close();store=new CampaignStore(path,'1.0.0');assert.deepEqual(store.tutorial(),updated);
 }finally{store.close();rmSync(root,{recursive:true,force:true});}
});

test('application updates start once and skip remains a terminal choice',()=>{
 const root=mkdtempSync(join(tmpdir(),'tutorial-update-')),path=join(root,'campaign.sqlite');let store=new CampaignStore(path,'1.0.0');try{const first=store.tutorial('skipped');assert.equal(first.state,'skipped');assert.equal(store.tutorial('shown').state,'skipped');store.close();store=new CampaignStore(path,'1.1.0');const update=store.tutorial();assert.equal(update.state,'new');assert.notEqual(update.runId,first.runId);assert.equal(store.tutorial('shown').state,'shown');assert.equal(store.tutorial('skipped').state,'skipped');
 }finally{store.close();rmSync(root,{recursive:true,force:true});}
});

test('every primary workspace and independent header capability has a current tutorial lesson',()=>{
 const html=readFileSync(join(process.cwd(),'src/app/workspace/index.html'),'utf8'),dynamic=[...readdirSync(join(process.cwd(),'src/app'),{recursive:true}).filter((file):file is string=>typeof file==='string'&&file.endsWith('-ui.ts')),'runtime/live.ts','workspace/renderer.ts','campaign/preparation.ts','campaign/text-reference-picker.ts'].map(file=>readFileSync(join(process.cwd(),'src/app',file),'utf8')).join('\n'),{document,window}=parseHTML(html),prior={document:globalThis.document,window:globalThis.window,setInterval:globalThis.setInterval,HTMLSelectElement:globalThis.HTMLSelectElement},ids=lessons.map(lesson=>lesson.id);window.campaign={onAudioTransfer:()=>{}} as unknown as typeof window.campaign;Object.assign(globalThis,{document,window,setInterval:()=>0,HTMLSelectElement:window.HTMLSelectElement});try{const packet=document.createElement('button');packet.id='live-session-packet';document.body.append(packet);new LiveEncounterGenerator(()=>{},()=>null,async()=>true,async()=>true);new SessionCopy(()=>{},()=>null,async()=>true,async()=>{});initNarrativeJournal(()=>{},async()=>true,async()=>true,async()=>{});initQuickReference(()=>{},async()=>true,async()=>{});initMusic(()=>{},async()=>{});initSoundboard(()=>{},async()=>{},async()=>{});initWorld(()=>{},async()=>true,async()=>{},async()=>{},async()=>{});initNpcs(()=>{},async()=>{},async()=>{});document.body.append(new WorldLinksMap(()=>{}).root);assert.equal(new Set(ids).size,ids.length);for(const [surface,lesson] of Object.entries(tutorialSurfaceLessons)){assert.ok(document.getElementById(surface),surface);assert.ok(ids.includes(lesson),`${surface} -> ${lesson}`);}const workspaces=[...document.querySelectorAll<HTMLButtonElement>('nav[aria-label="Arbeitsbereich"] button')].map(button=>button.id.replace(/-tab$/,''));for(const surface of workspaces)assert.ok(surface in tutorialSurfaceLessons,`Arbeitsbereich ohne Lektion: ${surface}`);const headerCapabilities=[...document.querySelectorAll<HTMLButtonElement>('body > header button')].map(button=>button.id).filter(id=>id!=='help');for(const entry of headerCapabilities)assert.ok(entry in tutorialSurfaceLessons,`Kopfzeilenfähigkeit ohne Lektion: ${entry}`);for(const [entry,lesson] of Object.entries(tutorialCapabilityLessons)){assert.ok(document.getElementById(entry)||capabilityExists(html+'\n'+dynamic,entry),entry);assert.ok(ids.includes(lesson),`${entry} -> ${lesson}`);}for(const id of ['campaign-transfer','chronicle','session-recap','extensions','session-generation','world-notes','locations','relationships','preparation-recovery','manual-planning','campaign-agenda','narrative-journal','session-review','session-packet','session-reuse','session-progress','encounter-catalog','encounter-templates','encounter-tables','world-sources','loot-tables','generator-presets','encounter-generation','required-opponents','npc-generation','mixed-opponents','live-generation','npc-world','prepared-groups','npc-dossier','npc-autonomy','party-topbar','roster-archive','live-party','live-recovery','groups','relative-time','scene-desk','multiple-encounters','chase','combat-rewards','character-health','character-progression','personal-loot','item-definitions','items-trade','treasury','treasure-distribution','player-cues','player-display','atlas-hex','map-route','travel-checkpoints','calendar-events','weather-control','music-library','music-transport','music-context','live-soundboard','dungeon-structure','dungeon-volumes','dungeon-triggers','dungeon-content','dungeon-graph','dungeon-keys','dungeon-paths','dungeon-binder','city-infill','city-regeneration','city-buildings','live-rules'])assert.ok(ids.includes(id));}finally{Object.assign(globalThis,prior);}
});


test('capability declarations recognize actual id assignments without treating lookup calls as construction',()=>{
 assert.equal(capabilityExists("insert.id='text-reference-insert';",'text-reference-insert'),true);
 assert.equal(capabilityExists("get('text-reference-insert');",'text-reference-insert'),false);
});
