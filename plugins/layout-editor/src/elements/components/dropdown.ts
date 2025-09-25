import { SelectComponent } from "../shared/component-bases";

const dropdownComponent = new SelectComponent(
    {
        type: "dropdown",
        buttonLabel: "Dropdown",
        defaultLabel: "",
        category: "element",
        paletteGroup: "input",
        defaultPlaceholder: "Option wählen…",
        options: ["Option A", "Option B"],
        width: 260,
        height: 150,
    },
    { enableSearch: false },
);

export default dropdownComponent;
