// plugins/layout-editor/src/name-input-modal.ts
import { App, Modal } from "obsidian";
import {
    createElementsButton,
    createElementsField,
    createElementsHeading,
    createElementsInput,
    ensureFieldLabelFor,
} from "./elements/ui";

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
        const heading = createElementsHeading(contentEl, 3, this.title);
        heading.addClass("sm-le-modal__heading");

        const form = contentEl.createEl("form", { cls: "sm-le-modal__form" });
        const field = createElementsField(form, { label: "Name" });
        field.fieldEl.addClass("sm-le-modal__field");
        const inputEl = createElementsInput(field.controlEl, { placeholder: this.placeholder });
        ensureFieldLabelFor(field, inputEl);
        if (this.value) {
            inputEl.value = this.value;
        }
        inputEl.addEventListener("input", () => {
            this.value = inputEl.value.trim();
        });

        const actions = form.createDiv({ cls: "sm-le-modal__actions" });
        const submitBtn = createElementsButton(actions, { label: this.ctaLabel, variant: "primary", type: "submit" });
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
