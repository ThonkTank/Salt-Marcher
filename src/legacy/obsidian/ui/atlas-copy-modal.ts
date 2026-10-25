import { App, Modal, Notice, Setting } from "obsidian";
import { FileConflict } from "../../../persistence";
import type { AtlasRecovery } from "../../../features/atlas/file-transaction";

type OpenCopy = () => Promise<boolean>;
export class CopyAtlasModal extends Modal {
  private busy = false;
  constructor(
    app: App,
    private originalName: string,
    private copy: (name: string) => Promise<OpenCopy>,
    private recover: (name: string) => Promise<{
      state: AtlasRecovery;
      open?: OpenCopy;
    }>,
  ) {
    super(app);
  }
  // Native Escape, header X, outside click and programmatic close share this boundary.
  close(): void {
    if (!this.busy) super.close();
  }
  canDismiss(): boolean {
    return !this.busy;
  }
  onOpen(): void {
    this.setTitle("Atlas speichern unter");
    let name = this.originalName + " Kopie";
    let input!: HTMLInputElement;
    const buttons: HTMLButtonElement[] = [];
    new Setting(this.contentEl).setName("Name").addText((text) => {
      text.setValue(name).onChange((value) => {
        name = value;
      });
      input = text.inputEl;
      input.setAttribute("aria-label", "Kopiename");
    });
    this.contentEl.createEl("p", {
      text: "Die Kopie kann unabhängig von der Ausgangskarte bearbeitet werden.",
    });
    const status = this.contentEl.createEl("p", {
      text: "Unterbrochene Kopien können über ihren Namen wiederhergestellt werden. Unvollständige Kopien werden dabei zurückgenommen.",
    });
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    const setBusy = (value: boolean, message?: string) => {
      this.busy = value;
      input.disabled = value;
      buttons.forEach((button) => {
        button.disabled = value;
      });
      this.modalEl.setAttribute("aria-busy", String(value));
      this.modalEl
        .querySelectorAll<HTMLElement>(
          ".modal-close-button, .modal-header-button",
        )
        .forEach((button) => {
          button.setAttribute("aria-disabled", String(value));
          button.style.opacity = value ? "0.35" : "";
        });
      if (message) status.textContent = message;
    };
    const run = async (recovering: boolean) => {
      if (this.busy) return;
      const clean = name.trim();
      if (
        !clean ||
        clean === "." ||
        clean === ".." ||
        /[\\/:*?"<>|]/.test(clean) ||
        clean.length > 200
      ) {
        new Notice("Einen Atlasnamen ohne Pfad- oder Sonderzeichen eingeben.");
        return;
      }
      setBusy(
        true,
        recovering
          ? "Kopie wird wiederhergestellt … Bitte bis zum Abschluss warten."
          : "Kopie wird gespeichert … Bitte bis zum Abschluss warten.",
      );
      try {
        const result = recovering
          ? await this.recover(clean)
          : { state: "committed" as const, open: await this.copy(clean) };
        if (result.state !== "committed") {
          setBusy(
            false,
            result.state === "rolled_back"
              ? "Unvollständige Kopie zurückgenommen. Die Kopie kann jetzt neu gespeichert werden."
              : "Für diesen Namen wurde keine unterbrochene Kopie gefunden.",
          );
          return;
        }
        setBusy(false);
        this.close();
        try {
          if (!result.open || !(await result.open()))
            new Notice(`Kopie „${clean}“ ist gespeichert.`);
        } catch (error) {
          new Notice(
            "Kopie ist gespeichert; Öffnen fehlgeschlagen. " + String(error),
          );
        }
      } catch (error) {
        const message = recovering
          ? "Kopie konnte nicht wiederhergestellt werden. Dateien bleiben erhalten. " +
            String(error)
          : error instanceof FileConflict
            ? "Ein Atlas mit diesem Namen oder Zielinhalt ist bereits vorhanden. Einen anderen Namen wählen oder die unterbrochene Kopie wiederherstellen."
            : "Kopie konnte nicht gespeichert werden. " + String(error);
        setBusy(false, message);
        new Notice(message);
      } finally {
        setBusy(false);
      }
    };
    new Setting(this.contentEl)
      .addButton((button) => {
        buttons.push(button.buttonEl);
        button.setButtonText("Abbrechen").onClick(() => this.close());
      })
      .addButton((button) => {
        buttons.push(button.buttonEl);
        button
          .setButtonText("Unterbrochene Kopie wiederherstellen")
          .onClick(() => run(true));
      })
      .addButton((button) => {
        buttons.push(button.buttonEl);
        button
          .setButtonText("Kopie speichern")
          .setCta()
          .onClick(() => run(false));
      });
  }
  onClose(): void {
    this.contentEl.empty();
  }
}
