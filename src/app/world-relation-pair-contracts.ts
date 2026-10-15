import type {Result} from './contracts';

export interface WorldRelationPairAction {
  kind:'add'|'remove';
  sourceId:string;
  targetId:string;
  sourceRevision:number;
  targetRevision:number;
  forwardLabel:string;
  reverseLabel:string;
}
export interface WorldRelationPairCommand {commandId:string;campaignId:string;token:string;draftWriteId?:string;action:WorldRelationPairAction}
export interface WorldRelationPairAck {sourceRevision:number;targetRevision:number}
export interface WorldRelationPairDraft {version:1;writeId:string;command:WorldRelationPairCommand}
export interface WorldRelationPairAPI {
  executeWorldRelationPair(command:WorldRelationPairCommand):Promise<Result<WorldRelationPairAck>>;
  reconcileWorldRelationPair(command:WorldRelationPairCommand,token:string):Promise<Result<{outcome:'applied'|'not-applied'|'conflict';targetChanged:boolean}>>;
  worldRelationPairDraft(token:string,sourceId:string):Promise<Result<WorldRelationPairDraft|null>>;
  keepWorldRelationPairDraft(token:string,draft:WorldRelationPairDraft,expected:string|null):Promise<Result<void>>;
  discardWorldRelationPairDraft(token:string,sourceId:string,writeId:string):Promise<Result<void>>;
}
