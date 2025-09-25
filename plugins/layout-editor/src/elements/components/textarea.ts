import type { LayoutElementComponent } from "../base";

const textareaComponent: LayoutElementComponent = {
    definition: {
        type: "textarea",
        buttonLabel: "Mehrzeiliges Feld",
        defaultLabel: "",
        category: "element",
        paletteGroup: "input",
        defaultPlaceholder: "Text erfassen…",
        width: 320,
        height: 180,
    },
    renderPreview({ preview, element, finalize }) {
        const field = preview.createEl("label", { cls: "sm-le-preview__field" });
        const labelHost = field.createSpan({ cls: "sm-le-preview__label" });
        const labelText = element.label?.trim() ?? "";
        if (labelText) {
            labelHost.setText(labelText);
        } else {
            labelHost.style.display = "none";
        }

        const textarea = field.createEl("textarea", { cls: "sm-le-preview__textarea" }) as HTMLTextAreaElement;
        textarea.value = element.defaultValue ?? "";
        textarea.placeholder = element.placeholder ?? "";
        textarea.rows = 4;
        let lastValue = textarea.value;
        textarea.addEventListener("input", () => {
            element.defaultValue = textarea.value ? textarea.value : undefined;
        });
        textarea.addEventListener("blur", () => {
            const next = textarea.value;
            if (next === lastValue) return;
            lastValue = next;
            element.defaultValue = next ? next : undefined;
            finalize(element);
        });
    },
    renderInspector({ renderLabelField, renderPlaceholderField }) {
        renderLabelField({ label: "Bezeichnung" });
        renderPlaceholderField({ label: "Platzhalter" });
    },
};

export default textareaComponent;
