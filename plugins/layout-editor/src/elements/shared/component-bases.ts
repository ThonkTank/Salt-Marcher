import { enhanceSelectToSearch } from "../../search-dropdown";
import type { LayoutElement, LayoutElementDefinition } from "../../types";
import type {
    ElementInspectorContext,
    ElementPreviewContext,
    LayoutElementComponent,
} from "../base";
import { renderContainerPreview } from "./container-preview";

export type PreviewContext = ElementPreviewContext;

export abstract class ElementComponentBase implements LayoutElementComponent {
    readonly definition: LayoutElementDefinition;

    protected constructor(definition: LayoutElementDefinition) {
        this.definition = definition;
    }

    abstract renderPreview(context: PreviewContext): void;

    renderInspector?(context: ElementInspectorContext): void;

    ensureDefaults?(element: LayoutElement): void;
}

type FieldPreviewConfig = {
    tagName?: "label" | "div";
    fieldClass?: string;
    includeLabel?: boolean;
    labelClass?: string;
};

interface FieldComponentOptions {
    inspectorLabel?: string;
    placeholderInspectorLabel?: string;
}

export abstract class FieldComponent extends ElementComponentBase {
    private readonly inspectorLabel: string;
    private readonly placeholderInspectorLabel?: string;

    protected constructor(definition: LayoutElementDefinition, options: FieldComponentOptions = {}) {
        super(definition);
        this.inspectorLabel = options.inspectorLabel ?? "Bezeichnung";
        this.placeholderInspectorLabel = options.placeholderInspectorLabel;
    }

    protected createFieldWrapper(
        preview: HTMLElement,
        element: LayoutElement,
        config: FieldPreviewConfig = {},
    ): { field: HTMLElement; labelHost?: HTMLElement } {
        const { tagName = "label", fieldClass = "sm-le-preview__field", includeLabel = true, labelClass = "sm-le-preview__label" } = config;
        const field = preview.createEl(tagName, { cls: fieldClass });
        let labelHost: HTMLElement | undefined;
        if (includeLabel) {
            labelHost = field.createSpan({ cls: labelClass });
            const labelText = element.label?.trim() ?? "";
            if (labelText) {
                labelHost.setText(labelText);
            } else {
                labelHost.style.display = "none";
            }
        }
        return { field, labelHost };
    }

    renderInspector({ renderLabelField, renderPlaceholderField }: ElementInspectorContext): void {
        renderLabelField({ label: this.inspectorLabel });
        if (this.placeholderInspectorLabel) {
            renderPlaceholderField({ label: this.placeholderInspectorLabel });
        }
    }
}

interface TextFieldComponentOptions extends FieldComponentOptions {
    inputClass?: string;
    wrapperClass?: string;
    labelClass?: string;
    wrapperTag?: "label" | "div";
    inputType?: string;
    multiline?: boolean;
    rows?: number;
    supportsPlaceholder?: boolean;
    showLabelInPreview?: boolean;
}

export class TextFieldComponent extends FieldComponent {
    private readonly inputClass: string;
    private readonly wrapperClass: string;
    private readonly labelClass?: string;
    private readonly wrapperTag: "label" | "div";
    private readonly inputType: string;
    private readonly multiline: boolean;
    private readonly rows: number;
    private readonly supportsPlaceholder: boolean;
    private readonly showLabelInPreview: boolean;

    constructor(definition: LayoutElementDefinition, options: TextFieldComponentOptions = {}) {
        super(definition, options);
        this.inputClass = options.inputClass ?? "sm-le-preview__input";
        this.wrapperClass = options.wrapperClass ?? "sm-le-preview__field";
        this.labelClass = options.labelClass;
        this.wrapperTag = options.wrapperTag ?? "label";
        this.inputType = options.inputType ?? "text";
        this.multiline = options.multiline ?? false;
        this.rows = options.rows ?? 4;
        this.supportsPlaceholder = options.supportsPlaceholder ?? false;
        this.showLabelInPreview = options.showLabelInPreview ?? true;
    }

    renderPreview({ preview, element, finalize }: PreviewContext): void {
        const { field } = this.createFieldWrapper(preview, element, {
            tagName: this.wrapperTag,
            fieldClass: this.wrapperClass,
            includeLabel: this.showLabelInPreview,
            labelClass: this.labelClass,
        });

        if (this.multiline) {
            const textarea = field.createEl("textarea", { cls: this.inputClass }) as HTMLTextAreaElement;
            textarea.value = element.defaultValue ?? "";
            if (this.supportsPlaceholder) {
                textarea.placeholder = element.placeholder ?? "";
            } else {
                textarea.placeholder = "";
                if (element.placeholder !== undefined) {
                    element.placeholder = undefined;
                }
            }
            textarea.rows = this.rows;
            let lastValue = textarea.value;
            textarea.addEventListener("input", () => {
                element.defaultValue = textarea.value ? textarea.value : undefined;
            });
            textarea.addEventListener("blur", () => {
                const next = textarea.value;
                if (next === lastValue) return;
                lastValue = next;
                element.defaultValue = next ? next : undefined;
                finalize(element);
            });
            return;
        }

        const input = field.createEl("input", { attr: { type: this.inputType }, cls: this.inputClass }) as HTMLInputElement;
        input.value = element.defaultValue ?? "";
        if (this.supportsPlaceholder) {
            input.placeholder = element.placeholder ?? "";
        } else {
            input.placeholder = "";
            if (element.placeholder !== undefined) {
                element.placeholder = undefined;
            }
        }
        let lastValue = input.value;
        input.addEventListener("input", () => {
            element.defaultValue = input.value ? input.value : undefined;
        });
        input.addEventListener("blur", () => {
            const next = input.value;
            if (next === lastValue) return;
            lastValue = next;
            element.defaultValue = next ? next : undefined;
            finalize(element);
        });
    }
}

interface ContainerComponentOptions {
    inspectorLabel?: string;
}

export class ContainerComponent extends ElementComponentBase {
    private readonly defaultLayout: LayoutElementDefinition["defaultLayout"];
    private readonly inspectorLabel: string;

    constructor(definition: LayoutElementDefinition, options: ContainerComponentOptions = {}) {
        super(definition);
        if (!definition.defaultLayout) {
            throw new Error(`Container component "${definition.type}" requires a default layout configuration.`);
        }
        this.defaultLayout = { ...definition.defaultLayout };
        this.inspectorLabel = options.inspectorLabel ?? "Bezeichnung";
    }

    renderPreview(context: PreviewContext): void {
        renderContainerPreview(context);
    }

    renderInspector({ renderLabelField, renderContainerLayoutControls }: ElementInspectorContext): void {
        renderLabelField({ label: this.inspectorLabel });
        renderContainerLayoutControls({});
    }

    ensureDefaults(element: LayoutElement): void {
        if (!element.layout) {
            element.layout = { ...this.defaultLayout };
        }
        if (!Array.isArray(element.children)) {
            element.children = [];
        }
    }
}

interface SelectComponentOptions extends FieldComponentOptions {
    enableSearch?: boolean;
}

export class SelectComponent extends FieldComponent {
    private readonly enableSearch: boolean;

    constructor(definition: LayoutElementDefinition, options: SelectComponentOptions = {}) {
        super(definition, {
            inspectorLabel: options.inspectorLabel,
            placeholderInspectorLabel: options.placeholderInspectorLabel ?? "Platzhalter",
        });
        this.enableSearch = options.enableSearch ?? false;
    }

    private getDefaultPlaceholder(): string {
        if (this.definition.defaultPlaceholder) {
            return this.definition.defaultPlaceholder;
        }
        return this.enableSearch ? "Suchen…" : "Option wählen…";
    }

    renderPreview({ preview, element, finalize }: PreviewContext): void {
        const { field } = this.createFieldWrapper(preview, element);

        const select = field.createEl("select", { cls: "sm-le-preview__select" }) as HTMLSelectElement;
        const fallbackPlaceholder = this.getDefaultPlaceholder();

        const renderSelectOptions = () => {
            select.innerHTML = "";
            const placeholderText = element.placeholder ?? fallbackPlaceholder;
            const placeholderOption = select.createEl("option", { value: "", text: placeholderText });
            placeholderOption.disabled = true;
            if (!element.defaultValue) {
                placeholderOption.selected = true;
            }

            const optionValues = element.options && element.options.length ? element.options : null;
            if (!optionValues) {
                select.createEl("option", { value: "opt-1", text: "Erste Option" });
            } else {
                for (const opt of optionValues) {
                    const optionEl = select.createEl("option", { value: opt, text: opt });
                    if (element.defaultValue && element.defaultValue === opt) {
                        optionEl.selected = true;
                    }
                }
                if (element.defaultValue && !optionValues.includes(element.defaultValue)) {
                    element.defaultValue = undefined;
                    placeholderOption.selected = true;
                }
            }

            if (this.enableSearch) {
                const searchInput = (select as any)._smSearchInput as HTMLInputElement | undefined;
                if (searchInput) {
                    searchInput.value = element.defaultValue ?? "";
                    searchInput.placeholder = placeholderText;
                }
            }
        };

        renderSelectOptions();

        if (this.enableSearch) {
            enhanceSelectToSearch(select, element.placeholder ?? fallbackPlaceholder);
            const searchInput = (select as any)._smSearchInput as HTMLInputElement | undefined;
            if (searchInput) {
                searchInput.addEventListener("blur", () => {
                    const next = searchInput.value;
                    element.defaultValue = next ? next : undefined;
                    finalize(element);
                });
            }
        }

        select.onchange = () => {
            const value = select.value || undefined;
            if (value === element.defaultValue) return;
            element.defaultValue = value;
            if (this.enableSearch) {
                const searchInput = (select as any)._smSearchInput as HTMLInputElement | undefined;
                if (searchInput) {
                    searchInput.value = value ?? "";
                }
            }
            finalize(element);
        };
    }

    renderInspector(context: ElementInspectorContext): void {
        super.renderInspector(context);
        context.renderOptionsEditor({});
    }
}
