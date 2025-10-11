// src/ui/workmode/create/field-registry.ts
// Default renderer registry for declarative workmode create fields.
import { Setting } from "obsidian";
import { enhanceSelectToSearch } from "../../search-dropdown";
import { createNumberStepper } from "./form-controls";
import { mountTokenEditor } from "./token-editor";
import type {
  AnyFieldSpec,
  FieldRegistryEntry,
  RenderFieldArgs,
} from "./types";

interface ValidationControls {
  apply: (errors: string[]) => void;
  container: HTMLElement;
}

function createValidationControls(setting: Setting): ValidationControls {
  const container = setting.settingEl.createDiv({ cls: "sm-cc-field__errors", attr: { hidden: "" } });
  const list = container.createEl("ul", { cls: "sm-cc-field__errors-list" });
  const apply = (errors: string[]) => {
    const hasErrors = errors.length > 0;
    setting.settingEl.toggleClass("is-invalid", hasErrors);
    if (!hasErrors) {
      container.setAttribute("hidden", "");
      container.classList.remove("is-visible");
      list.empty();
      return;
    }
    container.removeAttribute("hidden");
    container.classList.add("is-visible");
    list.empty();
    for (const issue of errors) {
      list.createEl("li", { text: issue });
    }
  };
  return { apply, container };
}

function resolveInitialValue(spec: AnyFieldSpec, values: Record<string, unknown>) {
  if (values[spec.id] !== undefined) return values[spec.id];
  if (spec.default !== undefined) return spec.default;
  return undefined;
}

function baseSetting(args: RenderFieldArgs): { setting: Setting; validation: ValidationControls } {
  const setting = new Setting(args.container).setName(args.spec.label);
  setting.settingEl.addClass("sm-cc-setting");
  if (args.spec.help) {
    setting.setDesc(args.spec.help);
  }
  const validation = createValidationControls(setting);
  return { setting, validation };
}

function registerTextField(): FieldRegistryEntry {
  return {
    supports: (spec) => spec.type === "text",
    render: (args) => {
      const { setting, validation } = baseSetting(args);
      const initial = resolveInitialValue(args.spec, args.values);
      setting.addText((text) => {
        text.setPlaceholder(args.spec.placeholder ?? "");
        const value = typeof initial === "string" ? initial : initial != null ? String(initial) : "";
        text.setValue(value);
        text.onChange((next) => {
          args.onChange(args.spec.id, next);
        });
      });
      return {
        setErrors: validation.apply,
        container: setting.settingEl,
      };
    },
  };
}

function registerTextareaField(): FieldRegistryEntry {
  return {
    supports: (spec) => spec.type === "textarea" || spec.type === "markdown",
    render: (args) => {
      const { setting, validation } = baseSetting(args);
      const initial = resolveInitialValue(args.spec, args.values);
      const textarea = setting.controlEl.createEl("textarea", {
        cls: "sm-cc-textarea",
        attr: {
          placeholder: args.spec.placeholder ?? "",
          rows: args.spec.type === "markdown" ? "12" : "6",
        },
      }) as HTMLTextAreaElement;
      if (initial != null) {
        textarea.value = typeof initial === "string" ? initial : String(initial);
      }
      textarea.addEventListener("input", () => {
        args.onChange(args.spec.id, textarea.value);
      });
      return {
        setErrors: validation.apply,
        container: setting.settingEl,
        focus: () => textarea.focus(),
        update: (value) => {
          const next = value == null ? "" : String(value);
          if (textarea.value !== next) textarea.value = next;
        },
      };
    },
  };
}

function registerNumberField(): FieldRegistryEntry {
  return {
    supports: (spec) => spec.type === "number-stepper",
    render: (args) => {
      const { setting, validation } = baseSetting(args);
      const initial = resolveInitialValue(args.spec, args.values);
      const handle = createNumberStepper(setting.controlEl, {
        value: typeof initial === "number" ? initial : undefined,
        min: args.spec.min,
        max: args.spec.max,
        step: args.spec.step,
        onChange: (value) => {
          args.onChange(args.spec.id, value);
        },
      });
      return {
        setErrors: validation.apply,
        container: setting.settingEl,
        focus: () => handle.input.focus(),
        update: (value) => {
          if (typeof value === "number") {
            handle.setValue(value);
          } else {
            handle.setValue(undefined);
          }
        },
      };
    },
  };
}

function registerToggleField(): FieldRegistryEntry {
  return {
    supports: (spec) => spec.type === "toggle",
    render: (args) => {
      const { setting, validation } = baseSetting(args);
      const initial = resolveInitialValue(args.spec, args.values);
      setting.addToggle((toggle) => {
        toggle.setValue(Boolean(initial));
        toggle.onChange((value) => {
          args.onChange(args.spec.id, value);
        });
      });
      return {
        setErrors: validation.apply,
        container: setting.settingEl,
      };
    },
  };
}

function registerSelectField(): FieldRegistryEntry {
  return {
    supports: (spec) => spec.type === "select",
    render: (args) => {
      const { setting, validation } = baseSetting(args);
      const initial = resolveInitialValue(args.spec, args.values);
      setting.addDropdown((dropdown) => {
        const options = args.spec.options ?? [];
        const fallback = typeof initial === "string" ? initial : "";
        if (!options.some((opt) => opt.value === "")) {
          dropdown.addOption("", "");
        }
        for (const option of options) {
          dropdown.addOption(option.value, option.label);
        }
        dropdown.setValue(fallback);
        dropdown.onChange((value) => {
          args.onChange(args.spec.id, value || undefined);
        });
        const selectEl = (dropdown as unknown as { selectEl?: HTMLSelectElement }).selectEl;
        if (selectEl) {
          try {
            enhanceSelectToSearch(selectEl, args.spec.placeholder ?? "Suchen…");
          } catch (error) {
            console.warn("Enhance select failed", error);
          }
        }
      });
      return {
        setErrors: validation.apply,
        container: setting.settingEl,
      };
    },
  };
}

function registerMultiselectField(): FieldRegistryEntry {
  return {
    supports: (spec) => spec.type === "multiselect",
    render: (args) => {
      const { setting, validation } = baseSetting(args);
      const initial = resolveInitialValue(args.spec, args.values);
      const selected = new Set<string>(Array.isArray(initial) ? (initial as string[]) : []);
      const options = args.spec.options ?? [];
      const container = setting.controlEl.createDiv({ cls: "sm-cc-multiselect" });
      for (const option of options) {
        const item = container.createDiv({ cls: "sm-cc-multiselect__option" });
        const checkbox = item.createEl("input", { attr: { type: "checkbox" } }) as HTMLInputElement;
        checkbox.value = option.value;
        checkbox.checked = selected.has(option.value);
        const label = item.createEl("label");
        label.textContent = option.label;
        checkbox.addEventListener("change", () => {
          if (checkbox.checked) {
            selected.add(option.value);
          } else {
            selected.delete(option.value);
          }
          args.onChange(args.spec.id, Array.from(selected));
        });
      }
      return {
        setErrors: validation.apply,
        container: setting.settingEl,
        update: (value) => {
          selected.clear();
          if (Array.isArray(value)) {
            for (const entry of value) {
              if (typeof entry === "string") selected.add(entry);
            }
          }
          const checkboxes = container.querySelectorAll<HTMLInputElement>("input[type=checkbox]");
          checkboxes.forEach((cb) => {
            cb.checked = selected.has(cb.value);
          });
        },
      };
    },
  };
}

function registerColorField(): FieldRegistryEntry {
  return {
    supports: (spec) => spec.type === "color",
    render: (args) => {
      const { setting, validation } = baseSetting(args);
      const initial = resolveInitialValue(args.spec, args.values);
      const input = setting.controlEl.createEl("input", { attr: { type: "color" } }) as HTMLInputElement;
      const defaultColor = typeof initial === "string" && /^#[0-9a-fA-F]{6}$/.test(initial) ? initial : "#999999";
      input.value = defaultColor;
      input.addEventListener("input", () => {
        args.onChange(args.spec.id, input.value || "#999999");
      });
      input.addEventListener("change", () => {
        args.onChange(args.spec.id, input.value || "#999999");
      });
      return {
        setErrors: validation.apply,
        container: setting.settingEl,
        focus: () => input.focus(),
        update: (value) => {
          if (typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value)) {
            input.value = value;
          }
        },
      };
    },
  };
}

function registerTagsField(): FieldRegistryEntry {
  return {
    supports: (spec) => spec.type === "tags",
    render: (args) => {
      const { setting, validation } = baseSetting(args);
      const values = Array.isArray(args.values[args.spec.id])
        ? [...(args.values[args.spec.id] as string[])]
        : Array.isArray(args.spec.default)
          ? [...(args.spec.default as string[])]
          : [];
      const model = {
        getItems: () => values,
        add: (value: string) => {
          values.push(value);
          args.onChange(args.spec.id, [...values]);
        },
        remove: (index: number) => {
          values.splice(index, 1);
          args.onChange(args.spec.id, [...values]);
        },
      };
      const handle = mountTokenEditor(setting.controlEl, args.spec.label, model, {
        placeholder: args.spec.placeholder,
      });
      return {
        setErrors: validation.apply,
        container: handle.setting.settingEl,
        update: (value) => {
          values.splice(0, values.length);
          if (Array.isArray(value)) {
            for (const entry of value) {
              if (typeof entry === "string") values.push(entry);
            }
          }
          handle.refresh();
        },
      };
    },
  };
}

export function createDefaultFieldRegistry(): FieldRegistryEntry[] {
  return [
    registerTextField(),
    registerTextareaField(),
    registerNumberField(),
    registerColorField(),
    registerToggleField(),
    registerSelectField(),
    registerMultiselectField(),
    registerTagsField(),
  ];
}

export function findRenderer(registry: FieldRegistryEntry[], spec: AnyFieldSpec): FieldRegistryEntry | null {
  for (const entry of registry) {
    if (entry.supports(spec)) return entry;
  }
  return null;
}
