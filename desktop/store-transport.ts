/** Structured clone preserves typed arrays, but turns Node Buffers into Uint8Arrays.
 * Record only Buffer locations; never detach caller-owned memory or serialize functions. */
export interface StoreWire {
  value: unknown;
  buffers: (string | number)[][];
}
export function encodeStoreValue(value: unknown): StoreWire {
  const buffers: StoreWire['buffers'] = [],
    ancestors = new Set<object>();
  function scan(v: unknown, path: (string | number)[]) {
    if (typeof v === 'function' || typeof v === 'symbol')
      throw Error('Nicht transportierbarer Store-Auftrag.');
    if (!v || typeof v !== 'object') return;
    if (Buffer.isBuffer(v)) {
      buffers.push(path);
      return;
    }
    if (
      ArrayBuffer.isView(v) ||
      v instanceof ArrayBuffer ||
      v instanceof SharedArrayBuffer ||
      v instanceof Date
    )
      return;
    if (
      !Array.isArray(v) &&
      Object.getPrototypeOf(v) !== Object.prototype &&
      Object.getPrototypeOf(v) !== null
    )
      throw Error('Store-Objekte dürfen die Prozessgrenze nicht überschreiten.');
    if (ancestors.has(v)) throw Error('Zyklischer Store-Auftrag.');
    ancestors.add(v);
    for (const [k, child] of Object.entries(v))
      scan(child, [...path, Array.isArray(v) ? Number(k) : k]);
    ancestors.delete(v);
  }
  scan(value, []);
  return { value, buffers };
}
export function decodeStoreValue(wire: StoreWire): unknown {
  let value = wire.value;
  for (const path of wire.buffers) {
    let parent: any = { value };
    let key: string | number = 'value';
    for (const part of path) {
      if (part === '__proto__' || part === 'constructor' || part === 'prototype')
        throw Error('Ungültiger Binärpfad.');
      parent = parent[key];
      key = part;
    }
    const bytes = parent[key];
    if (!(bytes instanceof Uint8Array)) throw Error('Ungültige Store-Binärdaten.');
    parent[key] = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (!path.length) value = parent[key];
  }
  return value;
}
