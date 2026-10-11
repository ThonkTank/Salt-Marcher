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
  private readonly help: HTMLDetailsElement;
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
    this.help = doc.createElement("details");
    const summary = doc.createElement("summary");
    summary.textContent = "Hilfe zur Sessionplanung";
    this.help.append(summary);
    for (const text of [
      "Mit „Neuer Plan“ beginnst du ohne Namen, Datum oder Party. Füge Szenen hinzu und wähle sie in der Liste, um Titel und Notizen zu bearbeiten. Ein Ort ist freiwillig; der ausgewählte Ort selbst wird nicht verändert.",
      "„Entwurf übernehmen“ übernimmt deine Eingaben. Beim Plan- oder Szenenwechsel, Umbenennen und Verschieben werden offene Eingaben ebenfalls übernommen. „Entwurf verwerfen“ verwirft nur die offenen Eingaben; „Szene löschen“ oder „Plan löschen“ entfernt dagegen die Szene beziehungsweise den ganzen Plan.",
      "Bei einer Fehlermeldung bleiben deine Eingaben erhalten. „Ansicht aktualisieren“ zeigt den aktuellen Plan, ohne einen Entwurf zu übernehmen oder zu verwerfen.",
      "Mit Tab erreichst du Felder und Aktionen, mit Umschalt+Tab gehst du zurück. Enter oder Leertaste aktiviert Schaltflächen; nach der Szenenauswahl geht der Fokus zum Titel, danach mit Tab zu den Notizen.",
    ]) {
      const paragraph = doc.createElement("p");
      paragraph.textContent = text;
      this.help.append(paragraph);
    }
    host.append(this.root);
    this.render();
  }
  private run(
    action: () => void,
    focusSceneTitle = false,
    unsubmittedPlanName?: string,
    retainPlanName = false,
    focusAfter?: () => void,
  ): void {
    if (this.destroyed) return;
    try {
      const planId = this.planner.active?.id,
        typedName = retainPlanName
          ? this.root.querySelector<HTMLInputElement>('[aria-label="Planname"]')?.value
          : undefined;
      action();
      this.render();
      const retainedName = unsubmittedPlanName ??
        (planId !== undefined && this.planner.active?.id === planId ? typedName : undefined);
      if (retainedName !== undefined) {
        const name = this.root.querySelector<HTMLInputElement>('[aria-label="Planname"]');
        if (name) name.value = retainedName;
      }
      // Scene buttons are replaced by render. Hand successful selection to the
      // editor; stale/failed actions never render or redirect keyboard focus.
      if (focusSceneTitle)
        this.root
          .querySelector<HTMLInputElement>('[aria-label="Szenentitel"]')
          ?.focus();
      else focusAfter?.();
    } catch (e) {
      this.status.textContent =
        e instanceof Error
          ? e.message
          : "Aktion fehlgeschlagen. Entwurf bleibt erhalten.";
    }
  }
  /** Bind every DOM callback to the displayed workspace, including external selection changes. */
  private displayedGuard(): () => void {
    const epoch = this.renderEpoch;
    const plan = this.planner.active;
    const sceneId = this.planner.selectedSceneId;
    return () => {
      const current = this.planner.active;
      if (
        epoch !== this.renderEpoch ||
        current?.id !== plan?.id ||
        current?.revision !== plan?.revision ||
        this.planner.selectedSceneId !== sceneId
      )
        throw new Error(
          "Ansicht geändert. Entwurf behalten; aktuelle Aktion verwenden.",
        );
    };
  }
  private button(
    parent: HTMLElement,
    text: string,
    action: () => void,
    disabled = false,
    focusSceneTitle = false,
  ): void {
    const doc = this.root.ownerDocument;
    const b = doc.createElement("button");
    b.type = "button";
    const assertDisplayed = this.displayedGuard();
    b.textContent = text;
    b.disabled = disabled;
    if (!focusSceneTitle) b.dataset.plannerAction = text;
    b.addEventListener("click", () => {
      const wasFocused = doc.activeElement === b;
      this.run(() => {
        assertDisplayed();
        action();
      }, focusSceneTitle, undefined, true, () => {
        if (!wasFocused) return;
        // Rendering removes the invoking control. Continue keyboard navigation
        // on its replacement; a move at the boundary may disable that action.
        const replacement = [...this.root.querySelectorAll("button")].find(
          (button) => button.dataset.plannerAction === text && !button.disabled,
        );
        const target = replacement ??
          this.root.querySelector<HTMLElement>('[aria-label="Szenentitel"]') ??
          this.root.querySelector<HTMLElement>('[aria-label="Planname"]');
        target?.focus();
      });
    });
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
    // Refresh only the view: stale workspace guards must not prevent recovery,
    // and refreshing must never commit, discard or rebind an authored draft.
    const refresh = doc.createElement("button");
    refresh.type = "button";
    refresh.textContent = "Ansicht aktualisieren";
    refresh.title = "Aktuellen Plan anzeigen; Entwürfe bleiben erhalten.";
    const displayedPlan = this.planner.active;
    refresh.addEventListener("click", () => {
      // Refresh is view-only: retain typed name only against the same immutable
      // displayed plan, never rebase an old name onto an external revision/selection.
      const name = this.planner.active === displayedPlan
        ? this.root.querySelector<HTMLInputElement>('[aria-label="Planname"]')?.value
        : undefined;
      this.run(() => {}, false, name);
    });
    toolbar.append(refresh);
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
    const assertDisplayed = this.displayedGuard();
    select.addEventListener("change", () => {
      this.run(() => {
        assertDisplayed();
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
        this.planner.actWithDraft(binding, {
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
        this.button(
          li,
          s.title || "Unbenannte Szene",
          () => this.planner.selectScene(s.id),
          false,
          true,
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
            assertDisplayed();
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
              this.planner.actWithDraft(binding, {
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
    this.root.append(help, this.help);
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
