import {atlasWriteFingerprintInput,atlasReceiptFamily,graphReceiptCommand,checkedAtlasWriteReference,type AtlasWriteInput,type AtlasWriteReference,type AtlasWriteRecoveryAPI} from './atlas-write-receipt';
import type {GraphPreviewTarget} from './graph-contracts';

/** Call only when explicitly creating a new preview, never to replace a missing owner. */
export function newGraphPreviewTarget(scopeId:string):GraphPreviewTarget {
 return{kind:'graph-preview',previewId:crypto.randomUUID(),scopeId,revision:0};
}
export async function atlasWriteReference(input:AtlasWriteInput):Promise<AtlasWriteReference> {
 const c=input.kind==='graph'?graphReceiptCommand(input.command):input.command;
 const family=input.kind==='travel'?'travel':atlasReceiptFamily(c as import('./campaign-atlas-contracts').AtlasCommand);
 const identity={version:1 as const,family,campaignId:c.campaignId,commandId:c.commandId,...('target' in c&&c.target?{target:structuredClone(c.target)}:{})};
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(atlasWriteFingerprintInput(family,c)));
 const fingerprint=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
 return checkedAtlasWriteReference({...identity,fingerprint});
}
/** The owner keeps its pending command; no token rebinding, replay, or automatic clear.
 * Clone before the first await so persistence and dispatch describe identical bytes.
 * On any failure the owner remains blocked until an explicit read-only resolution. */
export async function dispatchRecoverableAtlasWrite<T,I extends AtlasWriteInput>(api:Pick<AtlasWriteRecoveryAPI,'keepAtlasWriteReference'>,input:I,dispatch:(command:I['command'])=>Promise<T>):Promise<T> {
 const captured=structuredClone(input),ref=await atlasWriteReference(captured);
 const saved=await api.keepAtlasWriteReference(ref,captured.command.token);
 if(!saved.ok)throw Error('Atlasauftrag nicht gesendet: '+saved.error);
 return dispatch(captured.command);
}
