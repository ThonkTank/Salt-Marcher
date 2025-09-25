export type ElementsButtonVariant = "default" | "primary" | "warning" | "ghost";

export interface ElementsButtonOptions {
    label: string;
    variant?: ElementsButtonVariant;
    type?: "button" | "submit";
    icon?: string;
    onClick?: (event: MouseEvent) => void;
}

export function createElementsButton(parent: HTMLElement, options: ElementsButtonOptions): HTMLButtonElement {
    const { label, variant = "default", type = "button", icon, onClick } = options;
    const classes = ["sm-elements-button"];
    if (variant !== "default") {
        classes.push(`sm-elements-button--${variant}`);
    }
    const button = parent.createEl("button", {
        cls: classes.join(" "),
        text: icon ? undefined : label,
    });
    button.type = type;
    if (icon) {
        button.setAttr("data-icon", icon);
        const labelSpan = button.createSpan({ cls: "sm-elements-button__label", text: label });
        labelSpan.setAttr("aria-hidden", "true");
    }
    if (onClick) {
        button.addEventListener("click", onClick);
    }
    return button;
}

export interface ElementsFieldOptions {
    label: string;
    layout?: "stack" | "inline" | "grid";
    description?: string;
}

export interface ElementsFieldResult {
    fieldEl: HTMLElement;
    labelEl: HTMLLabelElement;
    controlEl: HTMLElement;
    descriptionEl?: HTMLElement;
}

export function createElementsField(parent: HTMLElement, options: ElementsFieldOptions): ElementsFieldResult {
    const { label, layout = "stack", description } = options;
    const classes = ["sm-elements-field"];
    if (layout === "inline") classes.push("sm-elements-field--inline");
    if (layout === "grid") classes.push("sm-elements-field--grid");
    const fieldEl = parent.createDiv({ cls: classes.join(" ") });
    const labelEl = fieldEl.createEl("label", { cls: "sm-elements-field__label", text: label });
    const controlEl = fieldEl.createDiv({ cls: "sm-elements-field__control" });
    let descriptionEl: HTMLElement | undefined;
    if (description) {
        descriptionEl = fieldEl.createDiv({ cls: "sm-elements-field__description", text: description });
    }
    return { fieldEl, labelEl, controlEl, descriptionEl };
}

export interface ElementsInputOptions {
    type?: "text" | "number" | "search";
    value?: string;
    placeholder?: string;
    min?: number;
    max?: number;
    step?: number;
    required?: boolean;
    disabled?: boolean;
    attr?: Record<string, string>;
    autocomplete?: string;
}

export function createElementsInput(parent: HTMLElement, options: ElementsInputOptions = {}): HTMLInputElement {
    const { type = "text", value, placeholder, min, max, step, required, disabled, attr, autocomplete } = options;
    const input = parent.createEl("input", { cls: "sm-elements-input", attr: { type } }) as HTMLInputElement;
    if (value !== undefined) input.value = value;
    if (placeholder !== undefined) input.placeholder = placeholder;
    if (min !== undefined) input.min = String(min);
    if (max !== undefined) input.max = String(max);
    if (step !== undefined) input.step = String(step);
    if (required) input.required = true;
    if (disabled) input.disabled = true;
    if (autocomplete !== undefined) input.autocomplete = autocomplete;
    if (attr) {
        for (const [key, val] of Object.entries(attr)) {
            input.setAttr(key, val);
        }
    }
    return input;
}

export interface ElementsTextareaOptions {
    value?: string;
    placeholder?: string;
    rows?: number;
    disabled?: boolean;
}

export function createElementsTextarea(parent: HTMLElement, options: ElementsTextareaOptions = {}): HTMLTextAreaElement {
    const { value, placeholder, rows = 4, disabled } = options;
    const textarea = parent.createEl("textarea", { cls: "sm-elements-textarea" }) as HTMLTextAreaElement;
    if (value !== undefined) textarea.value = value;
    if (placeholder !== undefined) textarea.placeholder = placeholder;
    textarea.rows = rows;
    if (disabled) textarea.disabled = true;
    return textarea;
}

export interface ElementsSelectOption {
    value: string;
    label: string;
    disabled?: boolean;
}

export interface ElementsSelectOptions {
    options: ElementsSelectOption[];
    value?: string;
    placeholder?: string;
    disabled?: boolean;
}

export function createElementsSelect(parent: HTMLElement, options: ElementsSelectOptions): HTMLSelectElement {
    const { options: items, value, placeholder, disabled } = options;
    const select = parent.createEl("select", { cls: "sm-elements-select" }) as HTMLSelectElement;
    if (placeholder) {
        const placeholderOption = select.createEl("option", { value: "", text: placeholder });
        placeholderOption.disabled = true;
        if (value === undefined) {
            placeholderOption.selected = true;
        }
    }
    for (const item of items) {
        const option = select.createEl("option", { value: item.value, text: item.label });
        if (item.disabled) option.disabled = true;
        if (value !== undefined && item.value === value) option.selected = true;
    }
    if (disabled) select.disabled = true;
    return select;
}

export interface ElementsStatusOptions {
    text: string;
    tone?: "neutral" | "info" | "warning" | "success";
}

export function createElementsStatus(parent: HTMLElement, options: ElementsStatusOptions): HTMLElement {
    const { text, tone = "neutral" } = options;
    const classes = ["sm-elements-status", `sm-elements-status--${tone}`];
    const status = parent.createDiv({ cls: classes.join(" ") });
    status.setText(text);
    return status;
}

export interface ElementsStackOptions {
    direction?: "row" | "column";
    gap?: number;
}

export function createElementsStack(parent: HTMLElement, options: ElementsStackOptions = {}): HTMLElement {
    const { direction = "column", gap } = options;
    const stack = parent.createDiv({ cls: `sm-elements-stack sm-elements-stack--${direction}` });
    if (gap !== undefined) {
        stack.style.setProperty("--sm-elements-stack-gap", `${gap}px`);
    }
    return stack;
}

export function createElementsHeading(parent: HTMLElement, level: 1 | 2 | 3 | 4 | 5 | 6, text: string): HTMLHeadingElement {
    return parent.createEl(`h${level}`, { cls: "sm-elements-heading", text });
}

export function createElementsParagraph(parent: HTMLElement, text: string): HTMLParagraphElement {
    return parent.createEl("p", { cls: "sm-elements-paragraph", text });
}

export function createElementsMeta(parent: HTMLElement, text: string): HTMLElement {
    return parent.createDiv({ cls: "sm-elements-meta", text });
}

export function ensureFieldLabelFor(
    field: ElementsFieldResult,
    control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
) {
    if (field.labelEl.getAttr("for")) return;
    let id = control.id;
    if (!id) {
        id = `sm-elements-control-${Math.random().toString(36).slice(2)}`;
        control.id = id;
    }
    field.labelEl.setAttr("for", id);
}
