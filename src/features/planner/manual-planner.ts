import {
  campaignLocalId,
  type CampaignLocalId,
} from "../campaign/campaign-contracts";

export interface ManualScene {
  readonly id: CampaignLocalId;
  readonly title: string;
  readonly notes: string;
  readonly locationId: CampaignLocalId | null;
}
export interface ManualPlan {
  readonly version: 1;
  readonly id: CampaignLocalId;
  readonly revision: number;
  readonly name: string;
  readonly scenes: readonly ManualScene[];
}
type SceneFields = Pick<ManualScene, "title" | "notes" | "locationId">;

function record(
  raw: unknown,
  keys: readonly string[],
): Record<string, unknown> {
  if (
    !raw ||
    typeof raw !== "object" ||
    Object.getPrototypeOf(raw) !== Object.prototype ||
    Reflect.ownKeys(raw).length !== keys.length
  )
    throw new Error("Ungültiger manueller Plan.");
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    const d = Object.getOwnPropertyDescriptor(raw, key);
    if (!d || !("value" in d)) throw new Error("Ungültiger manueller Plan.");
    result[key] = d.value;
  }
  return result;
}
function text(value: unknown): string {
  if (typeof value !== "string") throw new Error("Ungültiger Plantext.");
  return value; // Preserve authored whitespace and prose exactly.
}
function fields(raw: unknown): SceneFields {
  const d = record(raw, ["title", "notes", "locationId"]);
  return Object.freeze({
    title: text(d.title),
    notes: text(d.notes),
    locationId:
      d.locationId === null ? null : campaignLocalId(text(d.locationId)),
  });
}
function scene(raw: unknown): ManualScene {
  const d = record(raw, ["id", "title", "notes", "locationId"]);
  return Object.freeze({
    id: campaignLocalId(text(d.id)),
    ...fields({ title: d.title, notes: d.notes, locationId: d.locationId }),
  });
}
/** Validate the shared authored plan without normalizing its prose or identities. */
export function manualPlan(raw: unknown): ManualPlan {
  const d = record(raw, ["version", "id", "revision", "name", "scenes"]);
  if (
    d.version !== 1 ||
    !Number.isSafeInteger(d.revision) ||
    (d.revision as number) < 1 ||
    !Array.isArray(d.scenes)
  )
    throw new Error("Ungültige Planrevision oder Szenen.");
  // Validate descriptors before reading values: map skips holes and invokes getters.
  if (Reflect.ownKeys(d.scenes).length !== d.scenes.length + 1)
    throw new Error("Ungültige Szenenliste.");
  const scenes: ManualScene[] = [];
  for (let i = 0; i < d.scenes.length; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(d.scenes, String(i));
    if (!descriptor || !("value" in descriptor))
      throw new Error("Ungültige Szenenliste.");
    scenes.push(scene(descriptor.value));
  }
  if (new Set(scenes.map((s) => s.id)).size !== scenes.length)
    throw new Error("Doppelte Szene.");
  return Object.freeze({
    version: 1,
    id: campaignLocalId(text(d.id)),
    revision: d.revision as number,
    name: text(d.name),
    scenes: Object.freeze(scenes),
  });
}
