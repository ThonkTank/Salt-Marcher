// plugins/layout-editor/src/name-input-modal.ts
import { App, Modal, Setting } from "obsidian";

export class NameInputModal extends Modal {
    private value = "";
    private readonly placeholder: string;
    private readonly title: string;
    private readonly ctaLabel: string;

    constructor(
        app: App,
        private readonly onSubmit: (value: string) => void,
        options?: { placeholder?: string; title?: string; cta?: string; initialValue?: string },
    ) {
        super(app);
        this.placeholder = options?.placeholder ?? "Layout-Namen eingeben";
        this.title = options?.title ?? "Neues Layout";
        this.ctaLabel = options?.cta ?? "Speichern";
        if (options?.initialValue) {
            this.value = options.initialValue.trim();
        }
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl("h3", { text: this.title });

        let inputEl: HTMLInputElement | undefined;

        new Setting(contentEl)
            .addText(text => {
                text.setPlaceholder(this.placeholder).onChange(value => (this.value = value.trim()));
                inputEl = (text as any).inputEl as HTMLInputElement;
                if (this.value) {
                    inputEl.value = this.value;
                }
            })
            .addButton(button => {
                button.setButtonText(this.ctaLabel).setCta().onClick(() => this.submit());
            });

        this.scope.register([], "Enter", () => this.submit());
        queueMicrotask(() => inputEl?.focus());
    }

    onClose() {
        this.contentEl.empty();
    }

    private submit() {
        const name = this.value || this.placeholder;
        this.close();
        this.onSubmit(name);
    }
}
