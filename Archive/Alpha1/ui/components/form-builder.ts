import { configurableLogger } from '@services/logging/configurable-logger';
const logger = configurableLogger.forModule('ui-form-builder');
// src/ui/form-builder.ts
// Baut Formularoberflächen aus einer Konfiguration mit Reihen, Auswahlfeldern, Slidern und Hinweisen.
export type FormBuilderTone = "info" | "loading" | "error" | "warning";
export type FormStatusTone = "info" | "loading" | "error";

export type FormSelectOption = {
    label: string;
    value: string;
    data?: Record<string, string>;
};

export type FormSelectChange = {
    value: string;
    element: HTMLSelectElement;
    event: Event;
};

export type FormSliderChange = {
    value: number;
    element: HTMLInputElement;
    event: Event;
};

export type FormTextareaChange = {
    value: string;
    element: HTMLTextAreaElement;
    event: Event;
};

export type FormButtonClick = {
    element: HTMLButtonElement;
    event: MouseEvent;
};

type ClassValue = string | string[] | undefined;

const applyClasses = (el: HTMLElement, cls: ClassValue) => {
    if (!cls) return;
    const values = Array.isArray(cls) ? cls : cls.split(/\s+/).filter(Boolean);
    for (const value of values) {
        el.classList.add(value);
    }
};

type FormSelectConfig<FieldId extends string> = {
    kind: "select";
    id: FieldId;
    value?: string;
    disabled?: boolean;
    options?: FormSelectOption[];
    enhance?: (element: HTMLSelectElement) => void;
    onChange?: (change: FormSelectChange) => void;
    cls?: ClassValue;
    attr?: Record<string, string>;
};

type FormSliderConfig<FieldId extends string> = {
    kind: "slider";
    id: FieldId;
    value: number;
    min: number;
    max: number;
    step?: number;
    showValue?: boolean;
    valueFormatter?: (value: number) => string;
    onInput?: (change: FormSliderChange) => void;
    onChange?: (change: FormSliderChange) => void;
    cls?: ClassValue;
    attr?: Record<string, string>;
};

type FormTextareaConfig<FieldId extends string> = {
    kind: "textarea";
    id: FieldId;
    value?: string;
    disabled?: boolean;
    rows?: number;
    placeholder?: string;
    onInput?: (change: FormTextareaChange) => void;
    cls?: ClassValue;
    attr?: Record<string, string>;
};

type FormButtonConfig<FieldId extends string> = {
    kind: "button";
    id: FieldId;
    label: string;
    disabled?: boolean;
    onClick?: (change: FormButtonClick) => void;
    cls?: ClassValue;
    attr?: Record<string, string>;
};

type FormControlConfig<FieldId extends string> =
    | FormSelectConfig<FieldId>
    | FormSliderConfig<FieldId>
    | FormTextareaConfig<FieldId>
    | FormButtonConfig<FieldId>;

type FormRowConfig<FieldId extends string> = {
    kind: "row";
    label: string;
    controls: FormControlConfig<FieldId>[];
    labelCls?: ClassValue;
    rowCls?: ClassValue;
};

type FormHeaderConfig = {
    kind: "header";
    text: string;
    cls?: ClassValue;
    level?: 1 | 2 | 3 | 4 | 5 | 6;
};

type FormStaticConfig<FieldId extends string> = {
    kind: "static";
    id: FieldId;
    text?: string;
    cls?: ClassValue;
    tag?: string;
};

type FormHintConfig<HintId extends string> = {
    kind: "hint";
    id: HintId;
    cls?: ClassValue;
    tone?: FormBuilderTone;
    hidden?: boolean;
};

type FormStatusConfig<StatusId extends string> = {
    kind: "status";
    id: StatusId;
    cls?: ClassValue;
};

type FormContainerConfig<ContainerId extends string> = {
    kind: "container";
    id: ContainerId;
    cls?: ClassValue;
    tag?: string;
};

export type FormBuilderSection<FieldId extends string, HintId extends string, ContainerId extends string, StatusId extends string> =
    | FormHeaderConfig
    | FormRowConfig<FieldId>
    | FormStaticConfig<FieldId>
    | FormHintConfig<HintId>
    | FormStatusConfig<StatusId>
    | FormContainerConfig<ContainerId>;

export type FormBuilderConfig<FieldId extends string, HintId extends string, ContainerId extends string, StatusId extends string> = {
    sections: Array<FormBuilderSection<FieldId, HintId, ContainerId, StatusId>>;
};

export type FormSelectHandle = {
    kind: "select";
    element: HTMLSelectElement;
    setOptions(options: FormSelectOption[]): void;
    setValue(value: string): void;
    getValue(): string;
    setDisabled(disabled: boolean): void;
};

export type FormSliderHandle = {
    kind: "slider";
    element: HTMLInputElement;
    valueElement: HTMLElement | null;
    setValue(value: number): void;
    getValue(): number;
    setDisabled(disabled: boolean): void;
};

export type FormTextareaHandle = {
    kind: "textarea";
    element: HTMLTextAreaElement;
    setValue(value: string): void;
    getValue(): string;
    setDisabled(disabled: boolean): void;
};

export type FormButtonHandle = {
    kind: "button";
    element: HTMLButtonElement;
    setDisabled(disabled: boolean): void;
};

export type FormControlHandle = FormSelectHandle | FormSliderHandle | FormTextareaHandle | FormButtonHandle;

export type FormHintHandle = {
    element: HTMLElement;
    set(details: { text: string; tone?: FormBuilderTone } | null): void;
};

export type FormStatusHandle = {
    element: HTMLElement;
    set(details: { message: string; tone?: FormStatusTone } | null): void;
};

export type FormBuilderInstance<FieldId extends string, HintId extends string, ContainerId extends string, StatusId extends string> = {
    root: HTMLElement;
    getControl(id: FieldId): FormControlHandle | null;
    getElement(id: FieldId): HTMLElement | null;
    getContainer(id: ContainerId): HTMLElement | null;
    getHint(id: HintId): FormHintHandle | null;
    getStatus(id: StatusId): FormStatusHandle | null;
    destroy(): void;
};

const createElement = (tag: string, cls?: ClassValue): HTMLElement => {
    const el = document.createElement(tag);
    applyClasses(el, cls);
    return el;
};

const applyAttributes = (el: HTMLElement, attr?: Record<string, string>) => {
    if (!attr) return;
    for (const [key, value] of Object.entries(attr)) {
        el.setAttribute(key, value);
    }
};

/**
 * Baut DOM-Knoten auf Basis einer Formular-Konfiguration und liefert Steuerhandles zurück.
 */
export function buildForm<FieldId extends string, HintId extends string, ContainerId extends string, StatusId extends string>(
    root: HTMLElement,
    config: FormBuilderConfig<FieldId, HintId, ContainerId, StatusId>
): FormBuilderInstance<FieldId, HintId, ContainerId, StatusId> {
    const controls = new Map<string, FormControlHandle>();
    const elements = new Map<string, HTMLElement>();
    const containers = new Map<string, HTMLElement>();
    const hints = new Map<string, FormHintHandle>();
    const statuses = new Map<string, FormStatusHandle>();
    const cleanup: Array<() => void> = [];

    const createRow = (section: FormRowConfig<FieldId>) => {
        const row = createElement("div");
        applyClasses(row, section.rowCls ?? "sm-row");
        const label = createElement("label");
        label.textContent = section.label;
        applyClasses(label, section.labelCls);
        row.appendChild(label);

        section.controls.forEach((control, index) => {
            if (control.kind === "select") {
                const select = createElement("select", control.cls) as HTMLSelectElement;
                applyAttributes(select, control.attr);
                if (control.options) {
                    for (const option of control.options) {
                        const opt = document.createElement("option");
                        opt.text = option.label;
                        opt.value = option.value;
                        if (option.data) {
                            for (const [key, value] of Object.entries(option.data)) {
                                opt.dataset[key] = value;
                            }
                        }
                        select.appendChild(opt);
                    }
                }
                if (typeof control.value === "string") {
                    select.value = control.value;
                }
                select.disabled = Boolean(control.disabled);
                select.id = control.id;
                const handler = (event: Event) => {
                    control.onChange?.({ value: select.value, element: select, event });
                };
                select.addEventListener("change", handler);
                cleanup.push(() => select.removeEventListener("change", handler));
                row.appendChild(select);
                control.enhance?.(select);
                const handle: FormSelectHandle = {
                    kind: "select",
                    element: select,
                    setOptions(options) {
                        select.innerHTML = "";
                        for (const option of options) {
                            const opt = document.createElement("option");
                            opt.text = option.label;
                            opt.value = option.value;
                            if (option.data) {
                                for (const [key, value] of Object.entries(option.data)) {
                                    opt.dataset[key] = value;
                                }
                            }
                            select.appendChild(opt);
                        }
                    },
                    setValue(value: string) {
                        select.value = value;
                    },
                    getValue() {
                        return select.value;
                    },
                    setDisabled(disabled: boolean) {
                        select.disabled = disabled;
                    },
                };
                controls.set(control.id, handle);
                if (index === 0) {
                    label.htmlFor = control.id;
                }
            } else if (control.kind === "slider") {
                const input = createElement("input", control.cls) as HTMLInputElement;
                applyAttributes(input, control.attr);
                input.type = "range";
                input.min = String(control.min);
                input.max = String(control.max);
                input.step = String(control.step ?? 1);
                input.value = String(control.value);
                input.disabled = Boolean(control.disabled);
                input.id = control.id;
                const valueFormatter = control.valueFormatter ?? ((value: number) => String(value));
                let valueEl: HTMLElement | null = null;
                const showValue = control.showValue !== false;
                if (showValue) {
                    valueEl = createElement("span");
                    valueEl.textContent = valueFormatter(Number(input.value));
                }
                const handleInput = (event: Event) => {
                    const value = Number(input.value);
                    if (valueEl) valueEl.textContent = valueFormatter(value);
                    control.onInput?.({ value, element: input, event });
                };
                const handleChange = (event: Event) => {
                    const value = Number(input.value);
                    if (valueEl) valueEl.textContent = valueFormatter(value);
                    control.onChange?.({ value, element: input, event });
                };
                input.addEventListener("input", handleInput);
                input.addEventListener("change", handleChange);
                cleanup.push(() => {
                    input.removeEventListener("input", handleInput);
                    input.removeEventListener("change", handleChange);
                });
                row.appendChild(input);
                if (valueEl) row.appendChild(valueEl);
                const handle: FormSliderHandle = {
                    kind: "slider",
                    element: input,
                    valueElement: valueEl,
                    setValue(value: number) {
                        input.value = String(value);
                        if (valueEl) valueEl.textContent = valueFormatter(value);
                    },
                    getValue() {
                        return Number(input.value);
                    },
                    setDisabled(disabled: boolean) {
                        input.disabled = disabled;
                    },
                };
                controls.set(control.id, handle);
                if (index === 0) {
                    label.htmlFor = control.id;
                }
            } else if (control.kind === "textarea") {
                const textarea = createElement("textarea", control.cls) as HTMLTextAreaElement;
                applyAttributes(textarea, control.attr);
                textarea.value = control.value ?? "";
                textarea.disabled = Boolean(control.disabled);
                if (control.rows) textarea.rows = control.rows;
                if (control.placeholder) textarea.placeholder = control.placeholder;
                textarea.id = control.id;
                const handleInput = (event: Event) => {
                    control.onInput?.({ value: textarea.value, element: textarea, event });
                };
                textarea.addEventListener("input", handleInput);
                cleanup.push(() => textarea.removeEventListener("input", handleInput));
                row.appendChild(textarea);
                const handle: FormTextareaHandle = {
                    kind: "textarea",
                    element: textarea,
                    setValue(value: string) {
                        textarea.value = value;
                    },
                    getValue() {
                        return textarea.value;
                    },
                    setDisabled(disabled: boolean) {
                        textarea.disabled = disabled;
                    },
                };
                controls.set(control.id, handle);
                if (index === 0) {
                    label.htmlFor = control.id;
                }
            } else if (control.kind === "button") {
                const button = createElement("button", control.cls) as HTMLButtonElement;
                applyAttributes(button, control.attr);
                button.type = "button";
                button.textContent = control.label;
                button.disabled = Boolean(control.disabled);
                button.id = control.id;
                const handler = (event: MouseEvent) => {
                    control.onClick?.({ element: button, event });
                };
                button.addEventListener("click", handler);
                cleanup.push(() => button.removeEventListener("click", handler));
                row.appendChild(button);
                const handle: FormButtonHandle = {
                    kind: "button",
                    element: button,
                    setDisabled(disabled: boolean) {
                        button.disabled = disabled;
                    },
                };
                controls.set(control.id, handle);
            }
        });

        root.appendChild(row);
    };

    const createHint = (section: FormHintConfig<HintId>) => {
        const hint = createElement("p", section.cls ?? "sm-inline-hint");
        const handle: FormHintHandle = {
            element: hint,
            set(details) {
                if (!details || !details.text) {
                    hint.style.display = "none";
                    hint.textContent = "";
                    hint.removeAttribute("data-tone");
                    return;
                }
                hint.style.display = "";
                hint.textContent = details.text;
                if (details.tone) {
                    hint.setAttribute("data-tone", details.tone);
                } else {
                    hint.removeAttribute("data-tone");
                }
            },
        };
        if (section.hidden !== false) {
            hint.style.display = "none";
        }
        if (section.tone) {
            hint.setAttribute("data-tone", section.tone);
        }
        root.appendChild(hint);
        hints.set(section.id, handle);
    };

    const createStatus = (section: FormStatusConfig<StatusId>) => {
        const status = createElement("div", section.cls);
        const handle: FormStatusHandle = {
            element: status,
            set(details) {
                const message = details?.message ?? "";
                status.textContent = message;
                status.classList.toggle("is-empty", !message);
                status.classList.toggle("is-loading", details?.tone === "loading");
                status.classList.toggle("is-error", details?.tone === "error");
            },
        };
        status.classList.add("is-empty");
        root.appendChild(status);
        statuses.set(section.id, handle);
    };

    for (const section of config.sections) {
        switch (section.kind) {
            case "header": {
                const level = section.level ?? 3;
                const header = createElement(`h${level}`, section.cls);
                header.textContent = section.text;
                root.appendChild(header);
                break;
            }
            case "row": {
                createRow(section);
                break;
            }
            case "static": {
                const tag = section.tag ?? "div";
                const el = createElement(tag, section.cls);
                if (section.text) el.textContent = section.text;
                root.appendChild(el);
                elements.set(section.id, el);
                break;
            }
            case "hint": {
                createHint(section);
                break;
            }
            case "status": {
                createStatus(section);
                break;
            }
            case "container": {
                const tag = section.tag ?? "div";
                const el = createElement(tag, section.cls);
                root.appendChild(el);
                containers.set(section.id, el);
                break;
            }
        }
    }

    return {
        root,
        getControl(id: FieldId) {
            return controls.get(id) ?? null;
        },
        getElement(id: FieldId) {
            return elements.get(id) ?? null;
        },
        getContainer(id: ContainerId) {
            return containers.get(id) ?? null;
        },
        getHint(id: HintId) {
            return hints.get(id) ?? null;
        },
        getStatus(id: StatusId) {
            return statuses.get(id) ?? null;
        },
        destroy() {
            cleanup.forEach((fn) => {
                try {
                    fn();
                } catch (err) {
                    logger.error("cleanup failed", err);
                }
            });
            cleanup.length = 0;
        },
    };
}
