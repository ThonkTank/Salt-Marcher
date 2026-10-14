import {createHash} from 'node:crypto';
import {budgetRarities,budgetRarity,type BudgetRarity} from '../dungeon-budget-contracts';
import type {SessionLootGuidance,SessionMagicGuidance} from '../session-contracts';
import type {ItemInput} from '../progression';
import type {RewardGuidanceRules} from '../generation/reward-guidance';
import {cumulativeMagicGuidance} from '../generation/reward-guidance';
import {readItemDefinition} from './item-definitions';
import type {ItemDefinition} from '../items-contracts';
export const emptyMagic=()=>Object.fromEntries(budgetRarities.map(r=>[r,0])) as Record<BudgetRarity,number>;
export function magicRules(rules:RewardGuidanceRules){if(rules.progression.some(p=>!p.magicPerXp||budgetRarities.some(r=>!Number.isFinite(p.magicPerXp[r])||p.magicPerXp[r]<0)))throw new Error('Das Preset benötigt vollständige nichtnegative Magiequoten. Magischen Ausgleich ausschalten oder Preset korrigieren.');}
export function magicGuidance(characters:SessionLootGuidance['characters'],received:Map<string,Record<BudgetRarity,number>>,rewardXp:number,count:number,rules:RewardGuidanceRules):SessionMagicGuidance{
 const before=cumulativeMagicGuidance(characters.map(c=>c.xp),rules),after=cumulativeMagicGuidance(characters.map(c=>c.xp+rewardXp),rules),actual=emptyMagic(),target=emptyMagic();
 for(const c of characters)for(const r of budgetRarities)actual[r]+=received.get(c.characterId)![r];
 for(const r of budgetRarities)target[r]=Math.max(0,after.quota[r]-actual[r]);
 return{expectedBefore:before.expected,expectedAfter:after.expected,received:actual,target,allocations:Array.from({length:count},(_,i)=>Object.fromEntries(budgetRarities.map(r=>[r,Math.floor(target[r]/count)+(i<target[r]%count?1:0)])) as Record<BudgetRarity,number>),missing:emptyMagic(),warnings:[],characters:characters.map(c=>({characterId:c.characterId,received:{...received.get(c.characterId)!}}))};
}
export function rewardIsMagic(db:any,item:ItemInput){return item.reference?readItemDefinition(db,item.reference.definitionId,item.reference.revision).magic:item.category==='magic';}
/** Retain useful table rolls, then fill rarity quotas from existing, revisioned catalog definitions. */
export function fitMagicItems(db:any,items:ItemInput[],target:Record<BudgetRarity,number>,seed:string){
 const remaining={...target},result:ItemInput[]=[],warnings:string[]=[];
 for(const item of items){if(!item.reference){warnings.push('Magische Tabellenbeute ohne Katalogreferenz wurde durch die Seltenheitsauswahl ersetzt: '+item.name);continue;}const d=readItemDefinition(db,item.reference.definitionId,item.reference.revision),r=budgetRarity(d.rarity);if(!r||!d.magic){warnings.push('Magische Tabellenbeute hat keine bekannte Seltenheit: '+item.name);continue;}const quantity=Math.min(item.quantity,remaining[r]);if(quantity){result.push({...structuredClone(item),quantity});remaining[r]-=quantity;}}
 const pool=new Map<BudgetRarity,{definition:ItemDefinition;rank:string}>();let blocked=0;
 if(budgetRarities.some(r=>remaining[r]>0))for(const row of db.prepare('SELECT id FROM authored_item UNION SELECT id FROM item_definition').iterate()){
  try{const d=readItemDefinition(db,row.id),r=budgetRarity(d.rarity);if(d.trashed||!d.magic||!r||remaining[r]===0)continue;const rank=createHash('sha256').update(seed+'|magic|'+r+'|'+d.id).digest('hex'),old=pool.get(r);if(!old||rank<old.rank)pool.set(r,{definition:d,rank});}catch(error){blocked++;if(blocked<=20)warnings.push('Kataloggegenstand '+row.id+' gesperrt: '+(error as Error).message);}
 }
 if(blocked>20)warnings.push((blocked-20)+' weitere gesperrte Kataloggegenstände wurden ausgelassen.');
 for(const r of budgetRarities){const quantity=remaining[r],choice=pool.get(r);
if(!quantity)continue;if(!choice){warnings.push(r+': '+quantity+' magische Gegenstände offen; im Katalog fehlt eine passende Definition.');continue;}if(quantity>1000000)throw new Error('Magiebeute zu groß. Kleineren Spielabend planen.');const d=choice.definition;result.push({name:d.name,category:d.category,quantity,valueGold:d.unitCopper===null?'0':String(BigInt(d.unitCopper)/100n)+'.'+String(BigInt(d.unitCopper)%100n).padStart(2,'0'),reference:{kind:'authored',definitionId:d.id,revision:d.revision}});remaining[r]=0;}
 return{items:result,missing:remaining,warnings:[...new Set(warnings)]};
}
