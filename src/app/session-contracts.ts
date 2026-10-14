import type {Result} from './contracts';
import type {EncounterParty,EncounterPlan,EncounterAssessment} from './encounter-contracts';
import type {ItemInput,ProgressGuard} from './progression';
import type {GenerationRequest} from './generation-contracts';
import type {ManualPlan} from '../features/planner/manual-planner';
export interface SessionProfile {planId:string;revision:number;party:EncounterParty[];adventureDayFraction:string;seed:string}
export interface VisitDetail {visitId:string;revision:number;readAloud:string;noteIds:string[];groupIds:string[];reward:{id:string;poolXp:number;items:ItemInput[];placedTreasureId:string|null;awarded:boolean}|null}
export interface WorldActor {id:string;name:string;creatureId:string;revision:number;hp:number;maxHp:number;tempHp:number;conditions:string;concentrating:boolean;unavailable:boolean;entryId:string}
export interface PreparedGroup {id:string;revision:number;title:string;notes:string;sourceEncounterId:string;sourceRevision:number;locationId:string|null;plan:EncounterPlan;actors:WorldActor[]}
export interface SessionView {replacementBasis?:string;profile:SessionProfile;visits:VisitDetail[];groups:PreparedGroup[];encounters:{id:string;revision:number;name:string}[]}
export interface ScenePreparation {groups:PreparedGroup[];treasures:{id:string;title:string}[];nextVisit:{planId:string;planRevision:number;visitId:string;title:string}|null}
export interface SessionProposal {id:string;index:number;title:string;notes:string;readAloud:string;locationId:string|null;noteIds:string[];encounter:EncounterPlan&{assessment:EncounterAssessment};acceptedVisitId:string|null}
export interface SessionRun {id:string;planId:string;profileRevision:number;seed:string;dayBudget:number;budget:number;usedXp:number;generationRunId:string;proposals:SessionProposal[];warnings:string[]}
export type SessionAction=
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
export interface SessionGenerationRequest {planId:string;expectedProfileRevision:number;count:number;locationIds:string[];noteIds:string[];encounter:Omit<GenerationRequest,'party'|'seed'|'count'|'title'>}
export interface SessionAPI {preparedGroup(token:string,id:string):Promise<Result<PreparedGroup>>;
 session(token:string,planId:string):Promise<Result<SessionView>>;
 executeSession(command:SessionCommand):Promise<Result<SessionView>>;
 generateSession(token:string,request:SessionGenerationRequest):Promise<Result<SessionRun>>;
 regenerateSessionProposal(token:string,runId:string,index:number,seed:string):Promise<Result<SessionRun>>;
 sessionRuns(token:string,planId:string):Promise<Result<{id:string;seed:string;count:number}[]>>;
 sessionRun(token:string,id:string):Promise<Result<SessionRun>>;
 scenePreparation(token:string,sceneId:string):Promise<Result<ScenePreparation>>;
}
export type PlanPublisher=(plan:ManualPlan,expectedRevision:number)=>void;
