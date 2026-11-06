/** The Atlas transaction completed; only the acknowledgement could not be built.
 * It must be resolved from its receipt rather than treated as a rejected write. */
export class AtlasCommitProjectionError extends Error {
  constructor(commandId: string, cause: unknown) {
    super(
      `Atlasauftrag ${commandId} gespeichert, Bestätigung nicht verfügbar. ${cause instanceof Error ? cause.message : String(cause)}`,
      { cause },
    );
    this.name = 'AtlasCommitProjectionError';
  }
}
