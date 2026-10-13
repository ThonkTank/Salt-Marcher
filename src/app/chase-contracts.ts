import type {Result} from './contracts';
export interface ChaseParticipant{id:string;name:string;side:'pursuer'|'quarry';distance:number;speed:number;exhaustion:number;notes:string}
export interface ChaseState{id:string;revision:number;sceneId:string;title:string;status:'running'|'finished';round:number;goal:string;complication:string;outcome:string;participants:ChaseParticipant[]}
export type ChaseAction={kind:'create';sceneId:string;title:string;goal:string}|{kind:'participant';participant:ChaseParticipant}|{kind:'remove';participantId:string}|{kind:'round';changes:{participantId:string;distance:number;exhaustion:number}[];complication:string}|{kind:'finish';outcome:string};
export interface ChaseCommand{commandId:string;campaignId:string;token:string;chaseId:string|null;expectedRevision:number|null;action:ChaseAction}
export interface ChaseView{chase:ChaseState|null;recent:{id:string;title:string;status:ChaseState['status']}[]}
export interface ChaseAPI{chase(token:string,sceneId:string,id?:string):Promise<Result<ChaseView>>;executeChase(command:ChaseCommand):Promise<Result<ChaseView>>}
