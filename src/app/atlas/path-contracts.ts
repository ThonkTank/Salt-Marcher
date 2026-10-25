import type { Result } from '../contracts';
import type { DungeonVolume } from './volume-contracts';
export type ConnectionForm = 'corridor' | 'stairs' | 'ramp' | 'ladder' | 'shaft';
export type BoundaryFace = 'north' | 'east' | 'south' | 'west' | 'up' | 'down';
export interface PathAnchor {
  roomId: string;
  volumeId: string | null;
  pinned: boolean;
  local: { x: number; y: number; z: number; face: BoundaryFace } | null;
}
export interface PathPoint {
  x: number;
  y: number;
  z: number;
}
export interface PathSegment {
  form: ConnectionForm;
  widthSteps: number;
  heightSteps: number;
  factor: number;
}
export interface DungeonPath {
  id: string;
  revision: number;
  scopeId: string;
  name: string;
  notes: string;
  from: PathAnchor;
  to: PathAnchor;
  waypoints: PathPoint[];
  segments: PathSegment[];
  medium: 'air' | 'water';
  mode: 'path' | 'area';
  roomId: string | null;
  volumeId: string | null;
  fromPassageId: string;
  toPassageId: string;
  basis: string;
  route: {
    x: number;
    y: number;
    z: number;
    form: ConnectionForm;
    factor: number;
    segmentIndex: number;
  }[];
}
export interface PassageSide {
  description: string;
  passable: boolean;
  sight: boolean;
  light: boolean;
  sound: boolean;
  additionalSeconds: number;
  target: { kind: 'geometry' | 'passage' | 'location'; id: string | null };
}
export interface DungeonPassage {
  id: string;
  revision: number;
  scopeId: string;
  roomId: string;
  volumeId: string;
  pathId: string | null;
  otherRoomId: string | null;
  anchor: PathAnchor;
  widthSteps: number;
  heightSteps: number;
  outbound: PassageSide;
  inbound: PassageSide;
  assigned: boolean;
}
export interface PathPreview {
  path: DungeonPath;
  volume: DungeonVolume;
  basis: string;
  fromWorld: PathPoint;
  toWorld: PathPoint;
  distanceMeters: number;
  warnings: string[];
}
export type PathAction =
  | { kind: 'path-publish'; preview: PathPreview; expectedRevision: number | null }
  | { kind: 'path-convert'; id: string; expectedRevision: number }
  | { kind: 'path-hide'; id: string; expectedRevision: number; hidden: boolean }
  | { kind: 'passage'; passage: DungeonPassage; expectedRevision: number | null };
export interface PathAPI {
  previewPath(token: string, path: DungeonPath): Promise<Result<PathPreview>>;
}

const object = (v: unknown): v is Record<string, any> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const id = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 1000;
const optionalId = (v: unknown) => v === null || id(v);
const forms = ['corridor', 'stairs', 'ramp', 'ladder', 'shaft'];
const faces = ['north', 'east', 'south', 'west', 'up', 'down'];
function anchorValid(a: unknown): a is PathAnchor {
  if (!object(a) || !id(a.roomId) || !optionalId(a.volumeId) || typeof a.pinned !== 'boolean')
    return false;
  return (
    a.local === null ||
    (object(a.local) &&
      [a.local.x, a.local.y, a.local.z].every(Number.isSafeInteger) &&
      faces.includes(a.local.face))
  );
}
export function validateDungeonPath(p: unknown, materialized = false): asserts p is DungeonPath {
  const fail: () => never = () => {
    throw new Error('3D-Pfadinhalt ungültig oder widersprüchlich.');
  };
  if (
    !object(p) ||
    !id(p.id) ||
    !id(p.scopeId) ||
    !Number.isSafeInteger(p.revision) ||
    p.revision < 0 ||
    typeof p.name !== 'string' ||
    !p.name.trim() ||
    p.name.length > 1000 ||
    typeof p.notes !== 'string' ||
    p.notes.length > 2000000 ||
    !['path', 'area'].includes(p.mode) ||
    !['air', 'water'].includes(p.medium) ||
    !anchorValid(p.from) ||
    !anchorValid(p.to) ||
    p.from.roomId === p.to.roomId ||
    !optionalId(p.roomId) ||
    !optionalId(p.volumeId) ||
    !id(p.fromPassageId) ||
    !id(p.toPassageId) ||
    p.fromPassageId === p.toPassageId ||
    typeof p.basis !== 'string' ||
    (p.basis !== '' && !/^[a-f0-9]{64}$/.test(p.basis))
  )
    fail();
  if (
    !Array.isArray(p.waypoints) ||
    p.waypoints.length > 32 ||
    p.waypoints.some((w: unknown) => !object(w) || ![w.x, w.y, w.z].every(Number.isFinite)) ||
    !Array.isArray(p.segments) ||
    p.segments.length !== p.waypoints.length + 1
  )
    fail();
  for (const s of p.segments)
    if (
      !object(s) ||
      !forms.includes(s.form) ||
      ![s.widthSteps, s.heightSteps].every((n) => Number.isSafeInteger(n) && n >= 1 && n <= 20) ||
      !Number.isFinite(s.factor) ||
      s.factor < 0.1 ||
      s.factor > 100
    )
      fail();
  if (!Array.isArray(p.route) || p.route.length > 5000) fail();
  for (let i = 0; i < p.route.length; i++) {
    const r = p.route[i],
      previous = p.route[i - 1];
    if (
      !object(r) ||
      ![r.x, r.y, r.z, r.segmentIndex].every(Number.isSafeInteger) ||
      r.segmentIndex < 0 ||
      r.segmentIndex > 32 ||
      !forms.includes(r.form) ||
      !Number.isFinite(r.factor) ||
      r.factor < 0.1 ||
      r.factor > 100
    )
      fail();
    if (
      materialized &&
      (r.segmentIndex >= p.segments.length ||
        r.form !== p.segments[r.segmentIndex].form ||
        r.factor !== p.segments[r.segmentIndex].factor)
    )
      fail();
    if (
      previous &&
      (r.segmentIndex < previous.segmentIndex ||
        Math.abs(r.x - previous.x) + Math.abs(r.y - previous.y) > 1 ||
        Math.abs(r.z - previous.z) > 1)
    )
      fail();
  }
  if (
    materialized &&
    (!id(p.roomId) ||
      !id(p.volumeId) ||
      !id(p.from.volumeId) ||
      !id(p.to.volumeId) ||
      !p.from.local ||
      !p.to.local ||
      !p.route.length ||
      !p.basis)
  )
    fail();
}
export function validateDungeonPassage(p: unknown): asserts p is DungeonPassage {
  const fail: () => never = () => {
    throw new Error('Passageninhalt ungültig oder widersprüchlich.');
  };
  if (
    !object(p) ||
    !id(p.id) ||
    !id(p.scopeId) ||
    !id(p.roomId) ||
    !id(p.volumeId) ||
    !Number.isSafeInteger(p.revision) ||
    p.revision < 0 ||
    !optionalId(p.pathId) ||
    !optionalId(p.otherRoomId) ||
    !anchorValid(p.anchor) ||
    p.anchor.roomId !== p.roomId ||
    p.anchor.volumeId !== p.volumeId ||
    typeof p.assigned !== 'boolean' ||
    (p.assigned && !p.anchor.local) ||
    ![p.widthSteps, p.heightSteps].every((n) => Number.isSafeInteger(n) && n >= 1 && n <= 20)
  )
    fail();
  for (const s of [p.outbound, p.inbound])
    if (
      !object(s) ||
      typeof s.description !== 'string' ||
      s.description.length > 2000000 ||
      [s.passable, s.sight, s.light, s.sound].some((v) => typeof v !== 'boolean') ||
      !Number.isSafeInteger(s.additionalSeconds) ||
      s.additionalSeconds < 0 ||
      s.additionalSeconds > 100000000 ||
      !object(s.target) ||
      !['geometry', 'passage', 'location'].includes(s.target.kind) ||
      !optionalId(s.target.id)
    )
      fail();
}
