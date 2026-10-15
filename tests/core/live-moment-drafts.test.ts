import assert from 'node:assert/strict';
import test from 'node:test';
import {canClearSavedLiveMoment,emptyLiveMomentDraft,liveMomentSavedMessage,LiveMomentDraftBook} from '../../src/app/live-moment-drafts';

test('live moment drafts remain with their scene across focus changes',()=>{
  const book=new LiveMomentDraftBook();
  assert.deepEqual(book.switchTo('scene-a',emptyLiveMomentDraft()),{changed:true,draft:emptyLiveMomentDraft()});
  const a={category:'narrative' as const,title:'Geheime Spur der Vorhut',summary:'Ada erkennt das Siegel.',followUp:'quest' as const};
  assert.deepEqual(book.switchTo('scene-b',a),{changed:true,draft:emptyLiveMomentDraft()});
  const b={category:'combat' as const,title:'Wachen alarmiert',summary:'',followUp:'' as const};
  assert.deepEqual(book.switchTo('scene-a',b),{changed:true,draft:a});
  assert.deepEqual(book.switchTo('scene-b',a),{changed:true,draft:b});
});

test('saved and reset live moments cannot reappear in another context',()=>{
  const book=new LiveMomentDraftBook(),draft={category:'party' as const,title:'Versprechen',summary:'',followUp:'rumor' as const};
  book.switchTo('scene-a',emptyLiveMomentDraft());book.switchTo('scene-b',draft);book.switchTo('scene-a',emptyLiveMomentDraft());book.saved('scene-a');
  assert.deepEqual(book.switchTo('scene-b',emptyLiveMomentDraft()).draft,emptyLiveMomentDraft());
  book.reset();assert.equal(book.currentSceneId,null);assert.deepEqual(book.switchTo('scene-a',emptyLiveMomentDraft()).draft,emptyLiveMomentDraft());
});

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
