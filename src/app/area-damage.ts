import type {CombatState,Combatant} from './combat-contracts';
import {adjustedDamage,type DamageScale,type DamageType} from './damage-adjustment';

/** A save reduces the shared damage before the target's resistance/vulnerability. */
export function areaTargetDamage(combat:CombatState,target:Combatant,amount:number,save:'full'|'half'|'none',type:DamageType|undefined,defense:DamageScale){
 const afterSave=save==='none'?0:save==='half'?Math.floor(amount/2):amount;
 if(afterSave===0)return {amount:0,note:'Kein Schaden nach dem Rettungswurf',afterSave};
 const source=combat.sources?.find(s=>s.id===target.sourceId);
 return {...adjustedDamage(afterSave,defense,source,type),afterSave};
}
