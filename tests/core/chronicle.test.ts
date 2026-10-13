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

function database(progressRows:any[],profiles:any[]=[]){
  return{
    transaction:(run:()=>unknown)=>run,
    prepare:(sql:string)=>({
      get:()=>sql.startsWith("SELECT name FROM campaign")?{name:"Testkampagne"}:undefined,
      all:()=>{
        if(sql.includes("character_profile"))return profiles;
        if(sql.includes("live_scene"))return[];
        if(sql.includes("FROM location"))return[];
        if(sql.includes("narrative_state"))return[];
        if(sql.includes("FROM combat"))return[];
        return[];
      },
      iterate:()=>{
        if(sql.includes("progress_event"))return sql.includes("LIMIT 2001")?progressRows.slice(0,2001):progressRows;
        if(sql.includes("world_history"))return[];
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
