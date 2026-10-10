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
export interface PlanBinding {
  readonly id: CampaignLocalId;
  readonly revision: number;
}
export type SceneFields = Pick<ManualScene, "title" | "notes" | "locationId">;
export type ManualPlanAction =
  | { readonly kind: "rename"; readonly name: string }
  | { readonly kind: "add"; readonly scene: ManualScene }
  | {
      readonly kind: "edit";
      readonly sceneId: CampaignLocalId;
      readonly fields: SceneFields;
    }
  | { readonly kind: "remove"; readonly sceneId: CampaignLocalId }
  | {
      readonly kind: "move";
      readonly sceneId: CampaignLocalId;
      readonly direction: -1 | 1;
    };

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
/** Candidate owner payload only; this codec is not an authorized Campaign storage format. */
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
export function newManualPlan(id: CampaignLocalId): ManualPlan {
  return manualPlan({ version: 1, id, revision: 1, name: "", scenes: [] });
}

/** Local authored workspace. The Campaign host owns context validation and durable publication. */
export class ManualPlanner {
  private plans = new Map<CampaignLocalId, ManualPlan>();
  private activeId: CampaignLocalId | null = null;
  private sceneId: CampaignLocalId | null = null;
  private draftValue: {
    binding: PlanBinding;
    sceneId: CampaignLocalId;
    fields: SceneFields;
  } | null = null;
  constructor(
    private readonly makeId: () => CampaignLocalId,
    private readonly assertCurrent: () => void,
    initial: readonly ManualPlan[] = [],
  ) {
    for (const raw of initial) {
      const p = manualPlan(raw);
      if (this.plans.has(p.id)) throw new Error("Doppelter Plan.");
      this.plans.set(p.id, p);
    }
    this.assertUniqueScenes(this.plans);
    this.activeId = this.plans.keys().next().value ?? null;
  }
  private assertUniqueScenes(
    plans: ReadonlyMap<CampaignLocalId, ManualPlan>,
  ): void {
    const ids = new Set<string>(plans.keys());
    for (const p of plans.values())
      for (const s of p.scenes) {
        if (ids.has(s.id)) throw new Error("Kennung bereits belegt.");
        ids.add(s.id);
      }
  }
  get catalog(): readonly ManualPlan[] {
    return Object.freeze([...this.plans.values()]);
  }
  get active(): ManualPlan | null {
    return this.activeId ? (this.plans.get(this.activeId) ?? null) : null;
  }
  get selectedSceneId(): CampaignLocalId | null {
    return this.sceneId;
  }
  get draft(): Readonly<NonNullable<ManualPlanner["draftValue"]>> | null {
    return this.draftValue;
  }
  binding(): PlanBinding {
    const p = this.active;
    if (!p) throw new Error("Kein Plan ausgewählt.");
    return Object.freeze({ id: p.id, revision: p.revision });
  }
  private current(binding: PlanBinding): ManualPlan {
    this.assertCurrent();
    const p = this.plans.get(binding.id);
    if (!p || p.revision !== binding.revision)
      throw new Error(
        "Plan geändert. Entwurf behalten; aktuellen Plan erneut öffnen.",
      );
    return p;
  }
  create(): ManualPlan {
    this.assertCurrent();
    // Flush the old draft before changing selection. Collision/factory failure writes nothing.
    const next = newManualPlan(this.makeId());
    const prospective = new Map(this.plans);
    if (prospective.has(next.id)) throw new Error("Kennung bereits belegt.");
    prospective.set(next.id, next);
    this.assertUniqueScenes(prospective);
    this.commitDraft();
    this.plans.set(next.id, next);
    this.activeId = next.id;
    this.sceneId = null;
    return next;
  }
  act(binding: PlanBinding, action: ManualPlanAction): ManualPlan {
    const p = this.current(binding);
    const next = this.apply(p, action);
    const prospective = new Map(this.plans);
    prospective.set(p.id, next);
    this.assertUniqueScenes(prospective);
    this.plans.set(p.id, next);
    return next;
  }
  /** Stage a local payload change without publishing it. */
  private apply(p: ManualPlan, action: ManualPlanAction): ManualPlan {
    let name = p.name;
    const scenes = [...p.scenes];
    if (action.kind === "rename") name = text(action.name);
    else if (action.kind === "add") scenes.push(scene(action.scene));
    else {
      const i = scenes.findIndex((s) => s.id === action.sceneId);
      if (i < 0) throw new Error("Szene fehlt.");
      if (action.kind === "edit")
        scenes[i] = scene({ id: action.sceneId, ...fields(action.fields) });
      else if (action.kind === "remove") scenes.splice(i, 1);
      else {
        if (action.direction !== -1 && action.direction !== 1)
          throw new Error("Ungültige Szenenrichtung.");
        const j = i + action.direction;
        if (j < 0 || j >= scenes.length) return p;
        [scenes[i], scenes[j]] = [scenes[j]!, scenes[i]!];
      }
    }
    return manualPlan({ ...p, revision: p.revision + 1, name, scenes });
  }
  /** Commit the displayed draft and rename/reorder as one local publication. */
  actWithDraft(
    binding: PlanBinding,
    action: Extract<ManualPlanAction, { kind: "rename" | "move" }>,
  ): ManualPlan {
    const p = this.current(binding);
    if (p.id !== this.activeId) throw new Error("Plan nicht mehr ausgewählt.");
    const draft = this.draftValue;
    const selection = this.sceneId;
    const baseline = new Map(this.plans);
    let staged = p;
    if (draft) {
      this.current(draft.binding);
      if (draft.binding.id !== p.id || draft.sceneId !== selection)
        throw new Error("Entwurf nicht mehr ausgewählt.");
      staged = this.apply(p, {
        kind: "edit",
        sceneId: draft.sceneId,
        fields: draft.fields,
      });
    }
    const next = this.apply(staged, action);
    const prospective = new Map(baseline);
    prospective.set(p.id, next);
    this.assertUniqueScenes(prospective);
    this.current(binding);
    if (
      this.activeId !== p.id ||
      this.sceneId !== selection ||
      this.draftValue !== draft ||
      this.plans.size !== baseline.size ||
      [...baseline].some(([id, plan]) => this.plans.get(id) !== plan)
    )
      throw new Error("Plan geändert. Entwurf behalten.");
    this.plans = prospective;
    this.draftValue = null;
    return next;
  }
  deletePlan(binding: PlanBinding): void {
    const p = this.current(binding);
    const next = new Map(this.plans);
    next.delete(p.id);
    let fallback = next.keys().next().value ?? null;
    if (!fallback) {
      const replacement = newManualPlan(this.makeId());
      if (replacement.id === p.id) throw new Error("Kennung bereits belegt.");
      next.set(replacement.id, replacement);
      fallback = replacement.id;
    }
    this.assertUniqueScenes(next);
    this.plans = next;
    if (this.activeId === p.id) {
      this.activeId = fallback;
      this.sceneId = null;
      this.draftValue = null;
    }
  }
  switchPlan(id: CampaignLocalId): void {
    this.assertCurrent();
    if (!this.plans.has(id)) throw new Error("Zielplan fehlt.");
    if (this.activeId === id) return;
    this.commitDraft(); // Failure leaves the active pointer and original draft unchanged.
    this.activeId = id;
    this.sceneId = null;
  }
  selectScene(id: CampaignLocalId): void {
    this.assertCurrent();
    if (!this.active?.scenes.some((s) => s.id === id))
      throw new Error("Szene fehlt.");
    if (this.sceneId === id) return;
    this.commitDraft();
    this.sceneId = id;
  }
  editDraft(value: SceneFields): void {
    this.assertCurrent();
    if (
      !this.sceneId ||
      !this.active?.scenes.some((s) => s.id === this.sceneId)
    )
      throw new Error("Szene fehlt.");
    // Keep the original displayed revision across further keystrokes, even after a stale response.
    const binding = this.draftValue?.binding ?? this.binding();
    this.draftValue = Object.freeze({
      binding,
      sceneId: this.sceneId,
      fields: fields(value),
    });
  }
  commitDraft(): void {
    if (!this.draftValue) return;
    const d = this.draftValue;
    this.act(d.binding, { kind: "edit", sceneId: d.sceneId, fields: d.fields });
    this.draftValue = null;
  }
  discardDraft(): void {
    this.assertCurrent();
    this.draftValue = null;
  }
  addScene(binding: PlanBinding): ManualScene {
    const p = this.current(binding);
    if (binding.id !== this.activeId)
      throw new Error("Plan nicht mehr ausgewählt.");
    const draft = this.draftValue;
    const selection = this.sceneId;
    const scenes = [...p.scenes];
    if (draft) {
      this.current(draft.binding);
      const i = scenes.findIndex((s) => s.id === draft.sceneId);
      if (draft.binding.id !== p.id || i < 0 || draft.sceneId !== selection)
        throw new Error("Entwurf nicht mehr ausgewählt.");
      scenes[i] = scene({ id: draft.sceneId, ...draft.fields });
    }
    const s = scene({
      id: this.makeId(),
      title: "",
      notes: "",
      locationId: null,
    });
    // Stage both effects before publishing either: allocation, collisions and
    // revision exhaustion must leave the original authored draft untouched.
    const next = manualPlan({
      ...p,
      revision: p.revision + (draft ? 2 : 1),
      scenes: [...scenes, s],
    });
    const baseline = new Map(this.plans);
    const prospective = new Map(baseline);
    prospective.set(p.id, next);
    this.assertUniqueScenes(prospective);
    this.current(binding);
    if (
      this.activeId !== p.id ||
      this.sceneId !== selection ||
      this.draftValue !== draft ||
      this.plans.size !== baseline.size ||
      [...baseline].some(([id, plan]) => this.plans.get(id) !== plan)
    )
      throw new Error("Plan geändert. Entwurf behalten.");
    this.plans = prospective;
    this.draftValue = null;
    this.sceneId = s.id;
    return s;
  }
}
