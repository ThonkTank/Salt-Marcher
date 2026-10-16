import { immutable } from "../../model";
import {
  AtlasHistory,
  type AtlasChange,
  type AtlasValue,
} from "../atlas/atlas-history";
import { parseCityDocument, serializeCityDocument } from "./codec";
import type { CityDocument } from "./model";

const DOCUMENT_TARGET = "document";

/** Validate before JSON conversion can discard unknown fields or array metadata. */
function snapshot(document: CityDocument): AtlasValue {
  return JSON.parse(serializeCityDocument(document)) as AtlasValue;
}
function checked(value: AtlasValue, ownerId: string): CityDocument {
  const document = parseCityDocument(JSON.stringify(value));
  if (document.id !== ownerId)
    throw new Error("Stadtkennung stimmt nicht mit dem Atlasbesitzer überein.");
  return document;
}

/** One source per city/history lifetime; current geometry lives only in AtlasHistory. */
export class CitySource {
  readonly id: string;
  constructor(
    initial: CityDocument,
    readonly history: AtlasHistory,
  ) {
    const value = snapshot(initial);
    this.id = parseCityDocument(JSON.stringify(value)).id;
    const ownerId = this.id;
    history.register(ownerId, (target, next) => {
      if (target !== DOCUMENT_TARGET)
        throw new Error("Unbekanntes Stadt-Befehlsziel.");
      checked(next, ownerId);
    });
    history.hydrate(ownerId, [[DOCUMENT_TARGET, value]]);
  }
  read(): CityDocument {
    return checked(this.history.read(this.id, DOCUMENT_TARGET), this.id);
  }
}

/** Keep the gesture's original before snapshot; compose with other owners before executing. */
export function cityDocumentChange(
  before: CityDocument,
  after: CityDocument,
): AtlasChange {
  const beforeValue = snapshot(before),
    afterValue = snapshot(after),
    ownerId = parseCityDocument(JSON.stringify(beforeValue)).id;
  checked(afterValue, ownerId);
  return immutable({
    ownerId,
    target: DOCUMENT_TARGET,
    before: beforeValue,
    after: afterValue,
  });
}
