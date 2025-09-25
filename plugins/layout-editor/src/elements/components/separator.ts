import type { LayoutElementComponent } from "../base";

const separatorComponent: LayoutElementComponent = {
    definition: {
        type: "separator",
        buttonLabel: "Trennstrich",
        defaultLabel: "",
        category: "element",
        paletteGroup: "element",
        width: 320,
        height: 80,
    },
    renderPreview({ preview, element }) {
        const header = preview.createDiv({ cls: "sm-le-preview__separator" });
        const title = element.label?.trim() ? element.label : "";
        if (title) {
            header.createSpan({ cls: "sm-le-preview__label", text: title });
        } else {
            header.style.display = "none";
        }
        preview.createEl("hr", { cls: "sm-le-preview__divider" });
    },
    renderInspector({ renderLabelField }) {
        renderLabelField({ label: "Titel" });
    },
};

export default separatorComponent;
