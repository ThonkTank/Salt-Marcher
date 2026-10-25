type AtlasIdentity = {campaignId:string; commandId:string};

/** The write returned successfully; only its follow-up view is unavailable.
 * Keep this distinct from validation/transaction failures all the way to Main. */
export class AtlasCommitProjectionError extends Error {
  constructor(readonly command:AtlasIdentity, cause:unknown) {
    super(`Atlasauftrag ${command.commandId} gespeichert, Folgeansicht nicht verfügbar. ${cause instanceof Error?cause.message:String(cause)}`, {cause});
    this.name='AtlasCommitProjectionError';
  }
}

/** Call only after the outermost write transaction has completed. */
export function projectCommittedAtlas<T>(command:AtlasIdentity, read:()=>T):T {
  try{return read();}
  catch(error){throw new AtlasCommitProjectionError({campaignId:command.campaignId,commandId:command.commandId},error);}
}
