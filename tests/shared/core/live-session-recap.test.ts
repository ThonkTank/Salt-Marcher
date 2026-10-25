import assert from 'node:assert/strict';
import test from 'node:test';
import type {ChronicleEntry} from '../../../src/app/runtime/chronicle-contracts';
import {liveSessionRecap} from '../../../src/app/runtime/live-session-recap';

const entry=(id:string,sessionMarker?:'start'|'end'):ChronicleEntry=>({id,recordedAt:'2026-10-14T12:00:00.000Z',category:'world',title:id,summary:'',people:[],scene:null,location:null,...(sessionMarker?{sessionMarker}:{})});

test('live session recap contains only events after the active start marker',()=>{
  assert.deepEqual(liveSessionRecap([entry('new'),entry('start','start'),entry('old')]),{open:true,marker:entry('start','start'),entries:[entry('new')]});
});

test('live session recap retains the most recently completed session',()=>{
  assert.deepEqual(liveSessionRecap([entry('end','end'),entry('event'),entry('start','start'),entry('older')]),{open:false,marker:entry('end','end'),entries:[entry('event')]});
});

test('the latest boundary preserves session status outside the visible history window',()=>{
 const events=[entry('newest'),entry('older')],start=entry('outside','start');assert.deepEqual(liveSessionRecap(events,start),{open:true,marker:start,entries:events});const end=entry('finished','end');assert.deepEqual(liveSessionRecap(events,end),{open:false,marker:end,entries:[]});
});

import {sessionCloseHandoffSuggestion} from '../../../src/app/runtime/live-session-recap';

test('the next-session handoff starts with the current scene and unresolved work',()=>{
  assert.equal(sessionCloseHandoffSuggestion({sceneTitle:'Nordtor',locationTitle:'Klippenhafen',masks:[{kind:'combat',title:'Wachen am Tor',sceneTitle:'Nordtor'},{kind:'chase',title:'Flucht über die Dächer',sceneTitle:'Späher'}],treasureCount:2,xpBooked:false}),[
    'Nächster Einstieg: Nordtor · Klippenhafen','- Kampf fortsetzen: Wachen am Tor','- Verfolgung fortsetzen: Flucht über die Dächer (Späher)','- Unverteilte Beute prüfen: 2 Schatzpositionen','- Spielabend-XP prüfen',
  ].join('\n'));
});

import {handoffVisitSeed} from '../../../src/app/runtime/live-session-recap';
test('a completed handoff becomes a concise authored visit without losing its open work',()=>{
  assert.deepEqual(handoffVisitSeed('Nächster Einstieg: Nordtor · Klippenhafen\n- Frist: Die Flut kommt\n- Kampf fortsetzen: Torwachen','Späher'),{title:'Nordtor · Klippenhafen',notes:'Nächster Einstieg: Nordtor · Klippenhafen\n- Frist: Die Flut kommt\n- Kampf fortsetzen: Torwachen'});
  assert.equal(handoffVisitSeed('','Späher').title,'Nächster Spielabend: Späher');
});
