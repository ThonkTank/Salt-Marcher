import assert from 'node:assert/strict';
import test from 'node:test';
import {findLiveKnowledge} from '../../../src/app/runtime/live-knowledge';

test('live knowledge search ranks titles before capped note-body matches',()=>{
 const notes=Array.from({length:40},(_,index)=>({id:'mention-'+index,note:{title:'Eintrag '+String(index).padStart(2,'0'),readAloud:'',gmNotes:'Die Hafenwache kennt diesen Vorgang.'}}));notes.push({id:'target',note:{title:'Spezielle Hafenwache',readAloud:'Am Kai.',gmNotes:''}});
 const found=findLiveKnowledge(notes,'hafenwache',30,row=>row.id==='mention-39');assert.equal(found.total,41);assert.equal(found.rows.length,30);assert.equal(found.rows[0]!.id,'target');assert.equal(found.rows[1]!.id,'mention-39');assert.ok(found.rows.slice(2).every(row=>row.id.startsWith('mention-')));
 const exact=findLiveKnowledge(notes,'spezielle hafenwache');assert.deepEqual(exact.rows.map(row=>row.id),['target']);assert.equal(exact.total,1);
});
