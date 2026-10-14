import type {Result} from './contracts';
export const extensionRights=['ownedUnits.read','ownedUnits.write'] as const;
export type ExtensionRight=typeof extensionRights[number];
export interface ExtensionManifest {id:string;name:string;version:string;hostApi:1;unitCodec:'way-note:1';rights:ExtensionRight[]}
export interface ExtensionPackage {format:'Kampagnenwerkstatt Extension';version:1;manifest:ExtensionManifest;renderer:{html:string;script:string;styles:string}}
export interface ExtensionInfo {id:string;revision:number;generation:string;manifest:ExtensionManifest;hash:string;state:'installed'|'removed';grants:ExtensionRight[]}
export interface ExtensionPreview {ticket:string;hash:string;bytes:number;manifest:ExtensionManifest;expectedRevision:number|null}
export type ExtensionAction={kind:'install';ticket:string;hash:string;expectedRevision:number|null;rights:ExtensionRight[]}|{kind:'revoke'|'remove';id:string;expectedRevision:number};
export interface ExtensionCommand {commandId:string;action:ExtensionAction}
export interface ExtensionPage {items:ExtensionInfo[];problems:{id:string;message:string}[];next:string|null}
export interface ExtensionAPI {extensionPreview():Promise<Result<ExtensionPreview|null>>;extensions(after:string|null):Promise<Result<ExtensionPage>>;executeExtension(command:ExtensionCommand):Promise<Result<ExtensionInfo>>;extensionOutcome(command:ExtensionCommand):Promise<Result<ExtensionInfo|null>>}

/** Shared boundary for persisted recovery intent and host commands; never grants authority itself. */
export function checkedExtensionCommand(value:unknown):ExtensionCommand {
 const object=(v:any,keys:string[])=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
 const c=value as any;
 if(!object(c,['commandId','action'])||typeof c.commandId!=='string'||!c.commandId||c.commandId.length>128)throw new Error('Gespeicherter Installationsauftrag ungültig.');
 const a=c.action;
 if(a?.kind==='install'){
  if(!object(a,['kind','ticket','hash','expectedRevision','rights'])||typeof a.ticket!=='string'||!a.ticket||a.ticket.length>128||typeof a.hash!=='string'||!/^[a-f0-9]{64}$/.test(a.hash)||(a.expectedRevision!==null&&(!Number.isSafeInteger(a.expectedRevision)||a.expectedRevision<1))||!Array.isArray(a.rights)||a.rights.length>extensionRights.length||new Set(a.rights).size!==a.rights.length||a.rights.some((r:any)=>!extensionRights.includes(r)))throw new Error('Installationsauftrag für Paketannahme ungültig.');
 }else if(a?.kind==='revoke'||a?.kind==='remove'){
  if(!object(a,['kind','id','expectedRevision'])||typeof a.id!=='string'||!/^[a-z][a-z0-9.-]{0,99}$/.test(a.id)||!Number.isSafeInteger(a.expectedRevision)||a.expectedRevision<1)throw new Error('Installationsauftrag für Widerruf/Entfernen ungültig.');
 }else throw new Error('Installationsaktion unbekannt.');
 return c;
}
