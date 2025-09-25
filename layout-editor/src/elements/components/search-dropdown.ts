import { SelectComponent } from "../shared/component-bases";

const searchDropdownComponent = new SelectComponent(
    {
        type: "search-dropdown",
        buttonLabel: "Such-Dropdown",
        defaultLabel: "",
        category: "element",
        paletteGroup: "input",
        defaultPlaceholder: "Suchen…",
        options: ["Erster Eintrag", "Zweiter Eintrag"],
        width: 280,
        height: 160,
    },
    { enableSearch: true },
);

export default searchDropdownComponent;
