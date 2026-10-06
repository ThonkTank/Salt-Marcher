import { App, Modal, Notice, Setting } from "obsidian";
import { type FeatureDefinition, type FeatureOccurrence, type DungeonRoute, type FeatureKind, type Room, isRoom, isStructuredRoom } from "../model";
import { Session } from "../session";
import { MapRepository } from "../persistence";
import { analyzeDungeon, archiveDefinition, archiveOccurrence, archiveRoute, createFeatureDefinition, createFeatureOccurrence, structuredFeatureText, createRoute, restoreArchive, updateFeatureDefinition, updateFeatureOccurrence, updateFeatureQuantity, updateRoute, type FeatureDefinitionInput } from "../content";

class FeatureDefinitionModal extends Modal {
  constructor(
    app: App,
    private session: Session,
    private repository: MapRepository,
    private done: () => void,
    private definition?: FeatureDefinition,
  ) {
    super(app);
  }
  onOpen(): void {
    this.titleEl.setText(
      this.definition ? "Feature-Definition bearbeiten" : "Feature definieren",
    );
    this.contentEl.replaceChildren();
    const value: FeatureDefinitionInput = {
      name: this.definition?.name ?? "",
      kind: this.definition?.kind ?? "feature",
      xp: this.definition?.xp ?? 0,
      lootValue: this.definition?.lootValue ?? 0,
      encounter: this.definition?.encounter ?? "",
      description: this.definition?.description ?? "",
      reference: this.definition?.reference ?? "",
      encounterLink: this.definition?.encounterLink ?? "",
    };
    new Setting(this.contentEl)
      .setName("Name")
      .addText((input) =>
        input
          .setValue(value.name)
          .onChange((name) => Object.assign(value, { name })),
      );
    new Setting(this.contentEl).setName("Art").addDropdown((dropdown) =>
      dropdown
        .addOption("feature", "Feature")
        .addOption("creature", "Kreatur")
        .addOption("loot", "Beute")
        .addOption("trap", "Falle")
        .setValue(value.kind)
        .onChange((kind) =>
          Object.assign(value, { kind: kind as FeatureKind }),
        ),
    );
    for (const [name, key] of [
      ["XP je Vorkommen", "xp"],
      ["Beutewert je Vorkommen", "lootValue"],
    ] as const)
      new Setting(this.contentEl)
        .setName(name)
        .addText((input) =>
          input
            .setValue(String(value[key]))
            .onChange((text) => Object.assign(value, { [key]: Number(text) })),
        );
    if (this.session.version === 3) new Setting(this.contentEl)
      .setName("Beschreibung")
      .setDesc("Erscheint als Fließtext im Raum-Key.")
      .addTextArea((input) =>
        input
          .setValue(value.description ?? "")
          .onChange((description) => Object.assign(value, { description })),
      );
    new Setting(this.contentEl)
      .setName("Encounter")
      .setDesc(
        "Gleicher Name fasst mehrere Definitionen zu einem Encounter zusammen.",
      )
      .addText((input) =>
        input
          .setValue(value.encounter ?? "")
          .onChange((encounter) => Object.assign(value, { encounter })),
      );
    new Setting(this.contentEl)
      .setName("Encounter-Link")
      .setDesc("Wiki-Link oder URL zur Encounter-Auswertung.")
      .addText((input) =>
        input
          .setValue(value.encounterLink ?? "")
          .onChange((encounterLink) => Object.assign(value, { encounterLink })),
      );
    new Setting(this.contentEl)
      .setName("Regel- oder Profilverweis")
      .setDesc("Wiki-Link oder URL zu ausführlichen Regeln.")
      .addText((input) =>
        input
          .setValue(value.reference ?? "")
          .onChange((reference) => Object.assign(value, { reference })),
      );
    new Setting(this.contentEl).addButton((button) =>
      button
        .setButtonText("Übernehmen")
        .setCta()
        .onClick(async () => {
          button.setDisabled(true);
          try {
            if (this.definition) {
              const paths = new Set(
                this.session.content.occurrences
                  .filter((value) => value.definitionId === this.definition!.id)
                  .flatMap((value) => value.note ? [value.note.path] : []),
              );
              for (const path of paths)
                if (this.session.note(path) === undefined)
                  await this.repository.loadNote(this.session, path);
              updateFeatureDefinition(this.session, this.definition.id, value);
            } else createFeatureDefinition(this.session, value);
            this.done();
            this.close();
          } catch (error) {
            new Notice(String(error));
            button.setDisabled(false);
          }
        }),
    );
  }
  onClose(): void {
    this.contentEl.replaceChildren();
  }
}
class FeatureOccurrenceModal extends Modal {
  constructor(
    app: App,
    private session: Session,
    private repository: MapRepository,
    private floorId: string,
    private done: () => void,
    private selectedId?: string,
    private initialDefinitionId?: string,
    private occurrence?: FeatureOccurrence,
  ) {
    super(app);
  }
  onOpen(): void {
    this.titleEl.setText(
      this.occurrence
        ? "Feature-Vorkommen bearbeiten"
        : "Feature-Vorkommen anlegen",
    );
    this.contentEl.replaceChildren();
    const definitions = this.session.content.definitions,
      rooms = [...this.session.entities.values()].filter(
        (entity): entity is Room =>
          isRoom(entity) &&
          (entity.floorId === this.floorId ||
            entity.id === this.occurrence?.roomId),
      ),
      selected = this.selectedId
        ? this.session.entities.get(this.selectedId)
        : undefined,
      selectedRoomId =
        isRoom(selected) ? selected.id : selected?.roomId,
      value = {
        definitionId:
          this.occurrence?.definitionId ??
          this.initialDefinitionId ??
          definitions[0]?.id ??
          "",
        roomId:
          this.occurrence?.roomId ??
          (selectedRoomId && rooms.some((room) => room.id === selectedRoomId)
            ? selectedRoomId
            : rooms[0]?.id) ??
          "",
        quantity: this.occurrence?.quantity ?? 1,
        situation: this.occurrence?.situation ?? "",
        reaction: this.occurrence?.reaction ?? "",
        markdown: this.occurrence && this.session.version === 4
          ? structuredFeatureText(this.session, this.occurrence) : "",
        sectionId: "",
      };
    if (!definitions.length || !rooms.length) {
      this.contentEl.createEl("p", {
        text: !definitions.length
          ? "Zuerst eine Feature-Definition anlegen."
          : "Auf diesem Geschoss gibt es noch keinen Raum.",
      });
      return;
    }
    new Setting(this.contentEl)
      .setName("Definition")
      .addDropdown((dropdown) => {
        for (const definition of definitions)
          dropdown.addOption(definition.id, definition.name);
        dropdown
          .setValue(value.definitionId)
          .setDisabled(!!this.occurrence)
          .onChange((definitionId) => {
            value.definitionId = definitionId;
          });
      });
    const sectionRow = this.contentEl.createDiv({ cls: "dn-feature-section-choice" });
    const sectionLabel = sectionRow.createEl("label", { text: "Key-Abschnitt " });
    const sectionSelect = sectionLabel.createEl("select");
    sectionSelect.setAttribute("aria-label", "Key-Abschnitt");
    const refreshSections = () => {
      sectionRow.hidden = this.session.version !== 4 || !!this.occurrence;
      sectionSelect.replaceChildren();
      sectionSelect.createEl("option", { text: "Neuer Abschnitt", value: "" });
      const room = this.session.entities.get(value.roomId);
      if (isStructuredRoom(room)) for (const section of room.key.sections)
        if (section.kind === "markdown") sectionSelect.createEl("option", {
          text: section.markdown.match(/^#{1,6}\s+(.+)$/m)?.[1] ?? "Abschnitt",
          value: section.id,
        });
      value.sectionId = "";
    };
    new Setting(this.contentEl).setName("Fundort").addDropdown((dropdown) => {
      for (const room of rooms)
        dropdown.addOption(room.id, `${room.number} ${room.name}`);
      dropdown
        .setValue(value.roomId)
        .setDisabled(!!this.occurrence)
        .onChange((roomId) => {
          value.roomId = roomId;
          refreshSections();
        });
    });
    refreshSections();
    sectionSelect.addEventListener("change", () => { value.sectionId = sectionSelect.value; });
    new Setting(this.contentEl).setName("Menge").addText((input) =>
      input.setValue(String(value.quantity)).onChange((quantity) => {
        value.quantity = Number(quantity);
      }),
    );
    if (this.session.version === 4) new Setting(this.contentEl)
      .setName("Raumtext (Markdown)")
      .setDesc("Textansicht und Feature-Werkzeug bearbeiten denselben Abschnitt.")
      .addTextArea((input) => input.setValue(value.markdown)
        .onChange((markdown) => { value.markdown = markdown; }));
    if (this.session.version === 3) new Setting(this.contentEl)
      .setName("Aktuelle Situation")
      .setDesc("Kurzer, auswertungsrelevanter Zustand im Raum.")
      .addTextArea((input) =>
        input.setValue(value.situation).onChange((situation) => {
          value.situation = situation;
        }),
      );
    if (this.session.version === 3) new Setting(this.contentEl)
      .setName("Reaktion")
      .setDesc("Kurze Reaktion auf die Gruppe oder eine Auslösung.")
      .addTextArea((input) =>
        input.setValue(value.reaction).onChange((reaction) => {
          value.reaction = reaction;
        }),
      );
    this.contentEl.createEl("p", {
      text: this.session.version === 4
        ? "Der Text wird wortgleich im Raum-Key gespeichert. Ein ausgewähltes Kartenobjekt wird mit diesem Abschnitt verknüpft."
        : "Der Editor ergänzt im Raum-Key eine neue Überschrift und erzeugt einen nummerierten Marker. Ist bereits ein passendes Kartenobjekt ausgewählt, wird es stattdessen verknüpft.",
    });
    new Setting(this.contentEl).addButton((button) =>
      button
        .setButtonText(this.occurrence ? "Übernehmen" : "Vorkommen anlegen")
        .setCta()
        .onClick(async () => {
          button.setDisabled(true);
          try {
            const room = this.session.entities.get(value.roomId);
            if (!isRoom(room)) throw new Error("Raum nicht gefunden.");
            if (room.note && this.session.note(room.note.path) === undefined)
              await this.repository.loadNote(this.session, room.note.path);
            if (this.occurrence)
              updateFeatureOccurrence(this.session, this.occurrence.id, {
                quantity: value.quantity,
                situation: value.situation,
                reaction: value.reaction,
                ...(this.session.version === 4 ? { markdown: value.markdown } : {}),
              });
            else {
              const currentSelection = this.selectedId
                  ? this.session.entities.get(this.selectedId)
                  : undefined,
                linkedId =
                  currentSelection?.kind === "object" &&
                  (this.session.version === 4 || currentSelection.roomId === room.id)
                    ? currentSelection.id
                    : undefined;
              createFeatureOccurrence(
                this.session,
                value.definitionId,
                value.roomId,
                value.quantity,
                linkedId,
                { situation: value.situation, reaction: value.reaction },
                this.session.version === 4
                  ? { markdown: value.markdown, sectionId: value.sectionId || undefined }
                  : undefined,
              );
            }
            this.done();
            this.close();
          } catch (error) {
            new Notice(String(error));
            button.setDisabled(false);
          }
        }),
    );
  }
  onClose(): void {
    this.contentEl.replaceChildren();
  }
}
class DungeonRouteModal extends Modal {
  constructor(
    app: App,
    private session: Session,
    private done: () => void,
    private route?: DungeonRoute,
  ) {
    super(app);
  }
  onOpen(): void {
    this.titleEl.setText(
      this.route ? "Weg bearbeiten" : "Eingang oder Weg anlegen",
    );
    this.contentEl.replaceChildren();
    const rooms = [...this.session.entities.values()].filter(
        (entity): entity is Room => isRoom(entity),
      ),
      value: {
        name: string;
        entrance: boolean;
        fromRoomId?: string;
        toRoomId: string;
        prerequisites: string[];
        bossGoalOrder?: number;
      } = {
        name: this.route?.name ?? "",
        entrance: this.route?.entrance ?? true,
        fromRoomId: this.route?.fromRoomId,
        toRoomId: this.route?.toRoomId ?? rooms[0]?.id ?? "",
        prerequisites: [...(this.route?.prerequisites ?? [])],
        bossGoalOrder: this.route?.bossGoalOrder,
      };
    if (!rooms.length) {
      this.contentEl.createEl("p", {
        text: "Zuerst mindestens einen Raum anlegen.",
      });
      return;
    }
    new Setting(this.contentEl)
      .setName("Name")
      .addText((input) =>
        input.setValue(value.name).onChange((name) => (value.name = name)),
      );
    new Setting(this.contentEl)
      .setName("Eingang von außerhalb")
      .addToggle((toggle) =>
        toggle.setValue(value.entrance).onChange((entrance) => {
          value.entrance = entrance;
          if (entrance) value.fromRoomId = undefined;
        }),
      );
    new Setting(this.contentEl)
      .setName("Von")
      .setDesc("Bei einem Eingang kann dieser Wert leer bleiben.")
      .addDropdown((dropdown) => {
        dropdown.addOption("", "Außerhalb");
        for (const room of rooms)
          dropdown.addOption(room.id, `${room.number} ${room.name}`);
        dropdown.setValue(value.fromRoomId ?? "").onChange((fromRoomId) => {
          value.fromRoomId = fromRoomId || undefined;
          value.entrance = !fromRoomId;
        });
      });
    new Setting(this.contentEl).setName("Nach").addDropdown((dropdown) => {
      for (const room of rooms)
        dropdown.addOption(room.id, `${room.number} ${room.name}`);
      dropdown.setValue(value.toRoomId).onChange((toRoomId) => {
        value.toRoomId = toRoomId;
      });
    });
    new Setting(this.contentEl)
      .setName("Voraussetzungen")
      .setDesc("Eine Voraussetzung pro Zeile.")
      .addTextArea((input) =>
        input
          .setValue(value.prerequisites.join("\n"))
          .onChange((text) => (value.prerequisites = text.split(/\r?\n/))),
      );
    new Setting(this.contentEl)
      .setName("Bossziel-Reihenfolge")
      .setDesc("Leer lassen, wenn dieser Weg kein geordnetes Bossziel ist.")
      .addText((input) =>
        input
          .setValue(value.bossGoalOrder ? String(value.bossGoalOrder) : "")
          .onChange((text) => {
            value.bossGoalOrder = text.trim() ? Number(text) : undefined;
          }),
      );
    new Setting(this.contentEl).addButton((button) =>
      button
        .setButtonText("Übernehmen")
        .setCta()
        .onClick(() => {
          try {
            const route = {
              name: value.name,
              entrance: value.entrance,
              ...(value.fromRoomId ? { fromRoomId: value.fromRoomId } : {}),
              toRoomId: value.toRoomId,
              prerequisites: value.prerequisites,
              ...(value.bossGoalOrder
                ? { bossGoalOrder: value.bossGoalOrder }
                : {}),
            };
            if (this.route) updateRoute(this.session, this.route.id, route);
            else createRoute(this.session, route);
            this.done();
            this.close();
          } catch (error) {
            new Notice(String(error));
          }
        }),
    );
  }
  onClose(): void {
    this.contentEl.replaceChildren();
  }
}
export class DungeonContentModal extends Modal {
  constructor(
    app: App,
    private session: Session,
    private repository: MapRepository,
    private floorId: string,
    private selectedId?: string,
  ) {
    super(app);
  }
  onOpen(): void {
    this.render();
  }
  private render(): void {
    this.titleEl.setText("Dungeon-Inhalte");
    this.contentEl.replaceChildren();
    const content = this.session.content,
      analysis = analyzeDungeon(content),
      roomNames = new Map(
        [...this.session.entities.values()]
          .filter(isRoom)
          .map((room) => [room.id, `${room.number} ${room.name}`]),
      ),
      definitionNames = new Map(
        content.definitions.map((definition) => [
          definition.id,
          definition.name,
        ]),
      ),
      refresh = () => this.render();
    this.contentEl.createEl("p", {
      text:
        `${analysis.definitions.toLocaleString("de-DE")} Definitionen · ` +
        `${analysis.occurrences.toLocaleString("de-DE")} Vorkommen · ` +
        `${analysis.totalQuantity.toLocaleString("de-DE")} Gesamtmenge · ` +
        `${analysis.xp.toLocaleString("de-DE")} XP · ` +
        `${analysis.lootValue.toLocaleString("de-DE")} Beutewert`,
    });
    if (analysis.encounters.length)
      this.contentEl.createEl("p", {
        text:
          "Encounter: " +
          analysis.encounters
            .map(
              (encounter) =>
                `${encounter.name} (${encounter.quantity}×, ${encounter.xp.toLocaleString("de-DE")} XP)`,
            )
            .join(" · "),
      });
    if (analysis.bossGoals.length)
      this.contentEl.createEl("p", {
        text:
          "Bossziele: " +
          analysis.bossGoals
            .map((route) => `${route.bossGoalOrder}. ${route.name}`)
            .join(" → "),
      });
    const actions = new Setting(this.contentEl);
    actions.addButton((button) =>
      button
        .setButtonText("Definition anlegen")
        .setCta()
        .onClick(() =>
          new FeatureDefinitionModal(
            this.app,
            this.session,
            this.repository,
            refresh,
          ).open(),
        ),
    );
    actions.addButton((button) =>
      button
        .setButtonText("Vorkommen anlegen")
        .onClick(() =>
          new FeatureOccurrenceModal(
            this.app,
            this.session,
            this.repository,
            this.floorId,
            refresh,
            this.selectedId,
          ).open(),
        ),
    );
    actions.addButton((button) =>
      button
        .setButtonText("Eingang oder Weg")
        .onClick(() =>
          new DungeonRouteModal(this.app, this.session, refresh).open(),
        ),
    );
    this.contentEl.createEl("h3", { text: "Definitionen" });
    if (!content.definitions.length)
      this.contentEl.createEl("p", { text: "Noch keine Definitionen." });
    for (const definition of content.definitions) {
      const count = content.occurrences.filter(
          (occurrence) => occurrence.definitionId === definition.id,
        ).length,
        row = new Setting(this.contentEl)
          .setName(definition.name)
          .setDesc(
            `${definition.kind} · ${count} Vorkommen · ${definition.xp.toLocaleString("de-DE")} XP · ${definition.lootValue.toLocaleString("de-DE")} Beute` +
              (definition.encounter ? ` · ${definition.encounter}` : ""),
          );
      row.addExtraButton((button) => {
        button
          .setIcon("plus")
          .setTooltip("Vorkommen anlegen")
          .onClick(() =>
            new FeatureOccurrenceModal(
              this.app,
              this.session,
              this.repository,
              this.floorId,
              refresh,
              this.selectedId,
              definition.id,
            ).open(),
          );
        button.extraSettingsEl.setAttribute("aria-label", "Vorkommen anlegen");
      });
      row.addExtraButton((button) => {
        button
          .setIcon("pencil")
          .setTooltip("Definition bearbeiten")
          .onClick(() =>
            new FeatureDefinitionModal(
              this.app,
              this.session,
              this.repository,
              refresh,
              definition,
            ).open(),
          );
        button.extraSettingsEl.setAttribute(
          "aria-label",
          "Definition bearbeiten",
        );
      });
      row.addExtraButton((button) => {
        button
          .setIcon("archive")
          .setTooltip("Definition und Vorkommen archivieren")
          .onClick(() => {
            try {
              archiveDefinition(this.session, definition.id);
              refresh();
            } catch (error) {
              new Notice(String(error));
            }
          });
        button.extraSettingsEl.setAttribute(
          "aria-label",
          "Definition und Vorkommen archivieren",
        );
      });
    }
    this.contentEl.createEl("h3", { text: "Vorkommen" });
    if (!content.occurrences.length)
      this.contentEl.createEl("p", { text: "Noch keine Vorkommen." });
    for (const occurrence of content.occurrences) {
      const row = new Setting(this.contentEl)
        .setName(
          `${occurrence.marker} · ${definitionNames.get(occurrence.definitionId) ?? "Unbekannt"}`,
        )
        .setDesc(
          `${roomNames.get(occurrence.roomId) ?? occurrence.roomId} · Menge ${occurrence.quantity}`,
        );
      row.addExtraButton((button) => {
        button
          .setIcon("pencil")
          .setTooltip("Vorkommen bearbeiten")
          .onClick(() =>
            new FeatureOccurrenceModal(
              this.app,
              this.session,
              this.repository,
              this.floorId,
              refresh,
              this.selectedId,
              occurrence.definitionId,
              occurrence,
            ).open(),
          );
        button.extraSettingsEl.setAttribute(
          "aria-label",
          "Vorkommen bearbeiten",
        );
      });
      row.addExtraButton((button) => {
        button
          .setIcon("minus")
          .setTooltip("Menge verringern")
          .setDisabled(occurrence.quantity <= 1)
          .onClick(async () => {
            try {
              if (occurrence.note && this.session.note(occurrence.note.path) === undefined)
                await this.repository.loadNote(
                  this.session,
                  occurrence.note.path,
                );
              updateFeatureQuantity(
                this.session,
                occurrence.id,
                occurrence.quantity - 1,
              );
              refresh();
            } catch (error) {
              new Notice(String(error));
            }
          });
        button.extraSettingsEl.setAttribute("aria-label", "Menge verringern");
      });
      row.addExtraButton((button) => {
        button
          .setIcon("plus")
          .setTooltip("Menge erhöhen")
          .onClick(async () => {
            try {
              if (occurrence.note && this.session.note(occurrence.note.path) === undefined)
                await this.repository.loadNote(
                  this.session,
                  occurrence.note.path,
                );
              updateFeatureQuantity(
                this.session,
                occurrence.id,
                occurrence.quantity + 1,
              );
              refresh();
            } catch (error) {
              new Notice(String(error));
            }
          });
        button.extraSettingsEl.setAttribute("aria-label", "Menge erhöhen");
      });
      row.addExtraButton((button) => {
        button
          .setIcon("archive")
          .setTooltip("Vorkommen archivieren")
          .onClick(() => {
            archiveOccurrence(this.session, occurrence.id);
            refresh();
          });
        button.extraSettingsEl.setAttribute(
          "aria-label",
          "Vorkommen archivieren",
        );
      });
    }
    this.contentEl.createEl("h3", { text: "Eingänge, Wege und Bossziele" });
    if (!content.routes.length)
      this.contentEl.createEl("p", { text: "Noch keine Eingänge oder Wege." });
    for (const route of content.routes) {
      const from = route.entrance
          ? "Außerhalb"
          : (roomNames.get(route.fromRoomId!) ?? route.fromRoomId),
        desc =
          `${from} → ${roomNames.get(route.toRoomId) ?? route.toRoomId}` +
          (route.prerequisites.length
            ? ` · Voraussetzungen: ${route.prerequisites.join(", ")}`
            : "") +
          (route.bossGoalOrder ? ` · Bossziel ${route.bossGoalOrder}` : ""),
        row = new Setting(this.contentEl).setName(route.name).setDesc(desc);
      row.addExtraButton((button) => {
        button
          .setIcon("pencil")
          .setTooltip("Weg bearbeiten")
          .onClick(() =>
            new DungeonRouteModal(
              this.app,
              this.session,
              refresh,
              route,
            ).open(),
          );
        button.extraSettingsEl.setAttribute("aria-label", "Weg bearbeiten");
      });
      row.addExtraButton((button) => {
        button
          .setIcon("archive")
          .setTooltip("Weg archivieren")
          .onClick(() => {
            archiveRoute(this.session, route.id);
            refresh();
          });
        button.extraSettingsEl.setAttribute("aria-label", "Weg archivieren");
      });
    }
    this.contentEl.createEl("h3", { text: "Archiv" });
    if (!content.archive.length)
      this.contentEl.createEl("p", { text: "Das Archiv ist leer." });
    for (const bundle of content.archive)
      new Setting(this.contentEl)
        .setName(bundle.label)
        .setDesc(
          `${bundle.floors.length} Geschosse · ${bundle.definitions.length} Definitionen · ${bundle.occurrences.length} Vorkommen · ${bundle.routes.length} Wege · ${bundle.entities.length} Kartenobjekte`,
        )
        .addButton((button) =>
          button.setButtonText("Wiederherstellen").onClick(() => {
            try {
              restoreArchive(this.session, bundle.id);
              refresh();
            } catch (error) {
              new Notice(String(error));
            }
          }),
        );
  }
  onClose(): void {
    this.contentEl.replaceChildren();
  }
}
