import assert from 'node:assert/strict';
import test from 'node:test';
import {canClearSavedLiveMoment,emptyLiveMomentDraft,liveMomentSavedMessage,checkedLiveMomentDraft,sameLiveMomentDraft} from '../../../src/app/runtime/live-moment-drafts';

test('a confirmed moment clears only the unchanged draft for the same scene',()=>{
  const saved={category:'narrative' as const,title:'Siegel erkannt',summary:'Ada kennt das Zeichen.',followUp:'quest' as const};
  assert.equal(canClearSavedLiveMoment('scene-a','scene-a',saved,structuredClone(saved)),true);
  assert.equal(canClearSavedLiveMoment('scene-a','scene-a',saved,{...saved,summary:'Ada kennt jetzt auch den Träger.'}),false);
  assert.equal(canClearSavedLiveMoment('scene-a','scene-a',saved,{...saved,followUp:'rumor'}),false);
  assert.equal(canClearSavedLiveMoment('scene-a','scene-b',saved,structuredClone(saved)),false);
});

test('live moment confirmation names one completed action without duplicating saved',()=>{
  assert.equal(liveMomentSavedMessage('',true),'Moment in der Kampagnenchronik gespeichert.');
  assert.equal(liveMomentSavedMessage('quest',true),'Moment gespeichert und als offene Quest vorbereitet.');
  assert.equal(liveMomentSavedMessage('rumor',false,true),'Moment gespeichert und als Gerücht vorbereitet. Neuere Eingabe bleibt offen. Wissensbinder bei Bedarf aktualisieren.');
  assert.equal(liveMomentSavedMessage('deadline',true),'Moment gespeichert. Ortsfrist ist als Entwurf geöffnet.');
  assert.equal(liveMomentSavedMessage('visit',true,true),'Moment gespeichert und als nächster Besuch vorbereitet. Folgevorbereitung konnte nicht geöffnet werden.');
});

test('unconfirmed raw text is valid but malformed imported moment drafts cannot enter storage',()=>{
 const draft={...emptyLiveMomentDraft(),summary:'  Rohtext\r\n',followUp:'quest' as const};assert.deepEqual(checkedLiveMomentDraft(draft),draft);assert.equal(sameLiveMomentDraft(draft,{followUp:'quest',summary:draft.summary,title:'',category:'world'}),true);
 for(const value of [null,[],{...draft,title:'x'.repeat(1001)},{...draft,followUp:'publish'},Object.defineProperty({...draft},'summary',{get(){throw new Error('Getter must not run');}})])assert.throws(()=>checkedLiveMomentDraft(value as any),/Momententwurf/);
});
