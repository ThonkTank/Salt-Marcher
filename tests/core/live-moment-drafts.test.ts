import assert from 'node:assert/strict';
import test from 'node:test';
import {emptyLiveMomentDraft,LiveMomentDraftBook} from '../../src/app/live-moment-drafts';

test('live moment drafts remain with their scene across focus changes',()=>{
  const book=new LiveMomentDraftBook();
  assert.deepEqual(book.switchTo('scene-a',emptyLiveMomentDraft()),{changed:true,draft:emptyLiveMomentDraft()});
  const a={category:'narrative' as const,title:'Geheime Spur der Vorhut',summary:'Ada erkennt das Siegel.'};
  assert.deepEqual(book.switchTo('scene-b',a),{changed:true,draft:emptyLiveMomentDraft()});
  const b={category:'combat' as const,title:'Wachen alarmiert',summary:''};
  assert.deepEqual(book.switchTo('scene-a',b),{changed:true,draft:a});
  assert.deepEqual(book.switchTo('scene-b',a),{changed:true,draft:b});
});

test('saved and reset live moments cannot reappear in another context',()=>{
  const book=new LiveMomentDraftBook(),draft={category:'party' as const,title:'Versprechen',summary:''};
  book.switchTo('scene-a',emptyLiveMomentDraft());book.switchTo('scene-b',draft);book.switchTo('scene-a',emptyLiveMomentDraft());book.saved('scene-a');
  assert.deepEqual(book.switchTo('scene-b',emptyLiveMomentDraft()).draft,emptyLiveMomentDraft());
  book.reset();assert.equal(book.currentSceneId,null);assert.deepEqual(book.switchTo('scene-a',emptyLiveMomentDraft()).draft,emptyLiveMomentDraft());
});
