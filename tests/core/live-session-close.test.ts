import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {parseHTML} from 'linkedom';
import type {ChronicleEntry} from '../../src/app/chronicle-contracts';
import {handoffVisitSeed,latestCompletedSessionHandoff,leaveSessionCloseReview,sessionCloseHandoffSuggestion,sessionStartControls,settleOptionalSessionSource,settleSessionCloseSources} from '../../src/app/live-session-close';

function fixture(){
  const {document}=parseHTML('<dialog open></dialog><textarea id="draft"></textarea><textarea id="review"></textarea>');
  const dialog=document.querySelector('dialog') as HTMLDialogElement;
  dialog.close=()=>dialog.removeAttribute('open');
  const draft=document.querySelector('#draft') as HTMLTextAreaElement,review=document.querySelector('#review') as HTMLTextAreaElement;
  draft.value='Alter Entwurf';review.value='Weiter am Nordtor.';
  return{dialog,draft,review};
}

test('continuing from the close review retains its note for a return to the review',()=>{
  const x=fixture();leaveSessionCloseReview(x.dialog,x.draft,x.review,'continue');
  assert.equal(x.draft.value,'Weiter am Nordtor.');assert.equal(x.dialog.hasAttribute('open'),false);
});

test('cancelling the close review leaves the previous draft unchanged',()=>{
  const x=fixture();leaveSessionCloseReview(x.dialog,x.draft,x.review,'discard');
  assert.equal(x.draft.value,'Alter Entwurf');assert.equal(x.dialog.hasAttribute('open'),false);
});

test('the next-session handoff starts with the current scene and unresolved work',()=>{
  assert.equal(sessionCloseHandoffSuggestion({sceneTitle:'Nordtor',locationTitle:'Klippenhafen',masks:[{kind:'combat',title:'Wachen am Tor',sceneTitle:'Nordtor'},{kind:'chase',title:'Flucht über die Dächer',sceneTitle:'Späher'}],treasureCount:2,xpBooked:false}),[
    'Nächster Einstieg: Nordtor · Klippenhafen','- Kampf fortsetzen: Wachen am Tor','- Verfolgung fortsetzen: Flucht über die Dächer (Späher)','- Unverteilte Beute prüfen: 2 Schatzpositionen','- Spielabend-XP abrechnen',
  ].join('\n'));
});

const marker=(id:string,sessionMarker:'start'|'end',handoff?:string):ChronicleEntry=>({id,recordedAt:'2026-10-14T12:00:00.000Z',category:'world',title:id,summary:'',people:[],scene:null,location:null,sessionMarker,...(handoff===undefined?{}:{handoff})});

test('an empty latest session handoff does not revive older completed work',()=>{
  assert.equal(latestCompletedSessionHandoff([marker('new','end'),marker('event','start'),marker('old','end','Alte Aufgabe')]),'');
});

test('the latest completed session handoff remains visible during the next session',()=>{
  assert.equal(latestCompletedSessionHandoff([marker('current','start'),marker('latest','end','Am Nordtor fortsetzen'),marker('old','end','Alte Aufgabe')]),'Am Nordtor fortsetzen');
});

test('a completed handoff becomes a concise authored visit without losing its open work',()=>{
  assert.deepEqual(handoffVisitSeed('Nächster Einstieg: Nordtor · Klippenhafen\n- Frist: Die Flut kommt\n- Kampf fortsetzen: Torwachen','Späher'),{title:'Nordtor · Klippenhafen',notes:'Übergabe vom letzten Spielabend\n\nNächster Einstieg: Nordtor · Klippenhafen\n- Frist: Die Flut kommt\n- Kampf fortsetzen: Torwachen'});
  assert.equal(handoffVisitSeed('','Späher').title,'Nächster Spielabend: Späher');
});

test('returning sessions enter through the preparation dashboard without a duplicate start action',()=>{
  assert.deepEqual(sessionStartControls({open:false,marker:null}),{start:true,resume:false});
  assert.deepEqual(sessionStartControls({open:false,marker:marker('latest','end')}),{start:false,resume:true});
  assert.deepEqual(sessionStartControls({open:true,marker:marker('current','start')}),{start:false,resume:false});
});

test('session workflows override the narrow default dialog cap',()=>{
  const css=readFileSync('src/app/app.css','utf8');
  assert.match(css,/#live-session-close-dialog\{[^}]*max-width:56rem/);
  assert.match(css,/#live-session-resume-dialog\{[^}]*max-width:68rem/);
  assert.match(css,/#handoff-visit-dialog\{[^}]*max-width:42rem/);
});

test('optional handoff sources cannot block a verified session close',async()=>{
  const reviewed=Promise.resolve({masks:2}),unavailable=Promise.reject(new Error('Journal nicht lesbar'));
  const result=await settleSessionCloseSources(reviewed,unavailable);
  assert.deepEqual(result.audit,{masks:2});assert.equal(result.preparation,null);assert.match(String(result.preparationError),/Journal nicht lesbar/);
  await assert.rejects(()=>settleSessionCloseSources(Promise.reject(new Error('Abschlussprüfung nicht lesbar')),Promise.resolve({})),/Abschlussprüfung nicht lesbar/);
});

test('unavailable readiness cannot block the next-session dashboard',async()=>{
  assert.deepEqual(await settleOptionalSessionSource(Promise.resolve({ok:false,error:'Fortschritt nicht lesbar'})),{value:null,error:'Fortschritt nicht lesbar'});
  assert.deepEqual(await settleOptionalSessionSource(Promise.reject(new Error('Verbindung abgebrochen'))),{value:null,error:'Verbindung abgebrochen'});
  assert.deepEqual(await settleOptionalSessionSource(Promise.resolve({ok:true,value:{characters:2}})),{value:{characters:2},error:null});
});
