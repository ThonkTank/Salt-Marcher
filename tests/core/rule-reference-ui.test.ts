import assert from "node:assert/strict";
import test from "node:test";
import {describeSceneCheck} from "../../src/app/rule-reference-ui";

test("advantage and disadvantage results name the mode and the kept die",()=>{
 const check={label:"Athletik",rolls:[3,17],modifier:2,total:19,dc:12,outcome:"success"} as any;
 assert.equal(describeSceneCheck({...check,mode:"advantage"}),"Athletik: 3 / 17 · Vorteil wählt 17 + 2 = 19 · Erfolg gegen SG 12");
 assert.equal(describeSceneCheck({...check,mode:"disadvantage",total:5,outcome:"failure"}),"Athletik: 3 / 17 · Nachteil wählt 3 + 2 = 5 · Fehlschlag gegen SG 12");
});
test("formula results identify the actor and show the actual dice and modifier",()=>{
 assert.equal(describeSceneCheck({rollKind:"formula",actor:"Guard",label:"Spear",formula:"2d6 + 3",rolls:[2,5],modifier:3,total:10,dc:null,outcome:null} as any),"Guard · Spear: 2d6 + 3 → 2 + 5 + 3 = 10");
});
