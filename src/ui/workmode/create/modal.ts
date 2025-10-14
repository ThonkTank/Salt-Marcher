// src/ui/workmode/create/modal.ts
// Unified create modal combining BaseCreateModal + DeclarativeCreateModal functionality
import { App, Modal, Setting, Notice, type ButtonComponent } from "obsidian";
import { createFormCard } from "./components/layouts";
import type { FormCardHandles } from "./components/layouts";
import { buildSerializedPayload, persistSerializedPayload } from "./storage";
import { enhanceSelectToSearch } from "../../search-dropdown";
import { createNumberStepper } from "./components/form-controls";
import { mountTokenEditor } from "./components/token-editor";
import { mountEntryManager, type EntryCategoryDefinition, type EntryFilterDefinition } from "./components/entry-system";
import type {
  AnyFieldSpec,
  CreateSpec,
  FieldRenderHandle,
  OpenCreateModalOptions,
  OpenCreateModalResult,
  SectionSpec,
  SerializedPayload,
} from "./types";

// Inline field rendering - no separate registry needed
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

function renderField(
  container: HTMLElement,
  spec: AnyFieldSpec,
  values: Record<string, unknown>,
  onChange: (id: string, value: unknown) => void,
): FieldRenderHandle & { setErrors?: (errors: string[]) => void; container?: HTMLElement } {
  const setting = new Setting(container).setName(spec.label);
  setting.settingEl.addClass("sm-cc-setting");
  if (spec.help) {
    setting.setDesc(spec.help);
  }
  const validation = createValidationControls(setting);
  const initial = resolveInitialValue(spec, values);

  // Text field
  if (spec.type === "text") {
    setting.addText((text) => {
      text.setPlaceholder(spec.placeholder ?? "");
      const value = typeof initial === "string" ? initial : initial != null ? String(initial) : "";
      text.setValue(value);
      text.onChange((next) => {
        onChange(spec.id, next);
      });
    });
    return {
      setErrors: validation.apply,
      container: setting.settingEl,
    };
  }

  // Textarea / markdown field
  if (spec.type === "textarea" || spec.type === "markdown") {
    const textarea = setting.controlEl.createEl("textarea", {
      cls: "sm-cc-textarea",
      attr: {
        placeholder: spec.placeholder ?? "",
        rows: spec.type === "markdown" ? "12" : "6",
      },
    }) as HTMLTextAreaElement;
    if (initial != null) {
      textarea.value = typeof initial === "string" ? initial : String(initial);
    }
    textarea.addEventListener("input", () => {
      onChange(spec.id, textarea.value);
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
  }

  // Number stepper field
  if (spec.type === "number-stepper") {
    const handle = createNumberStepper(setting.controlEl, {
      value: typeof initial === "number" ? initial : undefined,
      min: spec.min,
      max: spec.max,
      step: spec.step,
      onChange: (value) => {
        onChange(spec.id, value);
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
  }

  // Toggle field
  if (spec.type === "toggle") {
    setting.addToggle((toggle) => {
      toggle.setValue(Boolean(initial));
      toggle.onChange((value) => {
        onChange(spec.id, value);
      });
    });
    return {
      setErrors: validation.apply,
      container: setting.settingEl,
    };
  }

  // Select field
  if (spec.type === "select") {
    setting.addDropdown((dropdown) => {
      const options = spec.options ?? [];
      const fallback = typeof initial === "string" ? initial : "";
      if (!options.some((opt) => opt.value === "")) {
        dropdown.addOption("", "");
      }
      for (const option of options) {
        dropdown.addOption(option.value, option.label);
      }
      dropdown.setValue(fallback);
      dropdown.onChange((value) => {
        onChange(spec.id, value || undefined);
      });
      const selectEl = (dropdown as unknown as { selectEl?: HTMLSelectElement }).selectEl;
      if (selectEl) {
        try {
          enhanceSelectToSearch(selectEl, spec.placeholder ?? "Suchen…");
        } catch (error) {
          console.warn("Enhance select failed", error);
        }
      }
    });
    return {
      setErrors: validation.apply,
      container: setting.settingEl,
    };
  }

  // Multiselect field
  if (spec.type === "multiselect") {
    const selected = new Set<string>(Array.isArray(initial) ? (initial as string[]) : []);
    const options = spec.options ?? [];
    const multiContainer = setting.controlEl.createDiv({ cls: "sm-cc-multiselect" });
    for (const option of options) {
      const item = multiContainer.createDiv({ cls: "sm-cc-multiselect__option" });
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
        onChange(spec.id, Array.from(selected));
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
        const checkboxes = multiContainer.querySelectorAll<HTMLInputElement>("input[type=checkbox]");
        checkboxes.forEach((cb) => {
          cb.checked = selected.has(cb.value);
        });
      },
    };
  }

  // Color field
  if (spec.type === "color") {
    const input = setting.controlEl.createEl("input", { attr: { type: "color" } }) as HTMLInputElement;
    const defaultColor = typeof initial === "string" && /^#[0-9a-fA-F]{6}$/.test(initial) ? initial : "#999999";
    input.value = defaultColor;
    input.addEventListener("input", () => {
      onChange(spec.id, input.value || "#999999");
    });
    input.addEventListener("change", () => {
      onChange(spec.id, input.value || "#999999");
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
  }

  // Tags field
  if (spec.type === "tags") {
    const tagValues = Array.isArray(values[spec.id])
      ? [...(values[spec.id] as string[])]
      : Array.isArray(spec.default)
        ? [...(spec.default as string[])]
        : [];

    // Support suggestions from config
    const suggestions = spec.config?.suggestions as string[] | undefined;

    const model = {
      getItems: () => tagValues,
      add: (value: string) => {
        tagValues.push(value);
        onChange(spec.id, [...tagValues]);
      },
      remove: (index: number) => {
        tagValues.splice(index, 1);
        onChange(spec.id, [...tagValues]);
      },
    };
    const handle = mountTokenEditor(setting.controlEl, spec.label, model, {
      placeholder: spec.placeholder,
      suggestions, // Pass suggestions to token editor
    });
    return {
      setErrors: validation.apply,
      container: handle.setting.settingEl,
      update: (value) => {
        tagValues.splice(0, tagValues.length);
        if (Array.isArray(value)) {
          for (const entry of value) {
            if (typeof entry === "string") tagValues.push(entry);
          }
        }
        handle.refresh();
      },
    };
  }

  // Composite field (nested fields in a grid/custom layout)
  if (spec.type === "composite") {
    const compositeSpec = spec as import("./types").CompositeFieldSpec;
    const config = compositeSpec.config ?? {};
    const childFields = (config.fields as Array<Partial<import("./types").FieldSpec>>) ?? compositeSpec.children ?? [];

    // Create container for composite fields
    setting.settingEl.addClass("sm-cc-composite");
    const compositeContainer = setting.controlEl.createDiv({ cls: "sm-cc-composite-grid" });

    // Render each child field
    const childHandles: Array<ReturnType<typeof renderField>> = [];
    for (const childDef of childFields) {
      const childSpec: import("./types").AnyFieldSpec = {
        id: `${spec.id}.${childDef.id}`,
        label: childDef.label ?? childDef.id ?? "",
        type: childDef.type ?? "text",
        ...childDef,
      };

      const childHandle = renderField(
        compositeContainer,
        childSpec,
        values,
        (childId, childValue) => {
          // Update nested value in parent
          const currentValue = (values[spec.id] as Record<string, unknown>) ?? {};
          const fieldName = childId.replace(`${spec.id}.`, "");
          currentValue[fieldName] = childValue;
          onChange(spec.id, currentValue);
        }
      );
      childHandles.push(childHandle);
    }

    return {
      setErrors: validation.apply,
      container: setting.settingEl,
      update: (value) => {
        if (typeof value === "object" && value !== null) {
          // Update all child fields
          for (const childHandle of childHandles) {
            const fieldName = childHandle.container?.dataset.fieldId;
            if (fieldName) {
              childHandle.update?.((value as Record<string, unknown>)[fieldName], values);
            }
          }
        }
      },
    };
  }

  // Autocomplete field (async search with suggestions)
  if (spec.type === "autocomplete") {
    const autocompleteSpec = spec as import("./types").AutocompleteFieldSpec;
    const { load, renderSuggestion, onSelect, minQueryLength = 2 } = autocompleteSpec.config;

    const input = setting.controlEl.createEl("input", {
      cls: "sm-cc-input sm-cc-autocomplete-input",
      attr: { type: "text", placeholder: spec.placeholder ?? "Search..." },
    }) as HTMLInputElement;

    let suggestionsContainer: HTMLElement | null = null;
    let selectedIndex = -1;

    const hideSuggestions = () => {
      suggestionsContainer?.remove();
      suggestionsContainer = null;
      selectedIndex = -1;
    };

    const showSuggestions = async (query: string) => {
      if (query.length < minQueryLength) {
        hideSuggestions();
        return;
      }

      const items = await Promise.resolve(load(query));
      if (items.length === 0) {
        hideSuggestions();
        return;
      }

      if (!suggestionsContainer) {
        suggestionsContainer = setting.controlEl.createDiv({ cls: "sm-cc-autocomplete-suggestions" });
      }
      suggestionsContainer.empty();
      selectedIndex = -1;

      items.forEach((item, index) => {
        const suggestionEl = suggestionsContainer!.createDiv({ cls: "sm-cc-autocomplete-suggestion" });
        suggestionEl.innerHTML = renderSuggestion(item);
        suggestionEl.addEventListener("click", () => {
          onSelect(item, values);
          input.value = "";
          hideSuggestions();
        });
        suggestionEl.addEventListener("mouseenter", () => {
          selectedIndex = index;
          updateSelection();
        });
      });

      updateSelection();
    };

    const updateSelection = () => {
      if (!suggestionsContainer) return;
      const suggestions = suggestionsContainer.querySelectorAll(".sm-cc-autocomplete-suggestion");
      suggestions.forEach((el, index) => {
        el.classList.toggle("is-selected", index === selectedIndex);
      });
    };

    const selectCurrent = () => {
      if (!suggestionsContainer || selectedIndex < 0) return;
      const suggestions = suggestionsContainer.querySelectorAll<HTMLElement>(".sm-cc-autocomplete-suggestion");
      suggestions[selectedIndex]?.click();
    };

    input.addEventListener("input", () => void showSuggestions(input.value));
    input.addEventListener("blur", () => setTimeout(hideSuggestions, 200));
    input.addEventListener("keydown", (e) => {
      if (!suggestionsContainer) return;
      const count = suggestionsContainer.querySelectorAll(".sm-cc-autocomplete-suggestion").length;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        selectedIndex = (selectedIndex + 1) % count;
        updateSelection();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        selectedIndex = selectedIndex <= 0 ? count - 1 : selectedIndex - 1;
        updateSelection();
      } else if (e.key === "Enter" && selectedIndex >= 0) {
        e.preventDefault();
        selectCurrent();
      } else if (e.key === "Escape") {
        e.preventDefault();
        hideSuggestions();
      }
    });

    return {
      setErrors: validation.apply,
      container: setting.settingEl,
      focus: () => input.focus(),
    };
  }

  // Repeating field (entry lists with add/remove/reorder)
  if (spec.type === "repeating") {
    const repeatingSpec = spec as import("./types").CompositeFieldSpec;
    const config = repeatingSpec.config ?? {};

    // Get or initialize entries array
    const entries = Array.isArray(values[spec.id])
      ? [...(values[spec.id] as Record<string, unknown>[])]
      : Array.isArray(spec.default)
        ? [...(spec.default as Record<string, unknown>[])]
        : [];

    // Extract configuration
    const categories = (config.categories as EntryCategoryDefinition<string>[]) ?? [];
    const filters = (config.filters as EntryFilterDefinition<Record<string, unknown>, string>[]) ?? undefined;
    const itemTemplate = repeatingSpec.itemTemplate ?? {};

    // Validate required config
    if (!categories.length) {
      console.warn(`Repeating field "${spec.id}" has no categories defined`);
      const fallback = container.createDiv({ cls: "sm-cc-field--error" });
      fallback.createEl("label", { text: spec.label });
      fallback.createEl("p", { text: "No categories defined for repeating field" });
      return { container: fallback };
    }

    const renderEntry = config.renderEntry as ((container: HTMLElement, context: any) => HTMLElement) | undefined;
    const cardFactory = config.card as ((context: any) => any) | undefined;

    if (!renderEntry && !cardFactory) {
      console.warn(`Repeating field "${spec.id}" requires renderEntry or card in config`);
      const fallback = container.createDiv({ cls: "sm-cc-field--error" });
      fallback.createEl("label", { text: spec.label });
      fallback.createEl("p", { text: "No renderer defined for repeating field" });
      return { container: fallback };
    }

    // Create entry factory from itemTemplate
    const createEntry = (category: string): Record<string, unknown> => {
      const entry: Record<string, unknown> = { category };
      for (const [key, fieldDef] of Object.entries(itemTemplate)) {
        if (fieldDef.default !== undefined) {
          entry[key] = fieldDef.default;
        }
      }
      return entry;
    };

    const handle = mountEntryManager(setting.controlEl, {
      label: spec.label,
      entries,
      categories,
      filters,
      createEntry,
      renderEntry,
      card: cardFactory,
      onEntriesChanged: (updated) => {
        onChange(spec.id, updated);
      },
      insertPosition: (config.insertPosition as "start" | "end") ?? "end",
    });

    return {
      setErrors: validation.apply,
      container: setting.settingEl,
      update: (value) => {
        if (Array.isArray(value)) {
          entries.splice(0, entries.length, ...value as Record<string, unknown>[]);
          handle.rerender();
        }
      },
    };
  }

  // Unsupported field type
  const fallback = container.createDiv({ cls: "sm-cc-field--unsupported" });
  fallback.createEl("label", { text: spec.label });
  fallback.createEl("p", { text: `Unsupported field type: ${spec.type}` });
  return { container: fallback };
}

interface NamedDraft extends Record<string, unknown> {
  name: string;
}

interface FieldInstance {
  spec: AnyFieldSpec;
  handle: FieldRenderHandle & { setErrors?: (errors: string[]) => void; container?: HTMLElement };
  container?: HTMLElement;
  isVisible: boolean;
}

interface SchemaErrorIssue {
  path?: Array<string | number>;
  message?: string;
}

interface ModalSerializationResult<TSerialized> {
  values: TSerialized;
  payload: SerializedPayload;
}

function deepClone<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function resolveDefaults<TDraft extends NamedDraft>(
  spec: CreateSpec<TDraft, unknown>,
  name: string,
): Partial<TDraft> {
  const fromSpec = typeof spec.defaults === "function"
    ? spec.defaults({ presetName: name })
    : spec.defaults;
  return fromSpec ? { ...fromSpec } : {};
}

function orderFields(fields: AnyFieldSpec[], ids: string[] | undefined): AnyFieldSpec[] {
  if (!ids || ids.length === 0) return fields;
  const lookup = new Map(fields.map((field) => [field.id, field] as const));
  const ordered: AnyFieldSpec[] = [];
  const used = new Set<string>();
  for (const id of ids) {
    const entry = lookup.get(id);
    if (!entry) continue;
    ordered.push(entry);
    used.add(id);
  }
  for (const field of fields) {
    if (!used.has(field.id)) ordered.push(field);
  }
  return ordered;
}

function extractSchemaIssues(error: unknown): SchemaErrorIssue[] {
  if (!error || typeof error !== "object") return [];
  const maybeIssues = (error as { issues?: unknown }).issues;
  if (!Array.isArray(maybeIssues)) return [];
  return maybeIssues.filter((issue): issue is SchemaErrorIssue => typeof issue === "object" && issue !== null);
}

/**
 * Unified create modal that supports both declarative field specs and direct section mounting.
 * Combines the functionality of BaseCreateModal and DeclarativeCreateModal.
 */
export class CreateModal<
  TDraft extends NamedDraft,
  TSerialized = TDraft,
> extends Modal {
  private readonly spec: CreateSpec<TDraft, TSerialized>;
  private readonly resolveResult: (result: OpenCreateModalResult | null) => void;
  private readonly data: TDraft;
  private readonly fieldInstances = new Map<string, FieldInstance>();
  private readonly sectionOrder: SectionSpec[];
  private fieldIssues = new Map<string, string[]>();
  private completion: OpenCreateModalResult | null = null;
  private resolved = false;

  // Navigation support
  private sectionObserver: IntersectionObserver | null = null;
  private navButtons: Array<{ id: string; button: HTMLButtonElement }> = [];
  private validators: Array<() => string[]> = [];

  // Background pointer lock
  private bgLock: { el: HTMLElement; pointer: string } | null = null;

  // Submission state
  private submitButton: ButtonComponent | null = null;
  private cancelButton: ButtonComponent | null = null;
  private isSubmitting = false;

  constructor(
    app: App,
    spec: CreateSpec<TDraft, TSerialized>,
    options: OpenCreateModalOptions | undefined,
    resolve: (result: OpenCreateModalResult | null) => void,
  ) {
    super(app);
    this.spec = spec;
    this.resolveResult = resolve;
    this.sectionOrder = spec.ui?.sections ?? [];

    const preset = options?.preset as string | TDraft | undefined;
    const defaultName = this.resolveDefaultName();

    // Initialize data
    const providedName = typeof preset === "string"
      ? preset
      : typeof preset === "object" && preset && "name" in preset
        ? String((preset as Record<string, unknown>).name ?? defaultName)
        : defaultName;

    const base = this.createDefault(providedName);
    let merged: TDraft = { ...base };

    if (preset && typeof preset === "object") {
      merged = { ...merged, ...(preset as TDraft) };
    }

    const defaults = resolveDefaults(spec, providedName);
    merged = { ...this.createDefault(providedName), ...defaults, ...merged };

    if (options?.initialize) {
      const adjusted = options.initialize(deepClone(merged));
      if (adjusted && typeof adjusted === "object") {
        merged = { ...merged, ...(adjusted as TDraft) };
      }
    }

    this.data = merged;
  }

  protected createDefault(name: string): TDraft {
    const defaults = resolveDefaults(this.spec, name);
    const draft: Record<string, unknown> = { name };

    for (const field of this.spec.fields) {
      if (defaults[field.id] !== undefined) {
        draft[field.id] = defaults[field.id];
        continue;
      }
      if (field.default !== undefined) {
        draft[field.id] = field.default;
      }
    }

    if (draft[this.spec.storage.filenameFrom] === undefined) {
      draft[this.spec.storage.filenameFrom] = draft.name;
    }

    return draft as TDraft;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("sm-cc-create-modal");
    this.validators = [];
    this.navButtons = [];

    // Lock background pointer
    this.lockBackgroundPointer();

    const navigationEnabled = this.spec.ui?.enableNavigation ?? Boolean(this.sectionOrder.length);

    // Apply modal layout CSS if navigation is enabled
    if (navigationEnabled) {
      this.modalEl.addClass("sm-cc-create-modal-host");
    }

    // Build content based on navigation mode
    if (navigationEnabled && this.sectionOrder.length) {
      this.buildNavigationLayout(contentEl);
    } else {
      this.buildSimpleLayout(contentEl);
    }
  }

  private buildSimpleLayout(contentEl: HTMLElement): void {
    // Title
    contentEl.createEl("h3", { text: this.spec.title });

    // Build fields
    this.renderFields(contentEl, undefined);

    // Submit and Cancel buttons
    this.buildActionButtons(contentEl);

    // Optional: Register Enter key to submit
    this.scope.register([], "Enter", (evt) => {
      // Only submit if not in a textarea
      if (!(evt.target instanceof HTMLTextAreaElement)) {
        void this.submit();
      }
    });
  }

  private buildNavigationLayout(contentEl: HTMLElement): void {
    // Header
    const header = contentEl.createDiv({ cls: "sm-cc-modal-header" });
    header.createEl("h2", { text: this.spec.title });
    if (this.spec.subtitle) {
      header.createEl("p", {
        cls: "sm-cc-modal-subtitle",
        text: this.spec.subtitle,
      });
    }

    // Shell layout
    const shell = contentEl.createDiv({ cls: "sm-cc-shell" });
    const nav = shell.createEl("nav", { cls: "sm-cc-shell__nav", attr: { "aria-label": "Abschnitte" } });
    nav.createEl("p", { cls: "sm-cc-shell__nav-label", text: "Abschnitte" });
    const navList = nav.createDiv({ cls: "sm-cc-shell__nav-list" });
    const content = shell.createDiv({ cls: "sm-cc-shell__content" });

    // Active section tracking
    const setActive = (sectionId: string | null) => {
      for (const entry of this.navButtons) {
        const isActive = entry.id === sectionId;
        entry.button.classList.toggle("is-active", isActive);
        if (isActive) {
          entry.button.setAttribute("aria-current", "true");
        } else {
          entry.button.removeAttribute("aria-current");
        }
      }
    };

    // IntersectionObserver for auto-highlighting visible section
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting);
      if (!visible.length) return;
      visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      const next = (visible[0].target as HTMLElement).id;
      if (next) setActive(next);
    }, { root: contentEl, rootMargin: "-45% 0px -45% 0px", threshold: 0 });
    this.sectionObserver = observer;

    // Create sections
    for (const section of this.sectionOrder) {
      this.createSection(section, content, navList, observer, setActive);
    }

    // Set first section as active
    if (this.sectionOrder.length) {
      setActive(this.sectionOrder[0].id);
    }

    // Footer with buttons
    const footer = contentEl.createDiv({ cls: "sm-cc-modal-footer" });
    this.buildActionButtons(footer);
  }

  private createSection(
    section: SectionSpec,
    content: HTMLElement,
    navList: HTMLElement,
    observer: IntersectionObserver,
    setActive: (id: string | null) => void
  ): void {
    const handles = createFormCard(content, {
      title: section.label,
      subtitle: section.description,
      registerValidator: (runner) => this.addValidator(runner),
      id: section.id,
    });

    const navButton = navList.createEl("button", {
      cls: "sm-cc-shell__nav-button",
      text: section.label,
    }) as HTMLButtonElement;
    navButton.type = "button";
    navButton.setAttribute("aria-controls", handles.card.id);
    this.navButtons.push({ id: handles.card.id, button: navButton });

    navButton.addEventListener("click", () => {
      setActive(handles.card.id);
      handles.card.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    observer.observe(handles.card);
    this.mountSection(handles, section);
  }

  private mountSection(handles: FormCardHandles, section: SectionSpec): void {
    const ordered = orderFields(this.spec.fields, section.fieldIds);
    for (const field of ordered) {
      this.renderSingleField(handles.body, field);
    }
    handles.registerValidation(() => {
      const issues: string[] = [];
      for (const field of ordered) {
        const fieldErrors = this.fieldIssues.get(field.id) ?? [];
        if (fieldErrors.length) {
          issues.push(`${field.label}: ${fieldErrors[0]}`);
        }
      }
      const summary = issues.length > 0 ? `${issues.length} Feld${issues.length > 1 ? "er" : ""} benötigt Aufmerksamkeit` : undefined;
      return { issues, summary };
    });
  }

  private renderFields(container: HTMLElement, fieldIds: string[] | undefined): void {
    const ordered = orderFields(this.spec.fields, fieldIds);
    for (const field of ordered) {
      this.renderSingleField(container, field);
    }
    this.updateFieldVisibility();
  }

  private renderSingleField(container: HTMLElement, field: AnyFieldSpec): void {
    const handle = renderField(
      container,
      field,
      this.data,
      (id, value) => this.handleFieldChange(id, value),
    );

    this.fieldInstances.set(field.id, {
      spec: field,
      handle,
      container: handle.container,
      isVisible: true,
    });
  }

  private handleFieldChange(id: string, value: unknown): void {
    if (id === "name" && typeof value === "string") {
      (this.data as NamedDraft).name = value.trim();
    }
    (this.data as Record<string, unknown>)[id] = value;
    this.updateFieldVisibility();
  }

  private updateFieldVisibility(): void {
    for (const [id, instance] of this.fieldInstances) {
      const visible = this.evaluateVisibility(instance.spec);
      instance.isVisible = visible;
      const target = instance.container;
      if (target) {
        target.toggleClass("is-hidden", !visible);
        if (!visible) {
          instance.handle.setErrors?.([]);
        }
      }
    }
  }

  private evaluateVisibility(field: AnyFieldSpec): boolean {
    if (!field.visibleIf) return true;
    try {
      return field.visibleIf(this.data);
    } catch (error) {
      console.error("Failed to evaluate field visibility", error);
      return true;
    }
  }

  private buildActionButtons(container: HTMLElement): void {
    const buttons = new Setting(container);

    buttons.addButton(btn => {
      this.cancelButton = btn;
      btn.setButtonText(this.spec.ui?.cancelLabel || "Abbrechen")
        .onClick(() => {
          if (this.isSubmitting) return;
          this.close();
        });
    });

    buttons.addButton(btn => {
      this.submitButton = btn;
      btn.setButtonText(this.spec.ui?.submitLabel || "Erstellen")
        .setCta()
        .onClick(() => void this.submit());
    });
  }

  private async submit(): Promise<void> {
    if (this.isSubmitting) return;

    // Run all validators (for navigation mode)
    const validatorIssues = this.runValidators();

    // Run field validation
    const fieldIssues = this.collectValidationIssues();

    // Combine all issues
    const allIssues = [...validatorIssues, ...fieldIssues];

    // Display validation errors if any
    if (allIssues.length > 0) {
      if (this.spec.ui?.enableNavigation) {
        // In navigation mode, scroll to first invalid card
        const firstInvalid = this.contentEl.querySelector(".sm-cc-card.is-invalid") as HTMLElement | null;
        if (firstInvalid) firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    // Basic name validation
    if (!this.data.name || !this.data.name.trim()) {
      return;
    }

    this.setButtonsDisabled(true);
    this.isSubmitting = true;

    try {
      const serialized = await this.serializeDraft(this.data);
      const result = await this.persistDraft(serialized);
      await this.spec.transformers?.postSave?.(result.filePath, serialized.values);
      this.completion = result;
      this.close();
    } catch (error) {
      console.error("Failed to submit create modal", error);
      this.handleSubmissionError(error);
    } finally {
      this.isSubmitting = false;
      this.setButtonsDisabled(false);
    }
  }

  private collectValidationIssues(): string[] {
    const fieldIssues = new Map<string, string[]>();
    const summary: string[] = [];

    for (const [id, instance] of this.fieldInstances) {
      if (!instance.isVisible) {
        instance.handle.setErrors?.([]);
        fieldIssues.set(id, []);
        continue;
      }

      const value = (this.data as Record<string, unknown>)[id];
      const issues: string[] = [];

      if (instance.spec.required) {
        if (value === undefined || value === null || value === "") {
          issues.push("Pflichtfeld");
        } else if (Array.isArray(value) && value.length === 0) {
          issues.push("Mindestens ein Wert erforderlich");
        }
      }

      if (instance.spec.validate) {
        try {
          const result = instance.spec.validate(value as never, this.data);
          if (typeof result === "string" && result.trim()) {
            issues.push(result.trim());
          }
        } catch (error) {
          issues.push(String(error));
        }
      }

      instance.handle.setErrors?.(issues);
      fieldIssues.set(id, issues);

      if (issues.length) {
        summary.push(`${instance.spec.label}: ${issues[0]}`);
      }
    }

    const transformed = this.applyFieldTransforms(this.data);
    const schema = this.spec.schema.safeParse(transformed);

    if (!schema.success) {
      const issues = extractSchemaIssues(schema.error);
      if (issues.length === 0) {
        summary.push(String(schema.error));
      }
      for (const issue of issues) {
        const target = issue.path?.[0];
        if (typeof target === "string" && fieldIssues.has(target)) {
          const list = fieldIssues.get(target)!;
          if (issue.message) {
            list.push(issue.message);
          }
          summary.push(`${target}: ${issue.message ?? "Ungültiger Wert"}`);
        } else if (issue.message) {
          summary.push(issue.message);
        }
      }
    }

    for (const [id, instance] of this.fieldInstances) {
      const issues = fieldIssues.get(id) ?? [];
      instance.handle.setErrors?.(issues);
    }

    this.fieldIssues = fieldIssues;
    return summary;
  }

  private applyFieldTransforms(data: TDraft): Record<string, unknown> {
    const result: Record<string, unknown> = { ...data };
    for (const field of this.spec.fields) {
      if (!field.transform) continue;
      try {
        const transformed = field.transform(result[field.id] as never, result);
        result[field.id] = transformed;
      } catch (error) {
        console.error(`Transform failed for field ${field.id}`, error);
      }
    }
    return result;
  }

  private async serializeDraft(draft: TDraft): Promise<ModalSerializationResult<TSerialized>> {
    const transformed = this.applyFieldTransforms(draft);
    const parsed = this.spec.schema.parse(transformed) as TSerialized;
    const prepared = this.spec.transformers?.preSave ? this.spec.transformers.preSave(parsed) : parsed;
    const payload = buildSerializedPayload(this.spec.storage, prepared as unknown as Record<string, unknown>);
    return { values: prepared, payload };
  }

  private async persistDraft(
    serialized: ModalSerializationResult<TSerialized>,
  ): Promise<OpenCreateModalResult> {
    const result = await persistSerializedPayload(this.app, this.spec.storage, serialized.payload);
    return { filePath: result.filePath, values: serialized.values as Record<string, any> };
  }

  onClose(): void {
    // Cleanup navigation
    this.sectionObserver?.disconnect();
    this.sectionObserver = null;
    this.navButtons = [];
    this.validators = [];

    // Cleanup modal layout
    this.modalEl.removeClass("sm-cc-create-modal-host");

    // Restore background pointer
    this.restoreBackgroundPointer();

    // Resolve promise
    if (!this.resolved) {
      this.resolved = true;
      this.resolveResult(this.completion);
    }

    this.contentEl.empty();
    this.submitButton = null;
    this.cancelButton = null;
    this.isSubmitting = false;
  }

  private addValidator(run: () => string[]): () => string[] {
    this.validators.push(run);
    return run;
  }

  private runValidators(): string[] {
    const collected: string[] = [];
    for (const validator of this.validators) {
      collected.push(...validator());
    }
    return collected;
  }

  private setButtonsDisabled(disabled: boolean): void {
    this.submitButton?.setDisabled(disabled);
    this.cancelButton?.setDisabled(disabled);
  }

  private handleSubmissionError(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error ?? "Unbekannter Fehler");
    new Notice(`Fehler beim Speichern: ${message}`);
  }

  private lockBackgroundPointer(): void {
    const bg = document.querySelector('.modal-bg') as HTMLElement | null;
    if (!bg) return;
    this.bgLock = { el: bg, pointer: bg.style.pointerEvents };
    bg.style.pointerEvents = 'none';
  }

  private restoreBackgroundPointer(): void {
    if (!this.bgLock) return;
    this.bgLock.el.style.pointerEvents = this.bgLock.pointer || '';
    this.bgLock = null;
  }

  private resolveDefaultName(): string {
    const nameField = this.spec.fields.find((field) => field.id === "name");
    if (nameField && typeof nameField.default === "string" && nameField.default.trim()) {
      return nameField.default;
    }
    const kind = this.spec.kind || "Eintrag";
    const normalized = kind.charAt(0).toUpperCase() + kind.slice(1);
    return `Neue/r ${normalized}`;
  }
}
