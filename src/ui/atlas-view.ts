import { App, FileView, Modal, Notice, Setting, TFile } from "obsidian";
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
  onUnloadFile(): Promise<void> {
    this.generation++;
    return this.sequence(async () => {
      await this.closeEditor();
      this.contentEl.replaceChildren();
    });
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
