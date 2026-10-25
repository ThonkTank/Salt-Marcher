import type {Result} from './contracts';
import type {GraphPreviewTarget,GraphCommand} from './graph-contracts';
import type {AtlasCommand} from './campaign-atlas-contracts';
import type {AtlasTravelCommand} from './atlas-travel-contracts';

export type AtlasWriteFamily='atlas'|'preview'|'travel';
/** Original receipt identity only. Activation authority is always passed separately. */
export interface AtlasWriteReference {
 version:1;family:AtlasWriteFamily;campaignId:string;commandId:string;fingerprint:string;
 target?:GraphPreviewTarget;
}
export interface AtlasWriteStatus {outcome:'applied'|'not-applied'|'unknown'}
export interface AtlasWriteRecoveryAPI {
 keepAtlasWriteReference(ref:AtlasWriteReference,token:string):Promise<Result<void>>;
 atlasWriteReferences(campaignId:string,token:string):Promise<Result<AtlasWriteReference[]>>;
 clearAtlasWriteReference(ref:AtlasWriteReference,token:string):Promise<Result<void>>;
 atlasWriteStatus(ref:AtlasWriteReference,token:string):Promise<Result<AtlasWriteStatus>>;
}
type FingerprintCommand={campaignId:string;action:unknown;target?:GraphPreviewTarget;terrainStroke?:AtlasCommand['terrainStroke']};
/** Shared by each writer and recovery. Preserve ordering and nested original tokens. */
export function atlasWriteFingerprintInput(family:AtlasWriteFamily,c:FingerprintCommand):string {
 return JSON.stringify(family==='preview'?{campaignId:c.campaignId,target:c.target,action:c.action}:
  family==='travel'?c.action:c.target?{target:c.target,action:c.action}:c.terrainStroke?{action:c.action,terrainStroke:c.terrainStroke}:c.action);
}
export function graphReceiptCommand(c:GraphCommand):AtlasCommand {
 if(c.action.kind==='select'||!c.target)throw Error('Graphauswahl besitzt keinen Schreibbeleg.');
 return{commandId:c.commandId,campaignId:c.campaignId,token:c.token,target:c.target,action:{kind:c.action.kind==='accept'?'graph-accept':'graph-preview',command:c}};
}
export function atlasReceiptFamily(c:AtlasCommand):AtlasWriteFamily{return c.target&&c.action.kind!=='graph-accept'?'preview':'atlas';}
const text=(v:unknown):v is string=>typeof v==='string'&&v.length>0&&v.length<=1000;
export function checkedAtlasWriteReference(value:unknown):AtlasWriteReference {
 const r=value as AtlasWriteReference;
 if(!r||typeof r!=='object'||Array.isArray(r)||Object.keys(r).some(k=>!['version','family','campaignId','commandId','fingerprint','target'].includes(k))||r.version!==1||!['atlas','preview','travel'].includes(r.family)||!text(r.campaignId)||!text(r.commandId)||typeof r.fingerprint!=='string'||!/^[a-f0-9]{64}$/.test(r.fingerprint))throw Error('Atlas-Klärungsreferenz ist beschädigt.');
 const t=r.target;
 if(r.family==='preview'&&!t||r.family==='travel'&&t)throw Error('Atlas-Klärungsziel fehlt oder widerspricht der Familie.');
 if(t&&(typeof t!=='object'||Object.keys(t).some(k=>!['kind','previewId','scopeId','revision'].includes(k))||t.kind!=='graph-preview'||typeof t.previewId!=='string'||!/^[a-zA-Z0-9-]{1,100}$/.test(t.previewId)||!text(t.scopeId)||!Number.isSafeInteger(t.revision)||t.revision<0))throw Error('Atlas-Klärungsziel ist beschädigt.');
 return{version:1,family:r.family,campaignId:r.campaignId,commandId:r.commandId,fingerprint:r.fingerprint,...(t?{target:{kind:t.kind,previewId:t.previewId,scopeId:t.scopeId,revision:t.revision}}:{})};
}
export function sameAtlasWriteReference(a:AtlasWriteReference,b:AtlasWriteReference):boolean{return JSON.stringify(checkedAtlasWriteReference(a))===JSON.stringify(checkedAtlasWriteReference(b));}
export type AtlasWriteInput={kind:'atlas';command:AtlasCommand}|{kind:'graph';command:GraphCommand}|{kind:'travel';command:AtlasTravelCommand};
