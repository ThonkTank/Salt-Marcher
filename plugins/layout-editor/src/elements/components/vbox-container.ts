import type { LayoutElement } from "../../types";
import type { LayoutElementComponent } from "../base";
import { renderContainerPreview } from "../shared/container-preview";

const defaultLayout = { gap: 16, padding: 16, align: "stretch" as const };

function ensureLayout(element: LayoutElement) {
    if (!element.layout) {
        element.layout = { ...defaultLayout };
    }
    if (!Array.isArray(element.children)) {
        element.children = [];
    }
}

const vboxContainerComponent: LayoutElementComponent = {
    definition: {
        type: "vbox-container",
        buttonLabel: "VBoxContainer",
        defaultLabel: "",
        category: "container",
        paletteGroup: "container",
        layoutOrientation: "vertical",
        defaultDescription: "Ordnet verknüpfte Elemente automatisch untereinander an.",
        width: 340,
        height: 260,
        defaultLayout,
    },
    renderPreview(context) {
        renderContainerPreview(context);
    },
    renderInspector({ renderLabelField, renderContainerLayoutControls }) {
        renderLabelField({ label: "Bezeichnung" });
        renderContainerLayoutControls({});
    },
    ensureDefaults: ensureLayout,
};

export default vboxContainerComponent;
