import type { LayoutElement } from "../../types";
import type { LayoutElementComponent } from "../base";
import { renderContainerPreview } from "../shared/container-preview";

const defaultLayout = { gap: 16, padding: 16, align: "center" as const };

function ensureLayout(element: LayoutElement) {
    if (!element.layout) {
        element.layout = { ...defaultLayout };
    }
    if (!Array.isArray(element.children)) {
        element.children = [];
    }
}

const hboxContainerComponent: LayoutElementComponent = {
    definition: {
        type: "hbox-container",
        buttonLabel: "HBoxContainer",
        defaultLabel: "",
        category: "container",
        paletteGroup: "container",
        layoutOrientation: "horizontal",
        defaultDescription: "Ordnet verknüpfte Elemente automatisch nebeneinander an.",
        width: 360,
        height: 220,
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

export default hboxContainerComponent;
