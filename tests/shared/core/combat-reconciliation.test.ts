import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import test from 'node:test';
import {removePartyFromMasks} from '../../../src/app/storage/mask-health';
import {checkedCombat} from '../../../src/app/runtime/combat-contracts';

const envelope=(value:object)=>{const payload=JSON.stringify(value);return{payload,checksum:createHash('sha256').update(payload).digest('hex')};};

test('party movement detaches combat health, advances the turn and closes stale undo',()=>{
  const hero={id:'hero-turn',characterId:'hero-1',groupId:'hero-turn',name:'Ada',initiative:10,initiativeBonus:0,armorClass:14,hp:3,maxHp:10,tempHp:2,conditions:'vergiftet',concentrating:false};
  const foe={id:'foe-turn',characterId:null,groupId:'foe-turn',name:'Wache',initiative:20,initiativeBonus:0,armorClass:12,hp:8,maxHp:8,tempHp:0,conditions:'',concentrating:false};
  const state={id:'combat-1',sceneId:'scene-1',revision:4,title:'Torwache',phase:'running',round:2,turnId:hero.id,participants:[hero,foe],notes:'',outcome:''},combat={campaign_id:'campaign-1',id:state.id,scene_id:state.sceneId,revision:state.revision,phase:state.phase,...envelope(state)};
  const progress={characterId:'hero-1',revision:3,xp:null,rest:{known:true,longXp:0,shortXp:0,baseline:0,sections:0},health:{hp:10,maxHp:10,tempHp:0,conditions:'',concentrating:false}},progressRow={revision:progress.revision,...envelope(progress)};
  let updated:any[]=[],undo=false,proof:any[]=[];
  const db={prepare:(sql:string)=>({
    all:()=>sql.includes("FROM combat WHERE")?[combat]:[],
    get:()=>sql.includes('character_progress')?progressRow:undefined,
    run:(...values:any[])=>{if(sql.startsWith('UPDATE combat SET'))updated=values;else if(sql.startsWith('DELETE FROM combat_undo'))undo=true;else if(sql.startsWith('INSERT INTO mask_reconciliation'))proof=values;},
  })};
  removePartyFromMasks(db,'campaign-1',['hero-1'],'move-1');
  const after=JSON.parse(updated[2]),receipt=JSON.parse(proof[5]);assert.equal(after.revision,5);assert.equal(after.turnId,'foe-turn');assert.equal(after.round,3);assert.deepEqual(after.participants.map((p:any)=>p.id),['foe-turn']);assert.equal(undo,true);assert.deepEqual(receipt.removedCharacterIds,['hero-1']);assert.equal(receipt.beforeRevision,4);assert.equal(receipt.afterRevision,5);
});

test('combat validation rejects duplicate character references before reconciliation',()=>{
  const actor={id:'one',characterId:'hero-1',groupId:'one',name:'Ada',initiative:1,initiativeBonus:0,armorClass:10,hp:1,maxHp:1,tempHp:0,conditions:'',concentrating:false};
  assert.throws(()=>checkedCombat({id:'combat-1',sceneId:'scene-1',revision:1,title:'Doppelt',phase:'preparing',round:0,turnId:null,participants:[actor,{...actor,id:'two',groupId:'two'}],notes:'',outcome:''}),/mehrfach/);
});

test('retiring a scene archives its combat without completion or rewards',()=>{
  const foe={id:'foe-turn',characterId:null,groupId:'foe-turn',name:'Wache',initiative:10,initiativeBonus:0,armorClass:12,hp:8,maxHp:8,tempHp:0,conditions:'',concentrating:false};
  const state={id:'combat-1',sceneId:'scene-1',revision:4,title:'Torwache',phase:'running',round:2,turnId:foe.id,participants:[foe],notes:'offen',outcome:''},combat={campaign_id:'campaign-1',id:state.id,scene_id:state.sceneId,revision:state.revision,phase:state.phase,...envelope(state)};let updated:any[]=[],proof:any[]=[];
  const db={prepare:(sql:string)=>({all:()=>sql.includes('FROM combat WHERE')?[combat]:[],run:(...values:any[])=>{if(sql.startsWith('UPDATE combat SET'))updated=values;else if(sql.startsWith('INSERT INTO mask_reconciliation'))proof=values;}})};
  removePartyFromMasks(db,'campaign-1',[],'move-1',new Set(['scene-1']));
  const after=JSON.parse(updated[2]),receipt=JSON.parse(proof[5]);assert.equal(after.phase,'retired');assert.equal(after.outcome,'');assert.equal(after.rewards,undefined);assert.equal(after.round,2);assert.equal(receipt.retired,true);assert.deepEqual(receipt.removedCharacterIds,[]);
});
