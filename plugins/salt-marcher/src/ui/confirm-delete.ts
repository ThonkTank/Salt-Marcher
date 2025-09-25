// src/ui/confirm-delete.ts
import { App, Modal, setIcon, Notice, TFile } from "obsidian";

export class ConfirmDeleteModal extends Modal {
    private onConfirm: () => Promise<void>;
    private mapFile: TFile;

    constructor(app: App, mapFile: TFile, onConfirm: () => Promise<void>) {
        super(app);
        this.mapFile = mapFile;
        this.onConfirm = onConfirm;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        const name = this.mapFile.basename;

        contentEl.createEl("h3", { text: "Delete map?" });
        const p = contentEl.createEl("p");
        p.textContent = `This will delete your map permanently. If you want to proceed anyways, enter “${name}”.`;

        const input = contentEl.createEl("input", {
            attr: { type: "text", placeholder: name, style: "width:100%;" },
        }) as HTMLInputElement;

        const btnRow = contentEl.createDiv({ cls: "modal-button-container" });
        const cancelBtn = btnRow.createEl("button", { text: "Cancel" });
        const confirmBtn = btnRow.createEl("button", { text: "Delete" });
        setIcon(confirmBtn, "trash");
        confirmBtn.classList.add("mod-warning");
        confirmBtn.disabled = true;

        input.addEventListener("input", () => {
            confirmBtn.disabled = input.value.trim() !== name;
        });

        cancelBtn.onclick = () => this.close();

        confirmBtn.onclick = async () => {
            confirmBtn.disabled = true;
            try {
                await this.onConfirm();
                new Notice("Map deleted.");
            } catch (e) {
                console.error(e);
                new Notice("Deleting map failed.");
            } finally {
                this.close();
            }
        };

        // Fokus
        setTimeout(() => input.focus(), 0);
    }

    onClose() {
        this.contentEl.empty();
    }
}
