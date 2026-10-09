import { App, FileView, Menu, Modal, Notice, Setting, TFile } from "obsidian";
import { AtlasEditor } from "../features/atlas/atlas-editor";
import {
  newOverworld,
  serializeOverworld,
  type HexOrientation,
} from "../features/atlas/overworld";
import { VaultStore } from "../vault-stores";
import { FileConflict } from "../persistence";
import { AtlasRepository } from "../features/atlas/atlas-repository";

export const ATLAS_VIEW = "dungeon-native-atlas";
export class AtlasView extends FileView {
  private editor?: AtlasEditor;
  private repository?: AtlasRepository;
  private generation = 0;
  private lifecycle: Promise<void> = Promise.resolve();
  getViewType(): string {
    return ATLAS_VIEW;
  }
  getDisplayText(): string {
    return this.file?.basename ?? "Atlas";
  }
  getIcon(): string {
    return "globe";
  }
  onLoadFile(file: TFile): Promise<void> {
    const generation = ++this.generation;
    return this.sequence(async () => {
      if (generation !== this.generation) return;
      await this.closeEditor();
      if (generation === this.generation)
        await this.loadFileContent(file, generation);
    });
  }
  private sequence(action: () => Promise<void>): Promise<void> {
    const next = this.lifecycle.then(action);
    this.lifecycle = next.catch(() => {});
    return next;
  }
  private async closeEditor(): Promise<void> {
    if (this.editor) {
      try {
        await this.editor.flush();
        if (this.repository?.dirty || this.repository?.hasDraft)
          await this.repository.persistDraft();
      } catch (error) {
        new Notice(
          "Atlasentwurf konnte nicht gesichert werden. " + String(error),
        );
        throw error;
      }
      this.editor.destroy();
    }
    this.editor = undefined;
    this.repository = undefined;
  }
  private async loadFileContent(
    file: TFile,
    generation: number,
  ): Promise<void> {
    this.contentEl.replaceChildren();
    this.contentEl.createEl("p", { text: "Atlas wird geöffnet …" });
    try {
      const repository = new AtlasRepository(
        new VaultStore(this.app),
        file.path,
        this.app.vault,
      );
      const source = await repository.open();
      if (generation !== this.generation) return;
      this.repository = repository;
      this.editor = new AtlasEditor(this.contentEl, source.world, source, {
        save: () => repository.save(),
        changed: () => repository.persistDraft(),
        status: () => ({
          dirty: repository.dirty,
          hasDraft: repository.hasDraft,
        }),
        menu: (event) => this.showMenu(event, generation),
        discard: () => repository.discard(),
      });
      await this.editor.init();
    } catch (error) {
      if (generation !== this.generation) return;
      this.editor?.destroy();
      this.editor = undefined;
      this.contentEl.replaceChildren();
      this.contentEl.createEl("p", {
        text: "Atlas konnte nicht geöffnet werden. " + String(error),
      });
    }
  }
  private showMenu(event: MouseEvent, generation: number): void {
    const editor = this.editor,
      repository = this.repository;
    if (!editor || !repository || generation !== this.generation) return;
    const menu = new Menu();
    menu
      .addItem((item) =>
        item.setTitle("Speichern unter …").onClick((event) => {
          event.stopPropagation();
          menu.hide();
          new CopyAtlasModal(
            this.app,
            editor.terrain.world.name,
            async (name) => {
              if (generation !== this.generation || this.editor !== editor)
                throw new Error("Die Ausgangskarte ist nicht mehr geöffnet.");
              await editor.flush();
              if (generation !== this.generation || this.editor !== editor)
                throw new Error("Die Ausgangskarte ist nicht mehr geöffnet.");
              const path = `Atlanten/${name}.overworld`;
              await repository.copy(path, crypto.randomUUID(), name);
              return async () => {
                if (generation !== this.generation || this.editor !== editor)
                  return;
                const file = this.app.vault.getAbstractFileByPath(path);
                if (!(file instanceof TFile))
                  throw new Error("Gespeicherte Kopie wurde nicht gefunden.");
                await this.leaf.openFile(file);
              };
            },
          ).open();
        }),
      )
      .addItem((item) =>
        item
          .setTitle("Entwurf verwerfen …")
          .setDisabled(!repository.dirty && !repository.hasDraft)
          .onClick((event) => {
            event.stopPropagation();
            menu.hide();
            new DiscardAtlasModal(this.app, () => {
              if (generation === this.generation && this.editor === editor)
                editor.discard();
            }).open();
          }),
      )
      .showAtMouseEvent(event);
  }
  onUnloadFile(): Promise<void> {
    this.generation++;
    return this.sequence(async () => {
      await this.closeEditor();
      this.contentEl.replaceChildren();
    });
  }
}
class CopyAtlasModal extends Modal {
  constructor(
    app: App,
    private originalName: string,
    private copy: (name: string) => Promise<() => Promise<void>>,
  ) {
    super(app);
  }
  onOpen(): void {
    this.setTitle("Atlas speichern unter");
    let name = this.originalName + " Kopie",
      busy = false;
    new Setting(this.contentEl).setName("Name").addText((text) => {
      text.setValue(name).onChange((value) => {
        name = value;
      });
      text.inputEl.setAttribute("aria-label", "Kopiename");
    });
    this.contentEl.createEl("p", {
      text: "Die Kopie kann unabhängig von der Ausgangskarte bearbeitet werden.",
    });
    new Setting(this.contentEl)
      .addButton((button) =>
        button.setButtonText("Abbrechen").onClick(() => {
          if (!busy) this.close();
        }),
      )
      .addButton((button) =>
        button
          .setButtonText("Kopie speichern")
          .setCta()
          .onClick(async () => {
            if (busy) return;
            const clean = name.trim();
            if (
              !clean ||
              clean === "." ||
              clean === ".." ||
              /[\\/:*?"<>|]/.test(clean) ||
              clean.length > 200
            ) {
              new Notice(
                "Einen Atlasnamen ohne Pfad- oder Sonderzeichen eingeben.",
              );
              return;
            }
            busy = true;
            button.setDisabled(true);
            try {
              const open = await this.copy(clean);
              this.close();
              try {
                await open();
              } catch (error) {
                new Notice(
                  "Kopie ist gespeichert; Öffnen fehlgeschlagen. " +
                    String(error),
                );
              }
            } catch (error) {
              new Notice(
                error instanceof FileConflict
                  ? "Ein Atlas mit diesem Namen oder Zielinhalt ist bereits vorhanden. Einen anderen Namen wählen."
                  : "Kopie konnte nicht gespeichert werden. " + String(error),
              );
            } finally {
              busy = false;
              button.setDisabled(false);
            }
          }),
      );
  }
  onClose(): void {
    this.contentEl.empty();
  }
}
class DiscardAtlasModal extends Modal {
  constructor(
    app: App,
    private discard: () => void,
  ) {
    super(app);
  }
  onOpen(): void {
    this.setTitle("Atlasentwurf verwerfen");
    this.contentEl.createEl("p", {
      text: "Zur letzten Speicherung zurückkehren? Ungespeicherte Änderungen werden verworfen.",
    });
    new Setting(this.contentEl)
      .addButton((button) =>
        button.setButtonText("Abbrechen").onClick(() => this.close()),
      )
      .addButton((button) =>
        button
          .setButtonText("Entwurf verwerfen")
          .setWarning()
          .onClick(() => {
            this.close();
            this.discard();
          }),
      );
  }
  onClose(): void {
    this.contentEl.empty();
  }
}
export class CreateAtlasModal extends Modal {
  constructor(
    app: App,
    private created: (path: string) => Promise<void>,
  ) {
    super(app);
  }
  onOpen(): void {
    this.setTitle("Atlas anlegen");
    let name = "Neue Welt",
      orientation: HexOrientation = "pointy",
      busy = false;
    new Setting(this.contentEl).setName("Name").addText((text) => {
      text.setValue(name).onChange((value) => {
        name = value;
      });
      text.inputEl.setAttribute("aria-label", "Atlasname");
    });
    new Setting(this.contentEl)
      .setName("Hex-Ausrichtung")
      .addDropdown((dropdown) => {
        dropdown
          .addOptions({ pointy: "Spitze oben", flat: "Flache Seite oben" })
          .setValue(orientation)
          .onChange((value) => {
            orientation = value as HexOrientation;
          });
        dropdown.selectEl.setAttribute("aria-label", "Hex-Ausrichtung");
      });
    this.contentEl.createEl("p", {
      text: "Der Atlas wächst mit seinem Inhalt. Die kleinsten Hexes sind 3 Meilen groß.",
    });
    new Setting(this.contentEl).addButton((button) =>
      button
        .setButtonText("Atlas anlegen")
        .setCta()
        .onClick(async () => {
          if (busy) return;
          const clean = name.trim();
          if (
            !clean ||
            clean === "." ||
            clean === ".." ||
            /[\\/:*?"<>|]/.test(clean) ||
            clean.length > 200
          ) {
            new Notice(
              "Einen Atlasnamen ohne Pfad- oder Sonderzeichen eingeben.",
            );
            return;
          }
          const path = `Atlanten/${clean}.overworld`;
          busy = true;
          button.setDisabled(true);
          let saved = false;
          try {
            const folder = this.app.vault.getAbstractFileByPath("Atlanten");
            if (folder instanceof TFile)
              throw new Error("„Atlanten“ ist bereits eine Datei.");
            await new VaultStore(this.app).compareAndWrite(
              path,
              null,
              serializeOverworld(
                newOverworld(crypto.randomUUID(), clean, orientation),
              ),
            );
            saved = true;
            await this.created(path);
            this.close();
          } catch (error) {
            if (!saved && error instanceof FileConflict) {
              new Notice(
                "Ein Atlas mit diesem Namen ist bereits vorhanden. Einen anderen Namen wählen.",
              );
            } else {
              new Notice(
                (saved
                  ? "Atlas ist gespeichert; Öffnen fehlgeschlagen. "
                  : "Atlas konnte nicht angelegt werden. ") + String(error),
              );
            }
            if (saved) this.close();
          } finally {
            busy = false;
            button.setDisabled(false);
          }
        }),
    );
  }
  onClose(): void {
    this.contentEl.empty();
  }
}
