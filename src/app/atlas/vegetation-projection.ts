import type { PlantAsset, VegetationInstance, VegetationView } from './vegetation';
import { deflateSync, inflateSync } from 'fflate';

/** Disposable transport only. Authored overrides stay verbatim in the tail;
 * generated doubles are lossless, including at distant world coordinates. */
export type VegetationProjection =
  | VegetationView
  | {
      mode: VegetationView['mode'];
      packed: { version: 1; ids: string[]; data: string };
      tail: VegetationInstance[];
    };
const assets: PlantAsset[] = ['oak', 'pine', 'rock', 'shrub', 'grass'];
const stride = 65,
  maximum = 72000; // Three generated objects per bounded candidate cell.
const fields = new Set(['id', 'asset', 'x', 'y', 'z', 'size', 'angle', 'normal']);
const decoded = new WeakMap<VegetationProjection, VegetationInstance[]>();
const invalid = () => Error('Bewuchsdarstellung beschädigt. Ansicht erneut laden.');
const numbers = (i: VegetationInstance) => [
  i.x,
  i.y,
  i.z,
  i.size,
  i.angle,
  i.normal.x,
  i.normal.y,
  i.normal.z,
];

export function compactVegetation(view: VegetationView): VegetationProjection {
  let count = 0;
  for (const i of view.instances) {
    if (
      !Object.keys(i).every((key) => fields.has(key)) ||
      Object.keys(i.normal).some((key) => !['x', 'y', 'z'].includes(key))
    )
      break;
    count++;
  }
  if (count < 32 || count > maximum) return view;
  const bytes = new Uint8Array(count * stride),
    data = new DataView(bytes.buffer),
    ids: string[] = [];
  for (let n = 0; n < count; n++) {
    const i = view.instances[n]!,
      asset = assets.indexOf(i.asset),
      values = numbers(i);
    if (asset < 0 || typeof i.id !== 'string' || !values.every(Number.isFinite)) throw invalid();
    ids.push(i.id);
    data.setUint8(n * stride, asset);
    values.forEach((v, j) => data.setFloat64(n * stride + 1 + j * 8, v, true));
  }
  const compressed = deflateSync(bytes, { level: 1 });
  let binary = '';
  for (let n = 0; n < compressed.length; n += 8192)
    binary += String.fromCharCode(...compressed.subarray(n, n + 8192));
  return {
    mode: view.mode,
    packed: { version: 1, ids, data: btoa(binary) },
    tail: view.instances.slice(count),
  };
}

/** All renderer/selection consumers share one decode per received projection.
 * Ordinary local previews keep their existing in-memory instance arrays. */
export function vegetationInstances(view: VegetationProjection | undefined): VegetationInstance[] {
  if (!view) return [];
  if ('instances' in view) return view.instances;
  const cached = decoded.get(view);
  if (cached) return cached;
  const p = view.packed,
    count = p.ids?.length;
  if (
    p.version !== 1 ||
    !Array.isArray(p.ids) ||
    !Number.isSafeInteger(count) ||
    count < 1 ||
    count > maximum ||
    p.ids.some((id) => typeof id !== 'string') ||
    !Array.isArray(view.tail) ||
    typeof p.data !== 'string' ||
    !p.data.length ||
    p.data.length > Math.ceil((count * stride + count + 1024) / 3) * 4 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(p.data)
  )
    throw invalid();
  let binary: string;
  try {
    binary = atob(p.data);
  } catch {
    throw invalid();
  }
  const compressed = new Uint8Array(binary.length);
  for (let n = 0; n < binary.length; n++) compressed[n] = binary.charCodeAt(n);
  // One spare byte detects an overlong stream without allocating its claimed
  // expansion. Short streams and malformed numeric rows fail closed as well.
  let bytes: Uint8Array;
  try {
    bytes = inflateSync(compressed, { out: new Uint8Array(count * stride + 1) });
  } catch {
    throw invalid();
  }
  if (bytes.length !== count * stride) throw invalid();
  const data = new DataView(bytes.buffer),
    instances: VegetationInstance[] = [];
  for (let n = 0; n < count; n++) {
    const asset = assets[data.getUint8(n * stride)],
      values = Array.from({ length: 8 }, (_, j) => data.getFloat64(n * stride + 1 + j * 8, true));
    if (!asset || !values.every(Number.isFinite)) throw invalid();
    const [x, y, z, size, angle, nx, ny, nz] = values as [
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
    ];
    instances.push({ id: p.ids[n]!, asset, x, y, z, size, angle, normal: { x: nx, y: ny, z: nz } });
  }
  instances.push(...view.tail);
  decoded.set(view, instances);
  return instances;
}
