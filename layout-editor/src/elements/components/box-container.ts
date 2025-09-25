import { ContainerComponent } from "../shared/component-bases";

const defaultLayout = { gap: 16, padding: 16, align: "stretch" as const };

const boxContainerComponent = new ContainerComponent({
    type: "box-container",
    buttonLabel: "BoxContainer",
    defaultLabel: "",
    category: "container",
    paletteGroup: "container",
    layoutOrientation: "vertical",
    width: 360,
    height: 220,
    defaultLayout,
});

export default boxContainerComponent;
