import type { CampaignLocalId } from "../features/campaign/campaign-contracts";
import { ManualPlanner } from "../features/planner/manual-planner";
export interface PlannerLocation {
  readonly id: CampaignLocalId;
  readonly name: string;
}
/** Host-neutral manual editor. Not mounted by the plugin until Campaign storage is authorized. */
export class ManualPlannerPanel {
  private readonly root: HTMLElement;
  private readonly status: HTMLElement;
  private destroyed = false;
  private renderEpoch = 0;
  constructor(
    host: HTMLElement,
    private readonly planner: ManualPlanner,
    private readonly locations: readonly PlannerLocation[] = [],
  ) {
    const doc = host.ownerDocument;
    this.root = doc.createElement("section");
    this.root.setAttribute("aria-label", "Sessionplanung");
    this.root.className = "dn-manual-planner";
    this.status = doc.createElement("p");
    this.status.setAttribute("role", "status");
    host.append(this.root);
    this.render();
  }
  private run(action: () => void): void {
    if (this.destroyed) return;
    try {
      action();
      this.render();
    } catch (e) {
      this.status.textContent =
        e instanceof Error
          ? e.message
          : "Aktion fehlgeschlagen. Entwurf bleibt erhalten.";
    }
  }
  private button(
    parent: HTMLElement,
    text: string,
    action: () => void,
    disabled = false,
  ): void {
    const b = this.root.ownerDocument.createElement("button");
    b.type = "button";
    const epoch = this.renderEpoch;
    b.textContent = text;
    b.disabled = disabled;
    b.addEventListener("click", () =>
      this.run(() => {
        if (epoch !== this.renderEpoch)
          throw new Error("Ansicht geändert. Aktuelle Aktion verwenden.");
        action();
      }),
    );
    parent.append(b);
  }
  private label(parent: HTMLElement, name: string, input: HTMLElement): void {
    const l = this.root.ownerDocument.createElement("label");
    l.textContent = name;
    input.setAttribute("aria-label", name);
    l.append(input);
    parent.append(l);
  }
  private render(): void {
    this.renderEpoch++;
    this.root.replaceChildren();
    const doc = this.root.ownerDocument;
    const toolbar = doc.createElement("div");
    toolbar.style.display = "flex";
    toolbar.style.flexWrap = "wrap";
    toolbar.style.gap = "0.5rem";
    this.root.append(toolbar);
    this.button(toolbar, "Neuer Plan", () => {
      this.planner.create();
    });
    const select = doc.createElement("select");
    for (const p of this.planner.catalog) {
      const o = doc.createElement("option");
      o.value = p.id;
      o.textContent = p.name || "Unbenannter Plan";
      select.append(o);
    }
    const selectedOption = [...select.options].find(
      (o) => o.value === this.planner.active?.id,
    );
    if (selectedOption) selectedOption.selected = true;
    this.label(toolbar, "Plan", select);
    const epoch = this.renderEpoch;
    select.addEventListener("change", () => {
      this.run(() => {
        if (epoch !== this.renderEpoch) throw new Error("Ansicht geändert.");
        this.planner.switchPlan(select.value as CampaignLocalId);
      });
      const currentOption = [...select.options].find(
        (o) => o.value === this.planner.active?.id,
      );
      if (currentOption) currentOption.selected = true;
    });
    const plan = this.planner.active;
    if (plan) {
      const binding = this.planner.binding();
      const name = doc.createElement("input");
      name.value = plan.name;
      name.placeholder = "Unbenannter Plan";
      this.label(toolbar, "Planname", name);
      this.button(toolbar, "Umbenennen", () => {
        // Draft commit changes the revision; bind rename to the ensuing same plan only.
        if (
          this.planner.binding().id !== binding.id ||
          this.planner.binding().revision !== binding.revision
        )
          throw new Error("Plan geändert. Erneut öffnen.");
        this.planner.commitDraft();
        this.planner.act(this.planner.binding(), {
          kind: "rename",
          name: name.value,
        });
      });
      this.button(toolbar, "Plan löschen", () =>
        this.planner.deletePlan(binding),
      );
      this.button(toolbar, "Szene hinzufügen", () => {
        this.planner.addScene(binding);
      });
      const list = doc.createElement("ol");
      this.root.append(list);
      for (const s of plan.scenes) {
        const li = doc.createElement("li");
        li.dataset.sceneId = s.id;
        this.button(li, s.title || "Unbenannte Szene", () =>
          this.planner.selectScene(s.id),
        );
        list.append(li);
      }
      const s = plan.scenes.find((s) => s.id === this.planner.selectedSceneId);
      if (s) {
        const inspector = doc.createElement("div");
        this.root.append(inspector);
        const value = this.planner.draft?.fields ?? s;
        const title = doc.createElement("input");
        title.value = value.title;
        this.label(inspector, "Szenentitel", title);
        const notes = doc.createElement("textarea");
        notes.value = value.notes;
        notes.rows = 8;
        notes.style.width = "100%";
        notes.style.boxSizing = "border-box";
        this.label(inspector, "Notizen", notes);
        const location = doc.createElement("select");
        const empty = doc.createElement("option");
        empty.value = "";
        empty.textContent = "Ohne Ort";
        location.append(empty);
        for (const row of this.locations) {
          const o = doc.createElement("option");
          o.value = row.id;
          o.textContent = row.name;
          location.append(o);
        }
        if (
          value.locationId &&
          !this.locations.some((l) => l.id === value.locationId)
        ) {
          const o = doc.createElement("option");
          o.value = value.locationId;
          o.textContent = "Ort derzeit nicht verfügbar";
          location.append(o);
        }
        const locationOption = [...location.options].find(
          (o) => o.value === (value.locationId ?? ""),
        );
        if (locationOption) locationOption.selected = true;
        this.label(inspector, "Ort (optional)", location);
        const edit = () =>
          this.runInput(() => {
            if (epoch !== this.renderEpoch)
              throw new Error("Ansicht geändert. Entwurf nicht umgeleitet.");
            this.planner.editDraft({
              title: title.value,
              notes: notes.value,
              locationId: (location.value || null) as CampaignLocalId | null,
            });
          });
        title.addEventListener("input", edit);
        notes.addEventListener("input", edit);
        location.addEventListener("change", edit);
        this.button(inspector, "Entwurf übernehmen", () =>
          this.planner.commitDraft(),
        );
        this.button(inspector, "Entwurf verwerfen", () =>
          this.planner.discardDraft(),
        );
        for (const [text, direction] of [
          ["Szene nach oben", -1],
          ["Szene nach unten", 1],
        ] as const)
          this.button(
            inspector,
            text,
            () => {
              if (
                this.planner.binding().id !== binding.id ||
                this.planner.binding().revision !== binding.revision
              )
                throw new Error("Plan geändert. Entwurf behalten.");
              this.planner.commitDraft();
              this.planner.act(this.planner.binding(), {
                kind: "move",
                sceneId: s.id,
                direction,
              });
            },
            direction === -1
              ? plan.scenes[0]?.id === s.id
              : plan.scenes.at(-1)?.id === s.id,
          );
        this.button(inspector, "Szene löschen", () => {
          this.planner.act(binding, { kind: "remove", sceneId: s.id });
          this.planner.discardDraft();
        });
      }
    }
    const help = doc.createElement("p");
    help.textContent =
      "Plan und Szenen sind auch ohne Party oder Ort bearbeitbar. Notizen gehören nur zu diesem Plan. Dieser Entwurf ist noch nicht dauerhaft gespeichert.";
    this.root.append(help);
    this.status.textContent = "";
    this.root.append(this.status);
  }
  private runInput(action: () => void): void {
    if (this.destroyed) return;
    // Preserve inspector focus/caret while typing and while a stale draft is displayed.
    try {
      action();
      this.status.textContent = "Entwurf geändert.";
    } catch (e) {
      this.status.textContent =
        e instanceof Error ? e.message : "Entwurf nicht übernommen.";
    }
  }
  destroy(): void {
    this.destroyed = true;
    this.root.remove();
  }
}
