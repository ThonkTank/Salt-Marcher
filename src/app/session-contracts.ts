import type {BudgetRarity} from './dungeon-budget-contracts';
import type {Result} from './contracts';
import type {EncounterParty,EncounterPlan,EncounterAssessment} from './encounter-contracts';
import type {ItemInput,ProgressGuard} from './progression';
import type {GenerationRequest} from './generation-contracts';
import type {ManualPlan} from '../features/planner/manual-planner';
export interface SessionProfile {planId:string;revision:number;party:EncounterParty[];adventureDayFraction:string;seed:string}
export interface VisitDetail {visitId:string;revision:number;readAloud:string;noteIds:string[];groupIds:string[];reward:{id:string;poolXp:number;items:ItemInput[];placedTreasureId:string|null;awarded:boolean}|null}
export interface WorldActor {defeated?:boolean;disposition?:number;role?:import('./npc-contracts').NpcRole;id:string;name:string;creatureId:string;revision:number;hp:number;maxHp:number;tempHp:number;conditions:string;concentrating:boolean;unavailable:boolean;entryId:string}
export interface PreparedGroup {id:string;revision:number;title:string;notes:string;sourceEncounterId:string;sourceRevision:number;locationId:string|null;plan:EncounterPlan;actors:WorldActor[]}
export interface SessionView {replacementBasis?:string;profile:SessionProfile;visits:VisitDetail[];groups:PreparedGroup[];encounters:{id:string;revision:number;name:string}[]}
export interface ScenePreparation {groups:PreparedGroup[];treasures:{id:string;title:string}[];nextVisit:{planId:string;planRevision:number;visitId:string;title:string}|null}
export interface SessionProposal {rewardWarnings?:string[];rewardMissingMagic?:Record<BudgetRarity,number>;rejected?:boolean;revision?:number;needsEncounterRefresh?:boolean;reward?:{poolXp:number;items:ItemInput[]}|null;rewardEdited?:boolean;rewardOrigin?:{tableId:string;revision:number;seed:string}|null;id:string;index:number;title:string;notes:string;readAloud:string;locationId:string|null;noteIds:string[];encounter:EncounterPlan&{assessment:EncounterAssessment};acceptedVisitId:string|null}
export interface SessionMagicPoolItem {definitionId:string;revision:number;name:string;rarity:BudgetRarity}
export interface SessionMagicGuidance {pool?:SessionMagicPoolItem[];expectedBefore:Record<BudgetRarity,number>;expectedAfter:Record<BudgetRarity,number>;received:Record<BudgetRarity,number>;target:Record<BudgetRarity,number>;allocations:Record<BudgetRarity,number>[];missing:Record<BudgetRarity,number>;warnings:string[];characters:{characterId:string;received:Record<BudgetRarity,number>}[]}
export interface SessionLootBasis {ledger:{id:string;characterId:string;revision:number}[];definitions:{definitionId:string;revision:number}[]}
export interface SessionLootGuidance {basis?:SessionLootBasis;magic?:SessionMagicGuidance;version:'cumulative-gold-v1'|'cumulative-gold-magic-v2';preset:{id:string;revision:number;hash:string};rewardXp:number;expectedBeforeCopper:string;expectedAfterCopper:string;receivedCopper:string;baselineCopper:string;differenceCopper:string;targetCopper:string;allocationsCopper:string[];characters:{characterId:string;name:string;xp:number;revision:number;receivedCopper:string;expectedBeforeCopper:string;expectedAfterCopper:string}[]}
export interface SessionRun {lootGuidance?:SessionLootGuidance;worldSourcesByLocation?:boolean;id:string;planId:string;profileRevision:number;seed:string;dayBudget:number;budget:number;usedXp:number;generationRunId:string;proposals:SessionProposal[];warnings:string[]}
export type SessionAction=
 |{kind:'reject-proposal';planId:string;runId:string;index:number;expectedRevision:number;rejected:boolean}
 |{kind:'edit-proposal';planId:string;runId:string;index:number;expectedRevision:number;title:string;notes:string;readAloud:string;locationId:string|null;noteIds:string[];reward:SessionProposal['reward']}
 |{kind:'replace-plan';planId:string;expectedBasis:string;name:string;sourcePlanId:string|null;expectedSourceBasis:string|null;copyParty:boolean}
 |{kind:'profile';profile:SessionProfile;expectedRevision:number}
 |{kind:'visit';planId:string;detail:VisitDetail;expectedRevision:number}
 |{kind:'attach';planId:string;visitId:string;expectedVisitRevision:number;encounterId:string;expectedEncounterRevision:number}
 |{kind:'detach';planId:string;visitId:string;expectedVisitRevision:number;groupId:string}
 |{kind:'place';planId:string;groupId:string;expectedRevision:number;locationId:string;expectedLocationRevision:number}
 |{kind:'group-content';planId:string;groupId:string;expectedRevision:number;title:string;notes:string}
 |{kind:'place-reward';planId:string;visitId:string;expectedVisitRevision:number;locationId:string;expectedLocationRevision:number}
 |{kind:'award-reward';planId:string;visitId:string;expectedVisitRevision:number;recipients:ProgressGuard[];noXp:boolean}
 |{kind:'accept-proposal';planId:string;expectedPlanRevision:number;runId:string;index:number};
export interface SessionCommand {commandId:string;campaignId:string;token:string;action:SessionAction}
export interface SessionGenerationRequest {magicPool?:{definitionId:string;revision:number}[];compensateMagic?:boolean;compensateLoot?:boolean;worldSourcesByLocation?:boolean;planId:string;expectedProfileRevision:number;count:number;locationIds:string[];noteIds:string[];encounter:Omit<GenerationRequest,'party'|'seed'|'count'|'title'>}
export interface SessionAPI {preparedGroup(token:string,id:string):Promise<Result<PreparedGroup>>;
 session(token:string,planId:string):Promise<Result<SessionView>>;
 executeSession(command:SessionCommand):Promise<Result<SessionView>>;
 generateSession(token:string,request:SessionGenerationRequest):Promise<Result<SessionRun>>;
 regenerateSessionReward(token:string,runId:string,index:number,seed:string):Promise<Result<SessionRun>>;
 regenerateSessionProposal(token:string,runId:string,index:number,seed:string):Promise<Result<SessionRun>>;
 sessionRuns(token:string,planId:string):Promise<Result<{id:string;seed:string;count:number}[]>>;
 sessionRun(token:string,id:string):Promise<Result<SessionRun>>;
 scenePreparation(token:string,sceneId:string):Promise<Result<ScenePreparation>>;
}
export type PlanPublisher=(plan:ManualPlan,expectedRevision:number)=>void;
