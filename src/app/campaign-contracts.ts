import type {Campaign,Result} from './contracts';
export interface CampaignOverview extends Campaign {trashed:boolean;rooms:number;locations:number;characters:number;maps:number;audio:number;trashRevision:number}
export type SharedKind='item'|'preset'|'table'|'audio'|'mood';
export type ConflictChoice='keep-current'|'keep-imported'|'keep-both';
export interface DefinitionConflict {key:string;kind:SharedKind;id:string;name:string;incoming:string;existing:string;affectedCampaigns:number}
export interface CampaignTransferPreview {ticket:string;name:string;campaignId:string;applicationVersion:string;schema:number;counts:{table:string;records:number}[];audioFiles:number;bytes:number;conflicts:DefinitionConflict[];problems:string[];copy:boolean}
export interface CampaignTransferProgress {phase:string;records:number;bytes:number;busy:boolean}
export type CampaignTransferStatus={state:'pending'|'not-applied'}|{state:'applied';campaign:Campaign};
export interface CampaignManagementAPI {
 campaignOverview():Promise<Result<CampaignOverview[]>>;
 trashCampaign(command:{commandId:string;id:string;expectedRevision:number;trashed:boolean}):Promise<Result<void>>;
 eraseCampaign(command:{commandId:string;id:string;expectedRevision:number;confirmName:string}):Promise<Result<void>>;
 exportCampaign(token:string):Promise<Result<{cancelled:boolean}>>;
 prepareCampaignImport():Promise<Result<CampaignTransferPreview|null>>;
 prepareCampaignCopy(token:string):Promise<Result<CampaignTransferPreview>>;
 acceptCampaignTransfer(ticket:string,name:string,choices:Record<string,ConflictChoice>):Promise<Result<Campaign>>;
 campaignTransferStatus(ticket:string):Promise<Result<CampaignTransferStatus>>;
 cancelCampaignTransfer(ticket?:string):Promise<Result<void>>;
 onCampaignTransfer(callback:(progress:CampaignTransferProgress)=>void):void;
}
