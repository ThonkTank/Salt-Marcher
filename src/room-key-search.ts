import { isStructuredRoom, type RoomV4 } from "./model";
import { sectionMarkdown, sectionTitle } from "./room-key";
import { stripFeatureBoundaries } from "./room-projection";
import { Session } from "./session";

const SNIPPET_LENGTH = 160;

export interface RoomKeySearchTarget {
  readonly roomId: string;
  readonly floorId: string;
  readonly sectionId?: string;
}

interface RoomKeySearchEntryBase extends RoomKeySearchTarget {
  readonly floorName: string;
  readonly roomNumber: string;
  readonly roomName: string;
}

export interface RoomKeyOverviewEntry extends RoomKeySearchEntryBase {
  readonly kind: "room";
}

export interface RoomKeySectionMatch extends RoomKeySearchEntryBase {
  readonly kind: "section";
  readonly sectionId: string;
  readonly sectionTitle: string;
  readonly snippet: string;
}

export type RoomKeySearchEntry = RoomKeyOverviewEntry | RoomKeySectionMatch;

export interface RoomKeySearchResult {
  readonly available: boolean;
  readonly query: string;
  readonly entries: readonly RoomKeySearchEntry[];
}

function displayText(value: string): string {
  return value.normalize("NFKC").replace(/\s+/gu, " ").trim();
}

interface FoldedText {
  readonly value: string;
  readonly starts: readonly number[];
  readonly ends: readonly number[];
}

function foldText(value: string): FoldedText {
  let folded = "", offset = 0;
  const starts: number[] = [], ends: number[] = [];
  for (const character of value) {
    const start = offset;
    offset += character.length;
    // Unicode's final sigma is context-sensitive when lowercasing whole words.
    // Canonicalizing both lowercase sigma forms keeps per-code-point offsets while
    // retaining case-insensitive matching for uppercase and lowercase Greek text.
    const part = character.toLocaleLowerCase("de").replaceAll("ς", "σ");
    folded += part;
    for (let index = 0; index < part.length; index++) {
      starts.push(start);
      ends.push(offset);
    }
  }
  return { value: folded, starts, ends };
}

function numericRoomNumber(value: string): number {
  const number = value.trim() ? Number(value) : Number.NaN;
  return Number.isFinite(number) ? number : Number.POSITIVE_INFINITY;
}

function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function roomsInSearchOrder(session: Session): readonly RoomV4[] {
  const floorOrder = new Map(
    [...session.floors.keys()].map((floorId, index) => [floorId, index]),
  );
  return [...session.entities.values()].filter(isStructuredRoom).sort((a, b) =>
    (floorOrder.get(a.floorId) ?? Number.POSITIVE_INFINITY) -
      (floorOrder.get(b.floorId) ?? Number.POSITIVE_INFINITY) ||
    numericRoomNumber(a.number) - numericRoomNumber(b.number) ||
    compareIds(a.id, b.id),
  );
}

function snippet(text: string, matchStart: number, matchEnd: number): string {
  const length = Math.max(SNIPPET_LENGTH, matchEnd - matchStart);
  if (text.length <= length) return text;
  let start = Math.max(0, matchStart - Math.min(48, length - (matchEnd - matchStart))),
    end = Math.min(text.length, start + length);
  if (end < matchEnd) {
    start = Math.max(0, matchEnd - length);
    end = Math.min(text.length, start + length);
  }
  return `${start ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}

/**
 * Project the current V4 session into a transient room overview or section matches.
 * This function never writes to the session and does not retain an index between calls.
 */
export function searchRoomKeys(session: Session, rawQuery: string): RoomKeySearchResult {
  const query = displayText(rawQuery);
  if (session.version !== 4) return { available: false, query, entries: [] };
  const rooms = roomsInSearchOrder(session);
  if (!query) {
    return {
      available: true,
      query,
      entries: rooms.map((room): RoomKeyOverviewEntry => ({
        kind: "room",
        roomId: room.id,
        floorId: room.floorId,
        floorName: session.floors.get(room.floorId)!.name,
        roomNumber: room.number,
        roomName: room.name,
      })),
    };
  }
  const needle = foldText(query).value, entries: RoomKeySectionMatch[] = [];
  for (const room of rooms) {
    const floor = session.floors.get(room.floorId)!;
    for (const section of room.key.sections) {
      const text = displayText(stripFeatureBoundaries(sectionMarkdown(session, section))),
        folded = foldText(text), matchIndex = folded.value.indexOf(needle);
      if (matchIndex < 0) continue;
      const matchStart = folded.starts[matchIndex],
        matchEnd = folded.ends[matchIndex + needle.length - 1];
      if (matchStart === undefined || matchEnd === undefined) continue;
      entries.push({
        kind: "section",
        roomId: room.id,
        floorId: room.floorId,
        sectionId: section.id,
        floorName: floor.name,
        roomNumber: room.number,
        roomName: room.name,
        sectionTitle: sectionTitle(session, section),
        snippet: snippet(text, matchStart, matchEnd),
      });
    }
  }
  return { available: true, query, entries };
}

/** Revalidate a rendered result against the current session before navigation. */
export function roomKeySearchTargetExists(
  session: Session,
  target: RoomKeySearchTarget,
): boolean {
  if (session.version !== 4) return false;
  const room = session.entities.get(target.roomId);
  return isStructuredRoom(room) && room.floorId === target.floorId &&
    session.floors.has(target.floorId) &&
    (target.sectionId === undefined ||
      room.key.sections.some((section) => section.id === target.sectionId));
}
