// Only directory metadata. No compiled scripts or proprietary assets exported.
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export function packageInventory(catalog) {
  const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  const executableSha256 = hash(catalog.reference.executable), packageSha256 = hash(catalog.reference.package);
  if (executableSha256 !== catalog.reference.executableSha256 || packageSha256 !== catalog.reference.packageSha256)
    throw new Error('Reference files changed; catalog must be re-pinned before measurement');
  const bytes = fs.readFileSync(catalog.reference.package);
  if (bytes.length < 88 || bytes.readUInt32LE() !== 0x43504447 || bytes.readUInt32LE(4) !== 1)
    throw new Error('Unsupported PCK directory');
  const count = bytes.readUInt32LE(84); let at = 88;
  if (count > Math.floor((bytes.length - 88) / 37)) throw new Error('Invalid PCK count');
  const paths = new Set();
  for (let i = 0; i < count; i++) {
    if (at + 4 > bytes.length) throw new Error('Truncated PCK path');
    const length = bytes.readUInt32LE(at); at += 4;
    if (!length || at + length + 32 > bytes.length) throw new Error('Invalid PCK row');
    const name = new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(at, at + length)).replace(/\0+$/, ''); at += length;
    const offset = bytes.readBigUInt64LE(at), size = bytes.readBigUInt64LE(at + 8); at += 32;
    if (!name.startsWith('res://') || paths.has(name) || offset + size > BigInt(bytes.length)) throw new Error('Invalid PCK entry');
    paths.add(name);
  }
  const candidates = catalog.groups.flatMap(g => [...g.tools, ...g.ui].map(file => ({ path: file, group: g.id,
    exists: paths.has(file), evidenceKind: 'package_hint_only' })));
  return { role: 'package_hint_only', capturedAt: new Date().toISOString(), executableSha256, packageSha256,
    totalEntries: count, candidates, unmappedUiCandidates: [...paths].filter(p => /\/scripts\/(?:tools|ui)\/.*\.gdc$/.test(p) && !candidates.some(c => c.path === p)) };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [catalogFile, output] = process.argv.slice(2);
  if (!catalogFile || !output) throw new Error('Usage: inventory.mjs acceptance.json output.json');
  const result = packageInventory(JSON.parse(fs.readFileSync(catalogFile, 'utf8')).wonderdraftParity);
  fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ candidates: result.candidates.length, missing: result.candidates.filter(c => !c.exists).length,
    uniqueCandidates: new Set(result.candidates.map(c => c.path)).size,
    unmappedUiCandidates: result.unmappedUiCandidates.length, role: result.role }));
}
