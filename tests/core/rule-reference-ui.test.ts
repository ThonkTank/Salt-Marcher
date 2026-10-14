import assert from "node:assert/strict";
import test from "node:test";
import {parseHTML} from "linkedom";
import {activateRuleReferences,describeSceneCheck,initRuleReferences,refreshRuleReferences} from "../../src/app/rule-reference-ui";

const tick=()=>new Promise<void>(resolve=>setTimeout(resolve,0));

test("advantage and disadvantage results name the mode and the kept die",()=>{
  const check={label:"Athletik",rolls:[3,17],modifier:2,total:19,dc:12,outcome:"success"} as any;
  assert.equal(describeSceneCheck({...check,mode:"advantage"}),"Athletik: 3 / 17 · Vorteil wählt 17 + 2 = 19 · Erfolg gegen SG 12");
  assert.equal(describeSceneCheck({...check,mode:"disadvantage",total:5,outcome:"failure"}),"Athletik: 3 / 17 · Nachteil wählt 3 + 2 = 5 · Fehlschlag gegen SG 12");
});

test("a rapid second rule pin is ignored while the first host write is pending",async()=>{
  const parsed=parseHTML("<html><body><section id='scene-preparation-panel'></section></body></html>"),priorDocument=globalThis.document,priorWindow=globalThis.window,priorOption=globalThis.Option;
  function TestOption(text:string,value:string){const option=parsed.document.createElement("option");option.textContent=text;option.setAttribute("value",value);return option;}
  Object.assign(globalThis,{document:parsed.document,window:parsed.window,Option:TestOption});
  let calls=0,resolveWrite!:(value:unknown)=>void;
  const write=new Promise(resolve=>{resolveWrite=resolve;});
  (parsed.window as any).campaign={
    sceneRules:async()=>({ok:true,value:{sceneId:"scene",revision:0,pins:[]}}),
    sceneChecks:async()=>({ok:true,value:{sceneId:"scene",revision:0,checks:[],truncated:false}}),
    preparation:async()=>({ok:true,value:{notes:[{trashed:false,note:{id:"rule",kind:"rule",title:"Festhalten",readAloud:"Bewegungsrate 0",gmNotes:"Vorteil",revision:1}}]}}),
    executeSceneRule:()=>{calls++;return write;},
  };
  try{
    const messages:string[]=[];
    initRuleReferences(message=>{messages.push(message);});
    const ruleSelect=parsed.document.querySelector("#live-check-rule") as HTMLSelectElement;let selectedRule="";
    Object.defineProperty(ruleSelect,"value",{configurable:true,get:()=>selectedRule,set:(value:string)=>{selectedRule=value;}});
    activateRuleReferences({campaign:{id:"campaign"},token:"token"} as any);
    await refreshRuleReferences("scene");
    const pin=parsed.document.querySelector<HTMLButtonElement>("#live-rule-results button");
    assert.ok(pin,messages.join(" | "));
    pin.click();pin.click();
    assert.equal(calls,1);
    assert.equal((parsed.document.querySelector("#live-rules-panel") as HTMLElement).inert,true);
    resolveWrite({ok:true,value:{sceneId:"scene",revision:1,pins:[{noteId:"rule",sourceRevision:1,title:"Festhalten",readAloud:"Bewegungsrate 0",gmNotes:"Vorteil",currentRevision:1,stale:false,unavailable:false}]}});
    await tick();await tick();
    assert.equal((parsed.document.querySelector("#live-rules-panel") as HTMLElement).inert,false);
    assert.match(parsed.document.querySelector("#live-rule-pins")!.textContent,/Festhalten/);
  }finally{
    Object.assign(globalThis,{document:priorDocument,window:priorWindow,Option:priorOption});
  }
});
