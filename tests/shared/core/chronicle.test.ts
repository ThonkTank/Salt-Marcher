import {createHash,randomUUID} from "node:crypto";
import assert from "node:assert/strict";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import test from "node:test";
import {readChronicle} from "../../../src/app/storage/chronicle";
import {CampaignStore} from "../../../src/app/storage/store";
import {newLocation} from "../../../src/features/location/location-schema";

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
      get:(...params:any[])=>sql.startsWith("SELECT name FROM campaign")?{name:"Testkampagne"}:sql.includes("FROM character_profile")?profiles.find(profile=>profile.id===params[1]):undefined,
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

test("chronicle skips unsupported progress events without losing older relevant history",()=>{
  const ignored=Array.from({length:2001},(_,index)=>progress("ignored-"+index,"internal-only",new Date(3000-index).toISOString()));
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
  assert.throws(()=>readChronicle(database([{...progress("damaged-context","xp","2026-10-14T10:00:00.000Z"),character_id:profile.id}], [profile]),"campaign-1"),/beschädigt/);
});

test("chronicle connects party changes to people and groups",()=>{
  const hero={id:"hero-1",...envelope({name:"Ada"})};
  const event={id:"party-1",cursor:1,scene_id:"scene-2",...envelope({text:"Figur verschoben",recordedAt:"2026-10-14T10:00:00.000Z",facts:{kind:"party-move",characterIds:["hero-1"],fromSceneId:"scene-1",toSceneId:"scene-2",createdScene:true}})};
  const result=readChronicle(database([], [hero], [event], [], [{id:"scene-1",title:"Turm",location_id:null},{id:"scene-2",title:"Keller",location_id:null}]),"campaign-1");
  assert.deepEqual(result.entries[0],{id:"world:party-1",sourceOrder:1,recordedAt:"2026-10-14T10:00:00.000Z",category:"party",title:"Figur verschoben",summary:"Turm → Keller · neue Gruppe",people:["Ada"],scene:"Keller",location:null});
});

test("chronicle shows confirmed time but does not duplicate travel steps",()=>{
  const direct={id:"time-1",scene_id:"scene-1",...envelope({recordedAt:"2026-10-14T11:00:00.000Z",amount:2,unit:"hours",reason:"Wache abgewartet"})};
  const travel={id:"time-2",scene_id:"scene-1",...envelope({recordedAt:"2026-10-14T12:00:00.000Z",amount:1,unit:"hours",reason:"Reise route-1 · A → B"})};
  const result=readChronicle(database([], [], [], [travel,direct], [{id:"scene-1",title:"Lager",location_id:null}]),"campaign-1");
  assert.deepEqual(result.entries.map(entry=>entry.id),["time:time-1"]);
  assert.equal(result.entries[0]!.summary,"+2 Stunden · Wache abgewartet");
});

test("chronicle retains a live moment with its scene, party and location",()=>{
  const hero={id:"hero-1",...envelope({name:"Ada"})};
  const location={id:"place-1",...envelope({name:"Alte Mühle"})};
  const event={id:"moment-1",cursor:1,scene_id:"scene-1",...envelope({text:"Der Müller kennt den Kult",recordedAt:"2026-10-14T13:00:00.000Z",facts:{kind:"live-moment",category:"narrative",summary:"Ada verspricht, nachts wiederzukommen.",characterIds:["hero-1"],locationId:"place-1",instantMs:"3600000"}})};
  const db=database([], [hero], [event], [], [{id:"scene-1",title:"Ermittler",location_id:null}]);
  const original=db.prepare;db.prepare=(sql:string)=>sql.includes("FROM location")?({get:(...params:any[])=>params[1]===location.id?location:undefined,all:()=>[location],iterate:()=>[]}):original(sql);
  const result=readChronicle(db,"campaign-1");
  assert.deepEqual(result.entries[0],{id:"world:moment-1",sourceOrder:1,recordedAt:"2026-10-14T13:00:00.000Z",category:"narrative",title:"Der Müller kennt den Kult",summary:"Ada verspricht, nachts wiederzukommen.",people:["Ada"],scene:"Ermittler",location:"Alte Mühle"});
});

test("live play records a confirmed moment directly in the campaign chronicle",()=>{
  const root=mkdtempSync(join(tmpdir(),"live-moment-")),store=new CampaignStore(join(root,"campaign.sqlite"),"test");
  try{
    const campaign=store.create("Abendrunde"),token=store.activate(campaign.id).token;
    const locationId=randomUUID();store.changePreparation({commandId:"location",campaignId:campaign.id,token,change:{kind:"location",expectedRevision:null,document:newLocation(locationId,"Alte Mühle","poi",[randomUUID(),randomUUID()])}});
    const hero=store.executeLive({commandId:"hero",campaignId:campaign.id,token,action:{kind:"create-character",profile:{name:"Ada"}}}).character!;
    const scene=store.executeLive({commandId:"scene",campaignId:campaign.id,token,action:{kind:"initialize",expectedRosterRevision:1}}).scene!;
    store.executeLive({commandId:"active",campaignId:campaign.id,token,action:{kind:"membership",characterId:hero.id,expectedRevision:0,expectedRosterRevision:1,active:true,targetSceneId:scene.id,expectedFocusRevision:0}});
    store.executeLive({commandId:"location-scene",campaignId:campaign.id,token,action:{kind:"scene-content",sceneId:scene.id,expectedRevision:0,title:scene.title,notes:scene.notes,readAloud:scene.readAloud,locationId}});
    const followUpId=randomUUID();
    store.executeLive({commandId:"moment",campaignId:campaign.id,token,action:{kind:"live-moment",sceneId:scene.id,expectedRevision:1,category:"narrative",title:"Der Müller kennt den Kult",summary:"Ada kommt nachts zurück.",followUp:{kind:"quest",id:followUpId}}});
    const entry=store.chronicle(token).entries.find(item=>item.title==="Der Müller kennt den Kult");
    assert.deepEqual(entry&&{category:entry.category,summary:entry.summary,people:entry.people,followUp:entry.followUp},{category:"narrative",summary:"Ada kommt nachts zurück.",people:["Ada"],followUp:{kind:"quest",id:followUpId}});
    const quest=store.preparation(token).notes.find(row=>row.note.id===followUpId)?.note;
    assert.deepEqual(quest&&{kind:quest.kind,title:quest.title,gmNotes:quest.gmNotes},{kind:"quest",title:"Der Müller kennt den Kult",gmNotes:"Ada kommt nachts zurück."});
    assert.deepEqual(store.narrative(token,followUpId).state,{noteId:followUpId,revision:1,status:"open",locationId,contributors:[hero.id],poolXp:0,items:[],awardId:null});
  }finally{store.close();rmSync(root,{recursive:true,force:true});}
});

test("live play brackets a session recap with persistent markers",()=>{
  const root=mkdtempSync(join(tmpdir(),"live-session-marker-")),store=new CampaignStore(join(root,"campaign.sqlite"),"test");
  try{
    const campaign=store.create("Abendrunde"),token=store.activate(campaign.id).token;
    const scene=store.executeLive({commandId:"scene",campaignId:campaign.id,token,action:{kind:"initialize",expectedRosterRevision:0}}).scene!;
    store.executeLive({commandId:"start",campaignId:campaign.id,token,action:{kind:"session-marker",sceneId:scene.id,expectedRevision:scene.revision,marker:"start",summary:""}});
    assert.throws(()=>store.executeLive({commandId:"second-start",campaignId:campaign.id,token,action:{kind:"session-marker",sceneId:scene.id,expectedRevision:scene.revision,marker:"start",summary:""}}),/läuft bereits/);
    store.executeLive({commandId:"end",campaignId:campaign.id,token,action:{kind:"session-marker",sceneId:scene.id,expectedRevision:scene.revision,marker:"end",summary:"Die Gruppe öffnete das Basalttor.",handoff:"Weiter im Keller. Fackeln vorbereiten."}});
    assert.throws(()=>store.executeLive({commandId:"second-end",campaignId:campaign.id,token,action:{kind:"session-marker",sceneId:scene.id,expectedRevision:scene.revision,marker:"end",summary:""}}),/Kein laufender/);
    const markers=store.chronicle(token).entries.filter(entry=>entry.sessionMarker);
    assert.deepEqual(markers.map(entry=>({marker:entry.sessionMarker,title:entry.title,summary:entry.summary,handoff:entry.handoff??""})),[
      {marker:"end",title:"Spielabend beendet",summary:"Die Gruppe öffnete das Basalttor.",handoff:"Weiter im Keller. Fackeln vorbereiten."},
      {marker:"start",title:"Spielabend begonnen",summary:"",handoff:""},
    ]);
    assert.equal(store.chronicle(token,"all","Fackeln").entries[0]?.sessionMarker,"end");
  }finally{store.close();rmSync(root,{recursive:true,force:true});}
});
