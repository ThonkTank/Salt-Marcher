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

function comparable(value: string): string {
  return displayText(value).toLocaleLowerCase("de");
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

function snippet(text: string, matchIndex: number): string {
  if (text.length <= SNIPPET_LENGTH) return text;
  let start = Math.max(0, matchIndex - 48);
  const end = Math.min(text.length, start + SNIPPET_LENGTH);
  start = Math.max(0, end - SNIPPET_LENGTH);
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
  const needle = comparable(query), entries: RoomKeySectionMatch[] = [];
  for (const room of rooms) {
    const floor = session.floors.get(room.floorId)!;
    for (const section of room.key.sections) {
      const text = displayText(stripFeatureBoundaries(sectionMarkdown(session, section))),
        matchIndex = comparable(text).indexOf(needle);
      if (matchIndex < 0) continue;
      entries.push({
        kind: "section",
        roomId: room.id,
        floorId: room.floorId,
        sectionId: section.id,
        floorName: floor.name,
        roomNumber: room.number,
        roomName: room.name,
        sectionTitle: sectionTitle(session, section),
        snippet: snippet(text, matchIndex),
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
