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
