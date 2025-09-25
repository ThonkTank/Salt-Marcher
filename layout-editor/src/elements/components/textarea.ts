import { TextFieldComponent } from "../shared/component-bases";

const textareaComponent = new TextFieldComponent(
    {
        type: "textarea",
        buttonLabel: "Mehrzeiliges Feld",
        defaultLabel: "",
        category: "element",
        paletteGroup: "input",
        defaultPlaceholder: "Text erfassen…",
        width: 320,
        height: 180,
    },
    {
        inputClass: "sm-le-preview__textarea",
        supportsPlaceholder: true,
        multiline: true,
        rows: 4,
        placeholderInspectorLabel: "Platzhalter",
    },
);

export default textareaComponent;
