import { enhanceSelectToSearch } from "../../search-dropdown";
import type { LayoutElement, LayoutElementDefinition } from "../../types";
import type { ElementInspectorContext, ElementPreviewContext, LayoutElementComponent } from "../base";
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

interface SelectComponentOptions {
    enableSearch?: boolean;
    inspectorLabel?: string;
    placeholderInspectorLabel?: string;
}

export class SelectComponent extends ElementComponentBase {
    private readonly enableSearch: boolean;
    private readonly inspectorLabel: string;
    private readonly placeholderInspectorLabel: string;

    constructor(definition: LayoutElementDefinition, options: SelectComponentOptions = {}) {
        super(definition);
        this.enableSearch = options.enableSearch ?? false;
        this.inspectorLabel = options.inspectorLabel ?? "Bezeichnung";
        this.placeholderInspectorLabel = options.placeholderInspectorLabel ?? "Platzhalter";
    }

    private getDefaultPlaceholder(): string {
        if (this.definition.defaultPlaceholder) {
            return this.definition.defaultPlaceholder;
        }
        return this.enableSearch ? "Suchen…" : "Option wählen…";
    }

    renderPreview({ preview, element, finalize }: PreviewContext): void {
        const field = preview.createEl("label", { cls: "sm-le-preview__field" });
        const labelHost = field.createSpan({ cls: "sm-le-preview__label" });
        const labelText = element.label?.trim() ?? "";
        if (labelText) {
            labelHost.setText(labelText);
        } else {
            labelHost.style.display = "none";
        }

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

    renderInspector({ renderLabelField, renderPlaceholderField, renderOptionsEditor }: ElementInspectorContext): void {
        renderLabelField({ label: this.inspectorLabel });
        renderPlaceholderField({ label: this.placeholderInspectorLabel });
        renderOptionsEditor({});
    }
}
