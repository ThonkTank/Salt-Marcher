// src/ui/workmode/create/demo.ts
// Reference implementation that showcases the shared Workmode create helpers.
import { App } from "obsidian";
import {
  BaseCreateModal,
  createFormCard,
  createIrregularGrid,
  createRepeatingGrid,
  mountEntryManager,
  type CreateModalPipeline,
  type ValidationRegistrar,
} from "./index";

export interface DemoEntry {
  category: "info" | "note";
  title: string;
  description?: string;
}

export interface DemoDraft {
  name: string;
  summary?: string;
  tags: string[];
  entries: DemoEntry[];
}

const DEMO_CATEGORIES = [
  { id: "info" as const, label: "Info" },
  { id: "note" as const, label: "Notiz" },
];

/**
 * Opens a demo modal that demonstrates the shared Workmode create infrastructure.
 */
export function openWorkmodeCreateDemo(
  app: App,
  pipeline: CreateModalPipeline<DemoDraft, DemoDraft, void>
): void {
  new DemoCreateModal(app, pipeline).open();
}

class DemoCreateModal extends BaseCreateModal<DemoDraft, DemoDraft, void> {
  constructor(app: App, pipeline: CreateModalPipeline<DemoDraft, DemoDraft, void>) {
    super(app, undefined, {
      title: "Demo-Eintrag anlegen",
      subtitle: "Zeigt, wie Abschnitte, Grids und Entry-Listen zusammenspielen.",
      defaultName: "Neuer Demo-Eintrag",
      submitButtonText: "Speichern",
      cancelButtonText: "Abbrechen",
      enableNavigation: true,
      pipeline,
      sections: [
        {
          id: "demo-basics",
          title: "Grunddaten",
          subtitle: "Name und Beschreibung der Demo-Entität",
          mount: (handles) => this.mountBasics(handles.body),
        },
        {
          id: "demo-entries",
          title: "Teilabschnitte",
          subtitle: "Einträge mit identischem Layout wie in der Library",
          mount: (handles) => this.mountEntries(handles.body, handles.registerValidation),
        },
      ],
    });
  }

  protected createDefault(name: string): DemoDraft {
    return { name, summary: "", tags: [], entries: [] };
  }

  protected buildFields(): void {
    // Sections render their own content via navigation config
  }

  private mountBasics(container: HTMLElement): void {
    const card = createFormCard(container, { title: "Stammdaten" });
    const grid = createIrregularGrid(card.body, {
      columns: ["minmax(0, 1fr)", "minmax(0, 1fr)"],
    });

    const nameSetting = grid.createCell().createDiv({ cls: "setting-item" });
    nameSetting.createDiv({ cls: "setting-item-info", text: "Name" });
    const nameControl = nameSetting.createDiv({ cls: "setting-item-control" });
    const nameInput = nameControl.createEl("input", { attr: { type: "text", placeholder: "Titel" } }) as HTMLInputElement;
    nameInput.value = this.data.name;
    nameInput.addEventListener("input", () => {
      this.data.name = nameInput.value.trim();
    });

    const summarySetting = grid.createCell().createDiv({ cls: "setting-item" });
    summarySetting.createDiv({ cls: "setting-item-info", text: "Kurzbeschreibung" });
    const summaryControl = summarySetting.createDiv({ cls: "setting-item-control" });
    const summaryInput = summaryControl.createEl("textarea", { attr: { rows: "3", placeholder: "Was beschreibt dieser Eintrag?" } }) as HTMLTextAreaElement;
    summaryInput.value = this.data.summary ?? "";
    summaryInput.addEventListener("input", () => {
      this.data.summary = summaryInput.value.trim() || undefined;
    });

    const tagCard = createFormCard(container, { title: "Tags" });
    const tags = this.data.tags;
    const renderTags = () => {
      tagCard.body.empty();
      const list = createRepeatingGrid(tagCard.body, {
        className: "sm-cc-field-grid",
        itemClassName: "sm-cc-setting",
      });
      tags.forEach((tag, index) => {
        const setting = list.createItem().createDiv({ cls: "setting-item" });
        setting.createDiv({ cls: "setting-item-info", text: `Tag ${index + 1}` });
        const control = setting.createDiv({ cls: "setting-item-control" });
        const input = control.createEl("input", { attr: { type: "text" } }) as HTMLInputElement;
        input.value = tag;
        input.addEventListener("input", () => {
          tags[index] = input.value.trim();
        });
      });
      const actions = tagCard.body.createDiv({ cls: "sm-cc-tag-actions" });
      const addButton = actions.createEl("button", { attr: { type: "button" }, text: "+ Tag hinzufügen" });
      addButton.addEventListener("click", () => {
        tags.push("");
        renderTags();
      });
    };
    renderTags();
  }

  private mountEntries(
    container: HTMLElement,
    registerValidation: ValidationRegistrar
  ): void {
    if (!this.data.entries) this.data.entries = [];

    mountEntryManager<DemoEntry, DemoEntry["category"], DemoEntry["category"]>(container, {
      label: "Abschnitte",
      entries: this.data.entries,
      categories: DEMO_CATEGORIES,
      filters: DEMO_CATEGORIES.map((category) => ({
        id: category.id,
        label: category.label,
        predicate: (entry) => entry.category === category.id,
      })),
      createEntry: (category) => ({ category, title: "", description: "" }),
      registerValidation,
      collectIssues: (entries) =>
        entries
          .map((entry, index) =>
            entry.title?.trim() ? null : `Eintrag ${index + 1} benötigt einen Titel.`
          )
          .filter((message): message is string => Boolean(message)),
      renderEntry: (host, context) => {
        const card = host.createDiv({ cls: "sm-cc-entry-card" });
        const head = card.createDiv({ cls: "sm-cc-entry-head" });
        head.createEl("span", { cls: `sm-cc-entry-badge sm-cc-entry-badge--${context.entry.category}`, text: context.entry.category.toUpperCase() });
        const nameInput = head.createEl("input", { attr: { type: "text", placeholder: "Titel" }, cls: "sm-cc-entry-name" }) as HTMLInputElement;
        nameInput.value = context.entry.title;
        nameInput.addEventListener("input", () => {
          context.entry.title = nameInput.value;
          context.requestRender();
        });
        if (context.shouldFocus) nameInput.focus();

        const actions = head.createDiv({ cls: "sm-cc-entry-actions" });
        const up = actions.createEl("button", { cls: "sm-cc-entry-move-btn", attr: { type: "button", "aria-label": "Nach oben", disabled: context.canMoveUp ? undefined : "true" } });
        up.addEventListener("click", context.moveUp);
        const down = actions.createEl("button", { cls: "sm-cc-entry-move-btn", attr: { type: "button", "aria-label": "Nach unten", disabled: context.canMoveDown ? undefined : "true" } });
        down.addEventListener("click", context.moveDown);
        const remove = actions.createEl("button", { cls: "sm-cc-entry-delete", attr: { type: "button", "aria-label": "Löschen" }, text: "✕" });
        remove.addEventListener("click", context.remove);

        const body = card.createDiv({ cls: "sm-cc-entry-body" });
        const description = body.createEl("textarea", { attr: { rows: "3", placeholder: "Beschreibung" } }) as HTMLTextAreaElement;
        description.value = context.entry.description ?? "";
        description.addEventListener("input", () => {
          context.entry.description = description.value.trim() || undefined;
        });
        return card;
      },
    });
  }
}
