import assert from 'node:assert/strict';
import test from 'node:test';
import type {Room} from '../../src/app/contracts';
import type {KeyBlock} from '../../src/app/key-contracts';
import {unplacedBinderPublicText} from '../../src/app/atlas/dungeon-binder-model';

const room={sections:[{kind:'markdown',markdown:'Legacy-Beschreibung'}]} as Room;
const block=(id:string,kind:KeyBlock['kind'],visibility:KeyBlock['visibility'],text:string,revealedText=''):KeyBlock=>({id,kind,visibility,text,revealedText,templateId:null,suppressed:[],searchMethod:'',dc:null,discoveryNotes:''});

test('unplaced rooms retain legacy public prose and confirmed secret reveals',()=>{
 const blocks=[block('legacy','legacy','public',''),block('secret','text','secret','Geheim','Bestätigte Spur'),block('gm','text','gm','Nur SL')];
 assert.equal(unplacedBinderPublicText(room,blocks,new Set()),'Legacy-Beschreibung');
 assert.equal(unplacedBinderPublicText(room,blocks,new Set(['secret'])),'Legacy-Beschreibung\n\nBestätigte Spur');
});
