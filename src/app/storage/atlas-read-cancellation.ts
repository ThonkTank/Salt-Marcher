/** Internal control flow: an obsolete camera read must never become a partial map. */
export class AtlasReadCancelled extends Error {
  constructor() { super('Kartenausschnitt durch neuere Anfrage ersetzt.'); }
}

export function atlasReadCheckpoint(signal?: Int32Array): () => void {
  return () => { if (signal && Atomics.load(signal, 0)) throw new AtlasReadCancelled(); };
}
