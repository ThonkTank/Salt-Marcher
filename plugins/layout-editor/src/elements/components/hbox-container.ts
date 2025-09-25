import { ContainerComponent } from "../shared/component-bases";

const defaultLayout = { gap: 16, padding: 16, align: "center" as const };

const hboxContainerComponent = new ContainerComponent({
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
});

export default hboxContainerComponent;
