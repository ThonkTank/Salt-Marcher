import assert from "node:assert/strict";
import test from "node:test";
import {parseHTML} from "linkedom";
import {activateRuleReferences,initRuleReferences,refreshRuleReferences} from "../../src/app/rule-reference-ui";

const tick=()=>new Promise<void>(resolve=>setTimeout(resolve,0));

test("a rapid second rule pin is ignored while the first host write is pending",async()=>{
  const parsed=parseHTML("<html><body><section id='scene-preparation-panel'></section></body></html>"),priorDocument=globalThis.document,priorWindow=globalThis.window;
  Object.assign(globalThis,{document:parsed.document,window:parsed.window});
  let calls=0,resolveWrite!:(value:unknown)=>void;
  const write=new Promise(resolve=>{resolveWrite=resolve;});
  (parsed.window as any).campaign={
    sceneRules:async()=>({ok:true,value:{sceneId:"scene",revision:0,pins:[]}}),
    preparation:async()=>({ok:true,value:{notes:[{trashed:false,note:{id:"rule",kind:"rule",title:"Festhalten",readAloud:"Bewegungsrate 0",gmNotes:"Vorteil",revision:1}}]}}),
    executeSceneRule:()=>{calls++;return write;},
  };
  try{
    initRuleReferences(()=>{});
    activateRuleReferences({campaign:{id:"campaign"},token:"token"} as any);
    await refreshRuleReferences("scene");
    const pin=parsed.document.querySelector<HTMLButtonElement>("#live-rule-results button")!;
    pin.click();pin.click();
    assert.equal(calls,1);
    assert.equal((parsed.document.querySelector("#live-rules-panel") as HTMLElement).inert,true);
    resolveWrite({ok:true,value:{sceneId:"scene",revision:1,pins:[{noteId:"rule",sourceRevision:1,title:"Festhalten",readAloud:"Bewegungsrate 0",gmNotes:"Vorteil",currentRevision:1,stale:false,unavailable:false}]}});
    await tick();await tick();
    assert.equal((parsed.document.querySelector("#live-rules-panel") as HTMLElement).inert,false);
    assert.match(parsed.document.querySelector("#live-rule-pins")!.textContent,/Festhalten/);
  }finally{
    Object.assign(globalThis,{document:priorDocument,window:priorWindow});
  }
});
