import {heightPatch} from './terrain-interpolation';
import {RouteSurface} from './terrain-route';
import {
  bounds,
  contains,
  segmentDistance,
  type LandscapeRecord,
  type LandscapeBox,
} from "./atlas-landscape";
import type { Point, Polygon } from "./contracts";
import {validateTerrainStyle,type TerrainStyle} from "./terrain-relief";
import { validateStroke, strokeBox, type MaskStroke } from "./land-mask";

/** Metres, independent of hexes and camera. NaN nodes inherit the coarser field. */
export interface HeightTile {
  version: 1 | 2;
  x: number;
  y: number;
  pixel: number;
  data: string;
}
export interface TerrainSettings {
  version: 1;
  seaLevelM: number;
  style?: TerrainStyle;
}
export const HEIGHT_EDGE = 64,
  DEFAULT_HEIGHT_M = -100;
export const TERRAIN_SETTINGS_ID = "terrain-settings";
const cache = new WeakMap<HeightTile, Float32Array>();
/** Node readers decode directly into bytes. The renderer retains the browser
 * path; no Node import or capability is added to its bundle. Buffer is lenient,
 * so an exact roundtrip proves the alphabet/padding; atob validates all others. */
function heightBytes(data: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    const bytes = Buffer.from(data, "base64");
    if (bytes.length === 16384 && bytes.toString("base64") === data) return bytes;
  }
  const raw = atob(data);
  if (raw.length !== 16384) throw Error("Höhenkachel prüfen.");
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}
export function encodeHeights(values: Float32Array): string {
  const bytes = new Uint8Array(values.length * 4),
    view = new DataView(bytes.buffer);
  for (let i = 0; i < values.length; i++)
    view.setFloat32(i * 4, values[i]!, true);
  return btoa(String.fromCharCode(...bytes));
}
export function decodeHeights(t: HeightTile): Float32Array {
  const old = cache.get(t);
  if (old) return old;
  if (
    (t.version !== 1 && t.version !== 2) ||
    ![t.x, t.y, t.pixel].every(Number.isFinite) ||
    t.pixel < 2 ** -24 ||
    t.pixel > 2 ** 24 ||
    !Number.isInteger(Math.log2(t.pixel)) ||
    !Number.isSafeInteger(t.x / (64 * t.pixel)) ||
    !Number.isSafeInteger(t.y / (64 * t.pixel)) ||
    Math.max(Math.abs(t.x), Math.abs(t.y)) > 1e12 ||
    typeof t.data !== "string" ||
    t.data.length !== 21848
  )
    throw Error("Höhenkachel prüfen.");
  const bytes = heightBytes(t.data);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    values = new Float32Array(4096);
  for (let i = 0; i < 4096; i++) {
    const v = view.getFloat32(i * 4, true);
    if (!Number.isNaN(v) && (!Number.isFinite(v) || Math.abs(v) > 1e6))
      throw Error("Höhenwert prüfen.");
    values[i] = v;
  }
  cache.set(t, values);
  return values;
}
export function terrainSettings(records: LandscapeRecord[]): TerrainSettings {
  return (
    records.find((r) => r.terrainSettings)?.terrainSettings ?? {
      version: 1,
      seaLevelM: 0,
    }
  );
}
export function settingsRecord(seaLevelM: number): LandscapeRecord {
  return {
    id: TERRAIN_SETTINGS_ID,
    revision: 0,
    kind: "patch",
    name: "Meeresspiegel",
    points: [],
    polygons: rectangle(0, 0, 1, 1),
    width: 0,
    resolution: 1,
    values: {},
    terrainSettings: { version: 1, seaLevelM },
  };
}
const rectangle = (x: number, y: number, w: number, h: number): Polygon[] => [
  {
    outer: [
      { x, y },
      { x: x + w, y },
      { x: x + w, y: y + h },
      { x, y: y + h },
    ],
    holes: [],
  },
];
export function heightRecord(
  x: number,
  y: number,
  pixel: number,
  values: Float32Array,
  version: 1 | 2 = 1,
): LandscapeRecord {
  return {
    id: `${version===2?"height-delta":"height"}:${Math.log2(pixel)}:${x / (pixel * 64)}:${y / (pixel * 64)}`,
    revision: 0,
    kind: "patch",
    name: "Geländehöhe",
    points: [],
    polygons: rectangle(x - pixel, y - pixel, 65 * pixel, 65 * pixel),
    width: 0,
    resolution: pixel,
    values: {},
    height: { version, x, y, pixel, data: encodeHeights(values) },
  };
}
export function validateTerrain(r: LandscapeRecord) {
  if (r.terrainSettings) {
    if(r.terrainSettings.style)validateTerrainStyle(r.terrainSettings.style);
    if (
      r.terrainSettings.version !== 1 ||
      !Number.isFinite(r.terrainSettings.seaLevelM) ||
      Math.abs(r.terrainSettings.seaLevelM) > 100000 ||
      r.height ||
      r.mask ||
      r.paint ||
      r.surface ||
      r.propertyOnly ||
      Object.keys(r.values).length ||
      r.kind !== "patch"
    )
      throw Error("Meeresspiegel prüfen.");
  }
  if (r.height) {
    decodeHeights(r.height);
    const t = r.height,
      b = bounds({...r,height:undefined});
    if (
      r.kind !== "patch" ||
      r.resolution !== t.pixel ||
      r.mask ||
      r.paint ||
      r.surface ||
      r.propertyOnly ||
      Object.keys(r.values).length ||
      b.x !== t.x - t.pixel ||
      b.y !== t.y - t.pixel ||
      b.width !== 65 * t.pixel ||
      b.height !== 65 * t.pixel
    )
      throw Error("Höhenkachelbereich prüfen.");
  }
  if (
    r.surface === "freshwater" &&
    r.waterLevelM !== undefined &&
    (!Number.isFinite(r.waterLevelM) || Math.abs(r.waterLevelM) > 1e6)
  )
    throw Error("Wasserstand prüfen.");
}
export interface HeightSample {
  heightM: number;
  resolutionM: number | null;
  revision: number;
}
/** Legacy absolute levels compose coarse-to-fine; version 2 adds independent scale bands afterwards. */
type SampleTile = { values: Float32Array; revision: number };
type HeightGrid = Map<number, Map<number, SampleTile>>;
export class TerrainSampler {
  readonly seaLevelM: number;
  private levels: { pixel: number; tiles: HeightGrid; additive: boolean; cell?: {gx:number;gy:number;values:Float64Array;revisions:number[];revision:number} }[] = [];
  private lakes: LandscapeRecord[];
  private routes:RouteSurface;
  private directHeight=false;
  constructor(records: LandscapeRecord[],effective=true) {
    this.routes=new RouteSurface(effective?records:[]);
    this.directHeight=!effective||!records.some(r=>r.route?.nodes.length&&!r.route.conflict);
    this.seaLevelM = terrainSettings(records).seaLevelM;
    const levels = new Map<string, {pixel:number; tiles:HeightGrid; additive:boolean}>();
    for (const r of records)
      if (r.height) {
        const t = r.height;
        const key=t.version+":"+t.pixel;
        let level=levels.get(key);
        if(!level)levels.set(key,level={pixel:t.pixel,tiles:new Map(),additive:t.version===2});
        const tiles=level.tiles;
        const tx = t.x / (64 * t.pixel),
          ty = t.y / (64 * t.pixel);
        let column = tiles.get(tx);
        if (!column) tiles.set(tx, (column = new Map()));
        if (column.has(ty)) throw Error("Doppelte Höhenkachel.");
        column.set(ty, { values: decodeHeights(t), revision: r.revision });
      }
    this.levels = [...levels.values()].sort((a,b)=>Number(a.additive)-Number(b.additive)||b.pixel-a.pixel);
    this.lakes = records.filter((r) => r.surface === "freshwater");
  }
  sample(p: Point): HeightSample {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y))
      throw Error("Höhenpunkt prüfen.");
    let heightM=DEFAULT_HEIGHT_M,additiveM=0,resolutionM:number|null=null,revision=0;
    for(const level of this.levels){
      const {pixel,tiles,additive}=level,xx=p.x/pixel,yy=p.y/pixel,gx=Math.floor(xx),gy=Math.floor(yy),fx=xx-gx,fy=yy-gy;
      // Reuse the full neighbourhood while successive samples share a cell.
      let cell=level.cell;
      if(!cell||cell.gx!==gx||cell.gy!==gy){
        const values=new Float64Array(16),revisions:number[]=[];let revision=0;
        for(let y=0;y<4;y++)for(let x=0;x<4;x++){
          const nx=gx+x-1,ny=gy+y-1,tx=Math.floor(nx/64),ty=Math.floor(ny/64),tile=tiles.get(tx)?.get(ty);
          const value=tile?.values[(ny-ty*64)*64+nx-tx*64]??NaN;
          values[y*4+x]=value;revisions.push(tile?.revision??0);if(!Number.isNaN(value))revision=Math.max(revision,tile?.revision??0);
        }
        level.cell=cell={gx,gy,values,revisions,revision};
      }
      const value=heightPatch(cell.values,fx,fy,additive?0:heightM);
      if(additive)additiveM+=value;else heightM=value;
      for(let y=0;y<2;y++)for(let x=0;x<2;x++)if((x?fx:1-fx)*(y?fy:1-fy)&&!Number.isNaN(cell.values[(y+1)*4+x+1]!)){
        resolutionM=Math.min(resolutionM??Infinity,pixel);
        revision=Math.max(revision,fx||fy?cell.revision:cell.revisions[5]!);
      }
    }
    heightM+=additiveM;
    return { heightM:this.directHeight?heightM:this.routes.at(p,heightM).height, resolutionM, revision };
  }
  waterLevel(p:Point,z=this.sample(p).heightM):number|undefined {
    const route=this.directHeight?undefined:this.routes.at(p,z).water;
    let level:number|undefined=z<=this.seaLevelM?this.seaLevelM:undefined;
    for(const r of this.lakes)if(contains(p,r.polygons)&&z<=(r.waterLevelM??this.seaLevelM+1))level=Math.max(level??-Infinity,r.waterLevelM??this.seaLevelM+1);
    return route===undefined?level:Math.max(level??-Infinity,route);
  }
  water(p: Point, height = this.sample(p).heightM): boolean {
    return (
      !this.directHeight&&this.routes.at(p,height).water!==undefined || height <= this.seaLevelM ||
      this.lakes.some(
        (r) =>
          height <= (r.waterLevelM ?? this.seaLevelM + 1) &&
          contains(p, r.polygons),
      )
    );
  }
  query(p: Point) {
    const value = this.sample(p),
      step = value.resolutionM ?? 1,
      dx =
        (this.sample({ x: p.x + step, y: p.y }).heightM -
          this.sample({ x: p.x - step, y: p.y }).heightM) /
        (2 * step),
      dy =
        (this.sample({ x: p.x, y: p.y + step }).heightM -
          this.sample({ x: p.x, y: p.y - step }).heightM) /
        (2 * step),
      length = Math.hypot(dx, dy, 1);
    return {
      ...value,
      seaLevelM: this.seaLevelM,
      water: this.water(p, value.heightM),
      slopeDegrees: (Math.atan(Math.hypot(dx, dy)) * 180) / Math.PI,
      normal: { x: -dx / length, y: -dy / length, z: 1 / length },
    };
  }
}
export function editHeight(
  records: LandscapeRecord[],
  box: LandscapeBox,
  pixel: number,
  edit: (p: Point, old: number) => number | undefined,
  version: 1 | 2 = 1,
): LandscapeRecord[] {
  const edge = 64 * pixel,
    x0 = Math.floor(box.x / edge),
    x1 = Math.floor((box.x + box.width) / edge),
    y0 = Math.floor(box.y / edge),
    y1 = Math.floor((box.y + box.height) / edge);
  if (
    (x1 - x0 + 1) * (y1 - y0 + 1) > 256 ||
    Math.max(
      Math.abs(box.x),
      Math.abs(box.y),
      Math.abs(box.x + box.width),
      Math.abs(box.y + box.height),
    ) > 1e12
  )
    throw Error("Höhenbereich zu groß. In kürzeren Zügen bearbeiten.");
  const sampler = version===1?new TerrainSampler(records,false):undefined,
    result: LandscapeRecord[] = [];
  for (let ty = y0; ty <= y1; ty++)
    for (let tx = x0; tx <= x1; tx++) {
      const x = tx * edge,
        y = ty * edge,
        old = records.find(
          (r) =>
            r.height?.x === x && r.height.y === y && r.height.pixel === pixel && r.height.version === version,
        ),
        values = old
          ? decodeHeights(old.height!).slice()
          : new Float32Array(4096).fill(NaN);
      let changed = false;
      for (let iy = 0; iy < 64; iy++)
        for (let ix = 0; ix < 64; ix++) {
          const p = { x: x + ix * pixel, y: y + iy * pixel };
          if (
            p.x < box.x ||
            p.y < box.y ||
            p.x > box.x + box.width ||
            p.y > box.y + box.height
          )
            continue;
          const index = iy * 64 + ix,
            prior = values[index]!,
            before = Number.isNaN(prior) ? sampler?.sample(p).heightM??0 : prior,
            value = edit(p, before);
          if (value === undefined || value === before) continue;
          values[index] = Math.max(-1e6, Math.min(1e6, value));
          changed = true;
        }
      if (changed)
        result.push({
          ...heightRecord(x, y, pixel, values, version),
          ...(old?{id:old.id}:{}),
          revision: old?.revision ?? 0,
        });
    }
  return result;
}
/** Existing land tools author metres; no writable occupancy mask is produced. */
export function applyHeightStroke(
  records: LandscapeRecord[],
  s: MaskStroke,
): LandscapeRecord[] {
  validateStroke(s);
  const pixel = Math.max(2 ** -24, 2 ** Math.floor(Math.log2(s.radius / 32))),
    sea = terrainSettings(records).seaLevelM;
  const box = strokeBox(s),
    edge = 64 * pixel;
  let work = s.samples.length;
  if (s.mode === "raise" || s.mode === "lower")
    for (let i = 1; i < s.samples.length; i++) {
      const a = s.samples[i - 1]!,
        b = s.samples[i]!;
      work += Math.max(
        1,
        Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (s.radius / 4)),
        Math.ceil(((b.t - a.t) / 1000) * 30),
      );
    }
  const tiles =
    (Math.floor((box.x + box.width) / edge) - Math.floor(box.x / edge) + 1) *
    (Math.floor((box.y + box.height) / edge) - Math.floor(box.y / edge) + 1);
  if (work * tiles * 4096 > 60000000)
    throw Error("Höhenzug zu lang. In kürzeren Zügen bearbeiten.");
  return editHeight(records, box, pixel, (p, old) => {
    let d = Infinity;
    for (let i = 0; i < s.samples.length; i++)
      d = Math.min(
        d,
        segmentDistance(p, s.samples[Math.max(0, i - 1)]!, s.samples[i]!),
      );
    if (d >= s.radius) return undefined;
    if (s.mode === "land") return Math.max(old, sea + 100);
    if (s.mode === "land-erase") return Math.min(old, sea - 100);
    // Integrate along segments. Fixed spatial/time subdivisions make fast strokes continuous.
    let amount = 0;
    for (let i = 1; i < s.samples.length; i++) {
      const a = s.samples[i - 1]!,
        b = s.samples[i]!,
        dt = (b.t - a.t) / 1000,
        steps = Math.max(
          1,
          Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (s.radius / 4)),
          Math.ceil(dt * 30),
        );
      for (let n = 0; n < steps; n++) {
        const t = (n + 0.5) / steps,
          r2 =
            ((p.x - a.x - (b.x - a.x) * t) ** 2 +
              (p.y - a.y - (b.y - a.y) * t) ** 2) /
            s.radius ** 2;
        if (r2 < 1) amount += (dt / steps) * (1 - r2) ** 2;
      }
    }
    const texture =
      1 -
      s.roughness *
        0.15 *
        (0.5 +
          0.5 *
            Math.sin((p.x / s.radius) * 19 + s.seed) *
            Math.cos((p.y / s.radius) * 23 + s.seed));
    return amount
      ? old + (s.mode === "raise" ? 1 : -1) * 300 * amount * texture
      : undefined;
  });
}
export function applyHeightArea(
  records: LandscapeRecord[],
  r: LandscapeRecord,
  reset = false,
) {
  const b = bounds(r),
    pixel = Math.max(
      1 / 64,
      2 ** Math.floor(Math.log2(Math.max(b.width, b.height, 1) / 64)),
    ),
    sea = terrainSettings(records).seaLevelM;
  const target = reset
    ? DEFAULT_HEIGHT_M
    : (r.values.elevationM ??
      (r.values.terrain === "water" ? sea - 100 : sea + 100));
  return editHeight(records, b, pixel, (p, old) =>
    contains(p, r.polygons)
      ? reset || r.values.elevationM !== undefined
        ? target
        : r.values.terrain === "water"
          ? Math.min(old, target)
          : Math.max(old, target)
      : undefined,
  );
}
/** Explicit reset releases authored nodes to the coarser field; ordinary coarse strokes never do. */
export function resetHeightArea(
  records: LandscapeRecord[],
  polygons: Polygon[],
  resolution: number,
): LandscapeRecord[] {
  const changed: LandscapeRecord[] = [];
  for (const r of records)
    if (r.height && r.height.pixel <= resolution) {
      const t = r.height,
        values = decodeHeights(t).slice();
      let dirty = false;
      for (let i = 0; i < values.length; i++)
        if (
          !Number.isNaN(values[i]) &&
          contains(
            {
              x: t.x + (i % 64) * t.pixel,
              y: t.y + Math.floor(i / 64) * t.pixel,
            },
            polygons,
          )
        ) {
          values[i] = NaN;
          dirty = true;
        }
      if (dirty)
        changed.push({ ...r, height: { ...t, data: encodeHeights(values) } });
    }
  return changed;
}

/** Derived colour-authoring footprint. Final colour/coast clips against the exact same sampler. */
export function terrainLandSpans(
  records: LandscapeRecord[],
  tiles: LandscapeRecord[] = records,
): Polygon[] {
  const sampler = new TerrainSampler(records,false),
    out: Polygon[] = [];
  for (const r of tiles)
    if (r.height) {
      const t = r.height;
      for (let y = -1; y < 64; y++) {
        let start: number | null = null;
        for (let x = -1; x <= 64; x++) {
          const land =
            x < 64 &&
            !sampler.water({
              x: t.x + (x + 0.5) * t.pixel,
              y: t.y + (y + 0.5) * t.pixel,
            });
          if (land && start === null) start = x;
          if (!land && start !== null) {
            out.push(
              ...rectangle(
                t.x + start * t.pixel,
                t.y + y * t.pixel,
                (x - start) * t.pixel,
                t.pixel,
              ),
            );
            start = null;
          }
        }
      }
    }
  return out;
}
