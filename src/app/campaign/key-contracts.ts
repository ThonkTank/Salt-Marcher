import type { SurfaceRegion } from '../atlas/surface-model';
import type { Room } from '../shared/contracts';
export type KeyVisibility = 'public' | 'gm' | 'secret';
export interface KeyBlock {
  id: string;
  kind: 'text' | 'geometry' | 'attributes' | 'exits' | 'legacy' | 'template';
  visibility: KeyVisibility;
  text: string;
  templateId: string | null;
  suppressed: string[];
  searchMethod: string;
  dc: number | null;
  discoveryNotes: string;
  revealedText: string;
}
export interface KeyContent {
  id: string;
  revision: number;
  scopeId: string;
  kind: 'dungeon' | 'level' | 'group' | 'room' | 'template' | 'surface';
  surface?: SurfaceRegion;
  name: string;
  levelId: string | null;
  groupId: string | null;
  zSteps: number[];
  attributes: Record<string, string | null>;
  blocks: KeyBlock[];
  tags: string[];
  secret: boolean;
  status: string;
  references: { kind: string; id: string; label: string }[];
}
export interface KeyTextEdit {
  mode: 'replace' | 'prepend' | 'append' | 'search-replace';
  text: string;
  search?: string;
}
export interface KeyBatch {
  linkTemplate?: { id: string; revision: number };
  name?: KeyTextEdit;
  number?: string;
  renumberStart?: number;
  readAloud?: KeyTextEdit;
  gmNotes?: KeyTextEdit;
  legacyText?: KeyTextEdit;
  sectionEdits?: { id: string; markdown: string }[];
  levelId?: string | null;
  groupId?: string | null;
  attributes?: Record<string, string | null>;
  attributeMode?: 'merge' | 'replace';
  tags?: string[];
  secret?: boolean;
  status?: string;
  references?: KeyContent['references'];
  blocks?: KeyBlock[];
}
export type KeyCopyField =
  | 'name'
  | 'public'
  | 'gm'
  | 'blocks'
  | 'attributes'
  | 'tags'
  | 'references'
  | 'secret'
  | 'status';
export interface KeyCopyOptions {
  fields: KeyCopyField[];
  mode: 'append' | 'replace';
  attributes: 'own' | 'effective';
}
export interface KeyRoomGuard {
  id: string;
  expectedRevision: number;
  keyRevision: number | null;
}
export type KeyAction =
  | { kind: 'key-content'; content: KeyContent; expectedRevision: number | null }
  | { kind: 'key-batch'; rooms: KeyRoomGuard[]; patch: KeyBatch }
  | {
      kind: 'key-copy';
      source: KeyRoomGuard;
      dependencies: { id: string; revision: number }[];
      rooms: KeyRoomGuard[];
      options: KeyCopyOptions;
    };
export interface KeyRendered {
  text: string;
  blocks: {
    id: string;
    visibility: KeyVisibility;
    text: string;
    discovered: boolean;
    dc: number | null;
    searchMethod: string;
    discoveryNotes: string;
  }[];
  attributes: { key: string; value: string | null; origin: string }[];
}
export function emptyKey(room: Room): KeyContent {
  return {
    id: room.id,
    revision: 0,
    scopeId: room.scopeId,
    kind: 'room',
    name: room.name,
    levelId: null,
    groupId: null,
    zSteps: [],
    attributes: {},
    blocks: [
      {
        id: crypto.randomUUID(),
        kind: 'legacy',
        visibility: 'gm',
        text: '',
        templateId: null,
        suppressed: [],
        searchMethod: '',
        dc: null,
        discoveryNotes: '',
        revealedText: '',
      },
      ...(['geometry', 'attributes', 'exits'] as const).map((kind) => ({
        id: crypto.randomUUID(),
        kind,
        visibility: 'public' as const,
        text: '',
        templateId: null,
        suppressed: [],
        searchMethod: '',
        dc: null,
        discoveryNotes: '',
        revealedText: '',
      })),
    ],
    tags: [],
    secret: false,
    status: '',
    references: [],
  };
}

export function validateKeyContent(c: unknown): asserts c is KeyContent {
  const object = (v: unknown): v is Record<string, any> =>
    !!v && typeof v === 'object' && !Array.isArray(v);
  const id = (v: unknown) => typeof v === 'string' && v.length > 0 && v.length <= 1000;
  const optionalId = (v: unknown) => v === null || id(v);
  const text = (v: unknown, limit = 2000000) => typeof v === 'string' && v.length <= limit;
  const strings = (v: unknown, count: number, limit: number) =>
    Array.isArray(v) && v.length <= count && v.every((s) => text(s, limit));
  if (!object(c)) throw new Error('Dungeon-Key prüfen.');
  if (
    !id(c.id) ||
    !id(c.scopeId) ||
    !Number.isSafeInteger(c.revision) ||
    c.revision < 0 ||
    !['room', 'dungeon', 'level', 'group', 'template', 'surface'].includes(c.kind) ||
    !text(c.name, 1000) ||
    !optionalId(c.levelId) ||
    !optionalId(c.groupId) ||
    !Array.isArray(c.blocks) ||
    c.blocks.length > 1000 ||
    !strings(c.tags, 100, 2000000) ||
    !Array.isArray(c.references) ||
    c.references.length > 1000 ||
    !Array.isArray(c.zSteps) ||
    c.zSteps.length > 1000 ||
    c.zSteps.some((z) => !Number.isSafeInteger(z)) ||
    !object(c.attributes) ||
    typeof c.secret !== 'boolean' ||
    !text(c.status)
  )
    throw new Error('Keyidentität, Name, Zustand und Umfang prüfen.');
  if (
    (c.kind === 'group' && c.groupId) ||
    (['level', 'dungeon', 'template'].includes(c.kind) && (c.levelId || c.groupId)) ||
    (c.kind === 'dungeon' && c.id !== c.scopeId)
  )
    throw new Error('Vererbung: Dungeon, optional Level, optional Gruppe, Raum.');
  for (const [key, value] of Object.entries(c.attributes))
    if (!key.trim() || key.length > 200 || (value !== null && !text(value, 10000)))
      throw new Error('Attributname oder Wert prüfen.');
  for (const ref of c.references)
    if (!object(ref) || !id(ref.kind) || !id(ref.id) || !text(ref.label))
      throw new Error('Keyreferenz prüfen.');
  if (c.kind === 'surface') {
    const a = c.surface;
    if (!object(a) || !id(a.roomId) || !Array.isArray(a.fragments) || a.fragments.length > 128)
      throw new Error('Oberflächenbereich benötigt einen Raum und markierte Flächen.');
    let total = 0;
    const fragments = new Set<string>();
    for (const f of a.fragments) {
      if (
        !object(f) ||
        !id(f.id) ||
        fragments.has(f.id) ||
        !id(f.volumeId) ||
        !Array.isArray(f.faces) ||
        f.faces.length > 20000
      )
        throw new Error('Oberflächenfragment prüfen.');
      fragments.add(f.id);
      const faces = [...f.faces, ...(f.orphanedWorld?.faces ?? [])];
      total += faces.length;
      if (
        total > 20000 ||
        faces.some(
          (v: any) =>
            !object(v) ||
            ![v.x, v.y, v.z].every(Number.isSafeInteger) ||
            !['north', 'east', 'south', 'west', 'floor', 'ceiling'].includes(v.side),
        )
      )
        throw new Error('Höchstens 20.000 ganzzahlige Voxel-Flächen markieren.');
    }
  }
  const ids = new Set<string>();
  for (const b of c.blocks) {
    if (
      !object(b) ||
      !id(b.id) ||
      ids.has(b.id) ||
      !['text', 'geometry', 'attributes', 'exits', 'legacy', 'template'].includes(b.kind) ||
      !['public', 'gm', 'secret'].includes(b.visibility) ||
      ![b.text, b.discoveryNotes, b.revealedText, b.searchMethod].every((v) => text(v)) ||
      !optionalId(b.templateId) ||
      !strings(b.suppressed, 1000, 1000) ||
      (b.dc !== null && (!Number.isFinite(b.dc) || b.dc < -100 || b.dc > 100)) ||
      (b.kind === 'template' && (c.kind === 'template' || !id(b.templateId)))
    )
      throw new Error('Beschreibungsblock, Sichtbarkeit oder Vorlagenverknüpfung prüfen.');
    ids.add(b.id);
  }
}
