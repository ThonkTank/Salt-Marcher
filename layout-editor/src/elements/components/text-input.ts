import type { ElementInspectorContext } from "../base";
import { TextFieldComponent } from "../shared/component-bases";

class TextInputComponent extends TextFieldComponent {
    constructor() {
        super(
            {
                type: "text-input",
                buttonLabel: "Textfeld",
                defaultLabel: "",
                category: "element",
                paletteGroup: "input",
                width: 260,
                height: 140,
            },
            {
                wrapperTag: "div",
                wrapperClass: "sm-le-preview__input-only",
                inputClass: "sm-le-preview__input",
                showLabelInPreview: false,
                supportsPlaceholder: false,
            },
        );
    }

    renderInspector(_context: ElementInspectorContext): void {
        // Intentionally left blank – das Textfeld besitzt keine zusätzlichen Inspector-Felder.
    }
}

const textInputComponent = new TextInputComponent();

export default textInputComponent;
