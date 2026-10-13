import {createHash} from "node:crypto";
import assert from "node:assert/strict";
import test from "node:test";
import {readChronicle} from "../../src/app/storage/chronicle";

const envelope=(value:object)=>{
  const payload=JSON.stringify(value);
  return{payload,checksum:createHash("sha256").update(payload).digest("hex")};
};
const progress=(id:string,kind:string,recordedAt:string)=>({
  id,
  character_id:null,
  kind,
  ...envelope({recordedAt,before:{xp:0},after:{xp:1},reason:"Prüfung"}),
});

function database(progressRows:any[],profiles:any[]=[],worldRows:any[]=[],timeRows:any[]=[],scenes:any[]=[]){
  return{
    transaction:(run:()=>unknown)=>run,
    prepare:(sql:string)=>({
      get:()=>sql.startsWith("SELECT name FROM campaign")?{name:"Testkampagne"}:undefined,
      all:()=>{
        if(sql.includes("character_profile"))return profiles;
        if(sql.includes("live_scene"))return scenes;
        if(sql.includes("FROM location"))return[];
        if(sql.includes("narrative_state"))return[];
        if(sql.includes("FROM combat"))return[];
        return[];
      },
      iterate:()=>{
        if(sql.includes("progress_event"))return sql.includes("LIMIT 2001")?progressRows.slice(0,2001):progressRows;
        if(sql.includes("world_history"))return worldRows;
        if(sql.includes("scene_time_step"))return timeRows;
        return[];
      },
    }),
  };
}

test("chronicle skips non-display events without losing older relevant history",()=>{
  const ignored=Array.from({length:2001},(_,index)=>progress("ignored-"+index,"narrative-state",new Date(3000-index).toISOString()));
  const relevant=progress("older-xp","xp",new Date(1).toISOString());
  const result=readChronicle(database([...ignored,relevant]),"campaign-1");
  assert.deepEqual(result.entries.map(entry=>entry.id),["progress:older-xp"]);
  assert.equal(result.truncated,false);
});

test("chronicle bounds relevant history and reports that older entries were truncated",()=>{
  const rows=Array.from({length:2001},(_,index)=>progress("xp-"+index,"xp",new Date(5000-index).toISOString()));
  const result=readChronicle(database(rows),"campaign-1");
  assert.equal(result.entries.length,2000);
  assert.equal(result.truncated,true);
  assert.equal(result.entries[0]!.id,"progress:xp-0");
});

test("chronicle does not silently trust damaged context labels",()=>{
  const profile={id:"hero-1",payload:JSON.stringify({name:"Falscher Name"}),checksum:"broken"};
  assert.throws(()=>readChronicle(database([], [profile]),"campaign-1"),/beschädigt/);
});

test("chronicle connects party changes to people and groups",()=>{
  const hero={id:"hero-1",...envelope({name:"Ada"})};
  const event={id:"party-1",scene_id:"scene-2",...envelope({text:"Figur verschoben",recordedAt:"2026-10-14T10:00:00.000Z",facts:{kind:"party-move",characterIds:["hero-1"],fromSceneId:"scene-1",toSceneId:"scene-2",createdScene:true}})};
  const result=readChronicle(database([], [hero], [event], [], [{id:"scene-1",title:"Turm",location_id:null},{id:"scene-2",title:"Keller",location_id:null}]),"campaign-1");
  assert.deepEqual(result.entries[0],{id:"world:party-1",recordedAt:"2026-10-14T10:00:00.000Z",category:"party",title:"Figur verschoben",summary:"Turm → Keller · neue Gruppe",people:["Ada"],scene:"Keller",location:null});
});

test("chronicle shows confirmed time but does not duplicate travel steps",()=>{
  const direct={id:"time-1",scene_id:"scene-1",...envelope({recordedAt:"2026-10-14T11:00:00.000Z",amount:2,unit:"hours",reason:"Wache abgewartet"})};
  const travel={id:"time-2",scene_id:"scene-1",...envelope({recordedAt:"2026-10-14T12:00:00.000Z",amount:1,unit:"hours",reason:"Reise route-1 · A → B"})};
  const result=readChronicle(database([], [], [], [travel,direct], [{id:"scene-1",title:"Lager",location_id:null}]),"campaign-1");
  assert.deepEqual(result.entries.map(entry=>entry.id),["time:time-1"]);
  assert.equal(result.entries[0]!.summary,"+2 Stunden · Wache abgewartet");
});
