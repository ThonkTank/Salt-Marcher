import type { Result } from './contracts';
import type { CreatureCatalogQuery } from '../features/catalog/creature-catalog';
import type { EncounterParty, EncounterPlan, EncounterAssessment } from './encounter-contracts';
import type { GeneratorPresetConfigV3 } from './generation/config';
import type { EncounterComposition } from './generation/selector';
import type { ItemCategory,ItemInput } from './progression';
export interface EncounterTable { id:string;revision:number;scope:'campaign'|'installation';name:string;description:string;entries:{creatureId:string;weight:string}[];habitats:string[];time:'any'|'day'|'night';lootTableId:string|null;trashed:boolean }
export interface LootTableEntry {id:string;weight:string;minimum:number;maximum:number;item:{name:string;valueGold:string;category:ItemCategory}}
export interface LootTable {id:string;revision:number;name:string;description:string;rolls:number;entries:LootTableEntry[];trashed:boolean}
export interface GeneratorPreset { id:string;revision:number;name:string;system:boolean;config:GeneratorPresetConfigV3;hash:string }
export const encounterTableFields={id:true,revision:true,scope:true,name:true,description:true,entries:true,habitats:true,time:true,lootTableId:true,trashed:true} satisfies Record<keyof EncounterTable,true>;
export const generatorPresetFields={id:true,revision:true,name:true,system:true,config:true,hash:true} satisfies Record<keyof GeneratorPreset,true>;
export interface GeneratorRegistry {revision:number;presets:GeneratorPreset[];assignedId:string|null;effectiveId:string}
export interface GenerationCommand {commandId:string;campaignId:string;token:string;action:{kind:'table-save';table:EncounterTable;expectedRevision:number|null}|{kind:'table-trash';id:string;expectedRevision:number;trashed:boolean}|{kind:'loot-save';table:LootTable;expectedRevision:number|null}|{kind:'loot-trash';id:string;expectedRevision:number;trashed:boolean}|{kind:'preset-save';preset:GeneratorPreset;expectedRegistryRevision:number}|{kind:'preset-assign'|'preset-delete';id:string|null;expectedRegistryRevision:number}}
export interface LootRollCommand {commandId:string;campaignId:string;token:string;tableId:string;expectedRevision:number;seed:string;title:string}
export interface LootRoll {tableId:string;tableRevision:number;seed:string;treasureId:string;items:ItemInput[]}
export interface GenerationRequest { seed:string;tableIds:string[];filters:CreatureCatalogQuery;habitat:string;time:'any'|'day'|'night';party:EncounterParty[];difficulty:'weighted'|'trivial'|'easy'|'medium'|'hard'|'deadly';amount:'neutral'|'few'|'standard'|'many';balance:'neutral'|'even'|'varied';diversity:'neutral'|'low'|'high';title:string;count:number;xpCeiling?:number|null;targetXp?:number }
export interface GenerationRun { id:string;revision:1;seed:string;request:GenerationRequest;preset:{id:string;name:string;revision:number;hash:string;mobThreshold:number};tables:{id:string;revision:number}[];catalogHash:string;plans:(EncounterPlan&{assessment:EncounterAssessment;composition:EncounterComposition})[];warnings:string[];candidates:{creatureId:string;weight:string}[];acceptedPlanIds:string[] }
export interface GenerationAPI {
 encounterTables(token:string,includeTrashed:boolean):Promise<Result<EncounterTable[]>>;
 lootTables(token:string,includeTrashed:boolean):Promise<Result<LootTable[]>>;
 generatorRegistry(token:string):Promise<Result<GeneratorRegistry>>;
 executeGeneration(command:GenerationCommand):Promise<Result<{tables:EncounterTable[];lootTables:LootTable[];registry:GeneratorRegistry}>>;
 generateEncounters(token:string,request:GenerationRequest):Promise<Result<GenerationRun>>;
 acceptGeneration(command:{commandId:string;campaignId:string;token:string;runId:string;index:number;expectedRegistryRevision:number}):Promise<Result<EncounterPlan>>;
 generationRuns(token:string):Promise<Result<{id:string;seed:string;title:string;count:number}[]>>;
 generationRun(token:string,id:string):Promise<Result<GenerationRun>>;
 rollLoot(command:LootRollCommand):Promise<Result<LootRoll>>;
}
export function exactWeight(value:string):string{
 if(typeof value!=='string'||!/^\d{1,18}([.,]\d{1,12})?$/.test(value.trim()))throw new Error('Gewicht benötigt eine nichtnegative exakte Dezimalzahl.');const[whole,part='']=value.trim().replace(',','.').split('.');const digits=part.replace(/0+$/,'');return BigInt(whole!).toString()+(digits?'.'+digits:'');
}
export function integerWeights(values:readonly string[]):bigint[]{const checked=values.map(exactWeight),scale=Math.max(0,...checked.map(v=>v.split('.')[1]?.length??0));return checked.map(v=>{const[whole,part='']=v.split('.');return BigInt(whole!)*10n**BigInt(scale)+BigInt(part.padEnd(scale,'0')||'0');});}
export function weightShares(values:readonly string[]):string[]{const weights=integerWeights(values),sum=weights.reduce((a,b)=>a+b,0n);if(!sum)return weights.map(()=>'0,00 %');const floors=weights.map(w=>Number(w*10000n/sum));let remaining=10000-floors.reduce((a,b)=>a+b,0);const order=weights.map((w,i)=>({i,remainder:w*10000n%sum})).sort((a,b)=>a.remainder===b.remainder?a.i-b.i:a.remainder>b.remainder?-1:1);for(const e of order){if(!remaining--)break;floors[e.i]=floors[e.i]!+1;}return floors.map(v=>Math.floor(v/100)+','+String(v%100).padStart(2,'0')+' %');}
