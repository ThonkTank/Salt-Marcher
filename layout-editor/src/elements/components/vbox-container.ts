import { ContainerComponent } from "../shared/component-bases";

const defaultLayout = { gap: 16, padding: 16, align: "stretch" as const };

const vboxContainerComponent = new ContainerComponent({
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
});

export default vboxContainerComponent;
