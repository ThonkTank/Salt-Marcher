// src/ui/confirm-delete.ts
import { App, Modal, setIcon, Notice, TFile } from "obsidian";
import { CONFIRM_DELETE_COPY } from "./copy";

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

        contentEl.createEl("h3", { text: CONFIRM_DELETE_COPY.title });
        const message = contentEl.createEl("p");
        message.textContent = CONFIRM_DELETE_COPY.body(name);

        const input = contentEl.createEl("input", {
            attr: {
                type: "text",
                placeholder: CONFIRM_DELETE_COPY.inputPlaceholder(name),
                style: "width:100%;",
            },
        }) as HTMLInputElement;

        const btnRow = contentEl.createDiv({ cls: "modal-button-container" });
        const cancelBtn = btnRow.createEl("button", { text: CONFIRM_DELETE_COPY.buttons.cancel });
        const confirmBtn = btnRow.createEl("button", { text: CONFIRM_DELETE_COPY.buttons.confirm });
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
                new Notice(CONFIRM_DELETE_COPY.notices.success);
            } catch (e) {
                console.error(e);
                new Notice(CONFIRM_DELETE_COPY.notices.error);
            } finally {
                this.close();
            }
        };

        // Keep focus on the confirmation input for quicker deletion flows.
        setTimeout(() => input.focus(), 0);
    }

    onClose() {
        this.contentEl.empty();
    }
}
