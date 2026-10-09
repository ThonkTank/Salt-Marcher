import { immutable } from "../../model";
import {
  AtlasHistory,
  type AtlasChange,
  type AtlasValue,
} from "../atlas/atlas-history";
import { nativeId } from "../atlas/native-values";
import {
  checkedLocationDocument,
  serializeLocationDocument,
  type LocationDocument,
} from "./location-schema";

function checked(value: AtlasValue, ownerId: string): LocationDocument | null {
  if (value === null) return null;
  const document = checkedLocationDocument(value);
  if (document.id !== ownerId)
    throw new Error("Ortskennung stimmt nicht mit dem Atlasbesitzer überein.");
  return document;
}
function snapshot(
  document: LocationDocument | null,
  ownerId: string,
): AtlasValue {
  if (document === null) return null;
  // Validate the native input before JSON could discard unknown fields or call getters.
  const value = JSON.parse(serializeLocationDocument(document)) as AtlasValue;
  checked(value, ownerId);
  return value;
}
/** One source per owner/history lifetime. Absence is explicit and undoable, not an unload state. */
export class LocationSource {
  readonly id: string;
  constructor(
    id: string,
    readonly history: AtlasHistory,
    initial: LocationDocument | null = null,
  ) {
    this.id = nativeId(id);
    const value = snapshot(initial, this.id);
    history.register(this.id, (target, next) => {
      if (target !== "document")
        throw new Error("Unbekanntes Orts-Befehlsziel.");
      checked(next, this.id);
    });
    history.hydrate(this.id, [["document", value]]);
  }
  read(): LocationDocument | null {
    return checked(this.history.read(this.id, "document"), this.id);
  }
}
/** Keep the gesture's original before value; compose with world/terrain owners before execute. */
export function locationDocumentChange(
  id: string,
  before: LocationDocument | null,
  after: LocationDocument | null,
): AtlasChange {
  const ownerId = nativeId(id);
  return immutable({
    ownerId,
    target: "document",
    before: snapshot(before, ownerId),
    after: snapshot(after, ownerId),
  });
}
