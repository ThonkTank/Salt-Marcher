// plugins/layout-editor/src/name-input-modal.ts
import { App, Modal } from "obsidian";

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
        contentEl.addClass("sm-le-modal");
        contentEl.createEl("h3", { text: this.title });

        const form = contentEl.createEl("form", { cls: "sm-le-modal__form" });
        const field = form.createDiv({ cls: "sm-le-modal__field" });
        const inputId = `sm-le-name-input-${Date.now()}`;
        field.createEl("label", { text: "Name", attr: { for: inputId } });
        const inputEl = field.createEl("input", {
            attr: { type: "text", id: inputId, placeholder: this.placeholder },
        }) as HTMLInputElement;
        if (this.value) {
            inputEl.value = this.value;
        }
        inputEl.addEventListener("input", () => {
            this.value = inputEl.value.trim();
        });

        const actions = form.createDiv({ cls: "sm-le-modal__actions" });
        const submitBtn = actions.createEl("button", { text: this.ctaLabel });
        submitBtn.type = "submit";
        submitBtn.addClass("mod-cta");

        form.onsubmit = ev => {
            ev.preventDefault();
            this.value = inputEl.value.trim();
            this.submit();
        };

        this.scope.register([], "Enter", () => {
            this.value = inputEl.value.trim();
            this.submit();
        });
        queueMicrotask(() => inputEl.focus());
    }

    onClose() {
        this.contentEl.empty();
        this.contentEl.removeClass("sm-le-modal");
    }

    private submit() {
        const name = this.value || this.placeholder;
        this.close();
        this.onSubmit(name);
    }
}
