import type { Room } from '../shared/contracts';
import type { DungeonView } from './dungeon-contracts';
import type { DrawingElement } from './drawing-contracts';
import type { KeyBlock, KeyContent } from '../campaign/key-contracts';
import { expandedKeyBlocks, keyAttributes } from '../campaign/key-model';
export interface BinderExit {
  id: string;
  name: string;
  description: string;
  targetId: string | null;
  state: string;
  secret: boolean;
}

export function unplacedBinderPublicText(room: Room, blocks: KeyBlock[], discovered: Set<string>) {
  return blocks
    .filter(
      (block) =>
        block.visibility === 'public' ||
        (block.visibility === 'secret' && discovered.has(block.id)),
    )
    .filter((block) => block.kind === 'text' || block.kind === 'legacy')
    .map((block) =>
      block.kind === 'legacy'
        ? room.sections
            .filter((section) => section.kind === 'markdown')
            .map((section) => section.markdown ?? '')
            .join('\n\n')
        : discovered.has(block.id) && block.revealedText
          ? block.revealedText
          : block.text,
    )
    .filter(Boolean)
    .join('\n\n');
}

export class DungeonBinderIndex {
  readonly rooms: Room[];
  readonly keys: Map<string, KeyContent>;
  readonly features = new Map<string, DrawingElement[]>();
  readonly exits = new Map<string, BinderExit[]>();
  readonly surfaces = new Map<string, KeyContent[]>();
  readonly geometric: Set<string>;
  constructor(readonly view: DungeonView) {
    this.geometric = new Set(view.rooms.map((r) => r.id));
    this.rooms = [
      ...view.rooms,
      ...view.drawing.hiddenRooms.filter((r) => !this.geometric.has(r.id)),
    ].sort(
      (a, b) =>
        a.scopeId.localeCompare(b.scopeId) ||
        a.number.localeCompare(b.number, undefined, { numeric: true }) ||
        a.name.localeCompare(b.name),
    );
    this.keys = new Map((view.drawing.keyContent ?? []).map((k) => [k.id, k]));
    for (const k of view.drawing.keyContent ?? []) {
      if (k.kind !== 'surface') continue;
      const ids = new Set(
        k.surface?.fragments.flatMap(
          (f) =>
            view.drawing.volumes?.filter((v) => v.id === f.volumeId).map((v) => v.roomId) ?? [],
        ) ?? [],
      );
      if (k.surface?.roomId) ids.add(k.surface.roomId);
      for (const roomId of ids) {
        const rows = this.surfaces.get(roomId) ?? [];
        rows.push(k);
        this.surfaces.set(roomId, rows);
      }
    }
    const add = (room: string | null, exit: BinderExit) => {
      if (room) {
        const rows = this.exits.get(room) ?? [];
        rows.push(exit);
        this.exits.set(room, rows);
      }
    };
    for (const e of view.drawing.elements) {
      if (e.archived) continue;
      if (e.kind === 'feature' && e.roomId) {
        const rows = this.features.get(e.roomId) ?? [];
        rows.push(e);
        this.features.set(e.roomId, rows);
      }
      if (e.kind === 'door' || e.kind === 'stairs') {
        const row = {
          id: e.id,
          name: e.name || (e.kind === 'door' ? 'Tür' : 'Treppe'),
          description: e.notes,
          state:
            (e.state === 'locked'
              ? 'verschlossen'
              : e.state === 'closed'
                ? 'geschlossen'
                : 'offen') + (e.passable ? ' · passierbar' : ' · nicht passierbar'),
          secret: e.secret,
        };
        add(e.roomId, { ...row, targetId: e.targetRoomId });
        if (e.targetRoomId !== e.roomId) add(e.targetRoomId, { ...row, targetId: e.roomId });
      }
    }
    for (const p of view.drawing.passages ?? []) {
      const state = view.drawing.passageStatuses?.find((s) => s.id === p.id),
        row = { id: p.id, name: '3D-Passage', secret: false };
      add(p.roomId, {
        ...row,
        description: p.outbound.description,
        targetId: p.otherRoomId,
        state:
          (p.assigned ? 'zugeordnet' : 'nicht zugeordnet') +
          ' · ' +
          (state?.outbound ?? (p.outbound.passable ? 'passierbar' : 'nicht passierbar')),
      });
      if (p.otherRoomId !== p.roomId)
        add(p.otherRoomId, {
          ...row,
          description: p.inbound.description,
          targetId: p.roomId,
          state:
            (p.assigned ? 'zugeordnet' : 'nicht zugeordnet') +
            ' · ' +
            (state?.inbound ?? (p.inbound.passable ? 'passierbar' : 'nicht passierbar')),
        });
    }
  }
  blocks(room: Room) {
    const key = this.keys.get(room.id);
    return key ? expandedKeyBlocks(key, this.view.drawing.keyContent ?? []) : [];
  }
  searchBlocks(room: Room) {
    return [
      ...this.blocks(room),
      ...(this.surfaces.get(room.id) ?? []).flatMap((k) =>
        expandedKeyBlocks(k, this.view.drawing.keyContent ?? []),
      ),
    ];
  }
  label(room: Room) {
    const key = this.keys.get(room.id),
      level = key?.kind === 'room' && key.levelId ? this.keys.get(key.levelId) : undefined;
    return (
      (level?.kind === 'level' && level.scopeId === room.scopeId ? level.name + ' · ' : '') +
      room.number +
      '. ' +
      room.name
    );
  }
  floor(room: Room) {
    return (
      this.view.floors.find((f) => f.scopeId === room.scopeId && f.id === room.floorId)?.name ??
      this.view.drawing.hiddenFloors.find(
        (f) => f.scopeId === room.scopeId && f.id === room.floorId,
      )?.name ??
      'Ohne Geschoss'
    );
  }
  scope(room: Room) {
    return (
      this.keys.get(room.scopeId)?.name ??
      'Dungeon ' + ([...new Set(this.rooms.map((r) => r.scopeId))].indexOf(room.scopeId) + 1)
    );
  }
  matches(room: Room, q: string) {
    if (!q) return true;
    const key = this.keys.get(room.id),
      strings = [
        room.number,
        room.name,
        this.label(room),
        this.scope(room),
        this.floor(room),
        key?.status,
        ...(key?.tags ?? []),
        ...room.sections.map((s) => s.markdown ?? ''),
        ...this.searchBlocks(room).flatMap((b) => [
          b.text,
          b.revealedText,
          b.searchMethod,
          b.discoveryNotes,
        ]),
        ...(key
          ? keyAttributes(key, this.view.drawing.keyContent ?? []).map(
              (a) => a.key + ' ' + (a.value ?? ''),
            )
          : []),
        ...(key?.references.flatMap((r) => [r.label, r.kind]) ?? []),
        ...(this.features.get(room.id) ?? []).flatMap((f) => [
          f.name,
          f.notes,
          f.content?.publicText ?? '',
          f.content?.search?.notes ?? '',
          ...(f.content?.tags ?? []),
        ]),
        ...(this.exits.get(room.id) ?? []).flatMap((e) => [e.name, e.description]),
      ];
    return strings.some((s) => s?.toLocaleLowerCase().includes(q));
  }
}
