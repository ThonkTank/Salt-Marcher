import { parseDocument, serializeDocument } from "../../model";
import { safePath } from "../../model";
import { parseCityDocument, serializeCityDocument } from "../city/codec";
import { nativeId, nativeRecord } from "./native-values";

export type DetailKind = "city" | "dungeon";
export interface DetailRecord {
  readonly kind: DetailKind;
  readonly id: string;
  readonly path: string;
  readonly bytes: string;
}
export interface DraftDetail {
  readonly kind: DetailKind;
  readonly id: string;
  readonly path: string;
  readonly before: string;
  readonly after: string;
}
export function detailPath(kind: DetailKind, path: string): string {
  safePath(path);
  if (!path.endsWith(kind === "city" ? ".city" : ".dungeon"))
    throw new Error("Falscher Detaildateityp.");
  return path;
}
export function newDetailPath(kind: DetailKind, id: string): string {
  return kind === "city"
    ? `Städte/${nativeId(id)}.city`
    : `Dungeons/${nativeId(id)}/Karte.dungeon`;
}
export function detailDocument(kind: DetailKind, id: string, bytes: string) {
  const document =
    kind === "city" ? parseCityDocument(bytes) : parseDocument(bytes);
  if (document.id !== id)
    throw new Error("Detaildatei besitzt eine fremde Kennung.");
  return document;
}
export function canonicalDetail(
  kind: DetailKind,
  id: string,
  bytes: string,
): string {
  detailDocument(kind, id, bytes);
  return kind === "city"
    ? serializeCityDocument(parseCityDocument(bytes))
    : serializeDocument(parseDocument(bytes));
}
export function checkedDraftDetail(value: unknown): DraftDetail {
  const v = nativeRecord(value, ["kind", "id", "path", "before", "after"]);
  if (
    (v.kind !== "city" && v.kind !== "dungeon") ||
    typeof v.path !== "string" ||
    typeof v.before !== "string" ||
    typeof v.after !== "string" ||
    v.before === v.after
  )
    throw new Error("Ungültiger Detailentwurf.");
  const id = nativeId(v.id);
  detailPath(v.kind, v.path);
  canonicalDetail(v.kind, id, v.before);
  canonicalDetail(v.kind, id, v.after);
  return Object.freeze({
    kind: v.kind,
    id,
    path: v.path,
    before: v.before,
    after: v.after,
  });
}
