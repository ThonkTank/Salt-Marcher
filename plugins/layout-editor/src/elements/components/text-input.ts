import type { LayoutElementComponent } from "../base";

const textInputComponent: LayoutElementComponent = {
    definition: {
        type: "text-input",
        buttonLabel: "Textfeld",
        defaultLabel: "",
        category: "element",
        paletteGroup: "input",
        width: 260,
        height: 140,
    },
    renderPreview({ preview, element, finalize }) {
        const field = preview.createDiv({ cls: "sm-le-preview__input-only" });
        const input = field.createEl("input", { attr: { type: "text" }, cls: "sm-le-preview__input" }) as HTMLInputElement;
        input.value = element.defaultValue ?? "";
        input.placeholder = "";
        let lastValue = input.value;
        input.addEventListener("input", () => {
            element.defaultValue = input.value ? input.value : undefined;
        });
        input.addEventListener("blur", () => {
            const next = input.value;
            if (next === lastValue) return;
            lastValue = next;
            element.defaultValue = next ? next : undefined;
            finalize(element);
        });
        if (element.placeholder) {
            element.placeholder = undefined;
        }
    },
};

export default textInputComponent;
