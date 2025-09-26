"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => LayoutEditorPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian6 = require("obsidian");

// src/view.ts
var import_obsidian5 = require("obsidian");

// src/search-dropdown.ts
function enhanceSelectToSearch(select, placeholder = "Suchen\u2026") {
  if (!select || select._leEnhanced) return;
  const wrap = document.createElement("div");
  wrap.className = "sm-sd";
  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = placeholder;
  input.className = "sm-sd__input";
  const menu = document.createElement("div");
  menu.className = "sm-sd__menu";
  const parent = select.parentElement;
  if (!parent) return;
  parent.insertBefore(wrap, select);
  wrap.appendChild(input);
  wrap.appendChild(menu);
  select.style.display = "none";
  try {
    const rect = select.getBoundingClientRect();
    if (rect && rect.width) wrap.style.width = `${rect.width}px`;
  } catch (error) {
    console.warn("enhanceSelectToSearch: unable to read select width", error);
  }
  let items = [];
  let active = -1;
  const readOptions = () => {
    items = Array.from(select.options).map((opt) => ({ label: opt.text, value: opt.value }));
  };
  const openMenu = () => {
    wrap.classList.add("is-open");
  };
  const closeMenu = () => {
    wrap.classList.remove("is-open");
    active = -1;
  };
  const render = (query = "") => {
    readOptions();
    if (query === "__NOOPEN__") {
      menu.innerHTML = "";
      closeMenu();
      return;
    }
    const normalized = query.toLowerCase();
    const matches = items.filter((it) => !normalized || it.label.toLowerCase().includes(normalized)).slice(0, 50);
    menu.innerHTML = "";
    matches.forEach((item, idx) => {
      const el = document.createElement("div");
      el.className = "sm-sd__item";
      el.textContent = item.label;
      item.el = el;
      el.onclick = () => {
        select.value = item.value;
        select.dispatchEvent(new Event("change"));
        input.value = item.label;
        closeMenu();
      };
      menu.appendChild(el);
    });
    if (matches.length) {
      openMenu();
    } else {
      closeMenu();
    }
  };
  const highlight = (options) => {
    options.forEach((el2, idx) => el2.classList.toggle("is-active", idx === active));
    const el = options[active];
    if (el) el.scrollIntoView({ block: "nearest" });
  };
  input.addEventListener("focus", () => {
    input.select();
    render("");
  });
  input.addEventListener("input", () => render(input.value));
  input.addEventListener("keydown", (ev) => {
    if (!wrap.classList.contains("is-open")) return;
    const options = Array.from(menu.children);
    if (ev.key === "ArrowDown") {
      active = Math.min(options.length - 1, active + 1);
      highlight(options);
      ev.preventDefault();
    } else if (ev.key === "ArrowUp") {
      active = Math.max(0, active - 1);
      highlight(options);
      ev.preventDefault();
    } else if (ev.key === "Enter") {
      if (options[active]) {
        options[active].click();
        ev.preventDefault();
      }
    } else if (ev.key === "Escape") {
      closeMenu();
    }
  });
  input.addEventListener("blur", () => {
    window.setTimeout(closeMenu, 120);
  });
  select._leEnhanced = true;
  select._leSearchInput = input;
}

// src/elements/shared/container-preview.ts
function renderContainerPreview({ preview, element, elements, ensureContainerDefaults }) {
  ensureContainerDefaults(element);
  const frame = preview.createDiv({ cls: "sm-le-preview__container" });
  const header = frame.createDiv({ cls: "sm-le-preview__container-header" });
  const labelText = element.label?.trim() ?? "";
  if (labelText) {
    header.createSpan({ cls: "sm-le-preview__label", text: labelText });
  } else {
    header.style.display = "none";
  }
  const body = frame.createDiv({ cls: "sm-le-preview__container-body" });
  const hasChildren = Array.isArray(element.children) ? element.children.some((childId) => elements.some((el) => el.id === childId)) : false;
  if (!hasChildren) {
    body.createDiv({ cls: "sm-le-preview__container-placeholder", text: "Leerer Container" });
  }
}

// src/elements/shared/component-bases.ts
var ElementComponentBase = class {
  constructor(definition) {
    this.definition = definition;
  }
};
var FieldComponent = class extends ElementComponentBase {
  constructor(definition, options = {}) {
    super(definition);
    this.inspectorLabel = options.inspectorLabel ?? "Bezeichnung";
    this.placeholderInspectorLabel = options.placeholderInspectorLabel;
  }
  createFieldWrapper(preview, element, config = {}) {
    const { tagName = "label", fieldClass = "sm-le-preview__field", includeLabel = true, labelClass = "sm-le-preview__label" } = config;
    const field = preview.createEl(tagName, { cls: fieldClass });
    let labelHost;
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
  renderInspector({ renderLabelField: renderLabelField2, renderPlaceholderField: renderPlaceholderField2 }) {
    renderLabelField2({ label: this.inspectorLabel });
    if (this.placeholderInspectorLabel) {
      renderPlaceholderField2({ label: this.placeholderInspectorLabel });
    }
  }
};
var TextFieldComponent = class extends FieldComponent {
  constructor(definition, options = {}) {
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
  renderPreview({ preview, element, finalize }) {
    const { field } = this.createFieldWrapper(preview, element, {
      tagName: this.wrapperTag,
      fieldClass: this.wrapperClass,
      includeLabel: this.showLabelInPreview,
      labelClass: this.labelClass
    });
    if (this.multiline) {
      const textarea = field.createEl("textarea", { cls: this.inputClass });
      textarea.value = element.defaultValue ?? "";
      if (this.supportsPlaceholder) {
        textarea.placeholder = element.placeholder ?? "";
      } else {
        textarea.placeholder = "";
        if (element.placeholder !== void 0) {
          element.placeholder = void 0;
        }
      }
      textarea.rows = this.rows;
      let lastValue2 = textarea.value;
      textarea.addEventListener("input", () => {
        element.defaultValue = textarea.value ? textarea.value : void 0;
      });
      textarea.addEventListener("blur", () => {
        const next = textarea.value;
        if (next === lastValue2) return;
        lastValue2 = next;
        element.defaultValue = next ? next : void 0;
        finalize(element);
      });
      return;
    }
    const input = field.createEl("input", { attr: { type: this.inputType }, cls: this.inputClass });
    input.value = element.defaultValue ?? "";
    if (this.supportsPlaceholder) {
      input.placeholder = element.placeholder ?? "";
    } else {
      input.placeholder = "";
      if (element.placeholder !== void 0) {
        element.placeholder = void 0;
      }
    }
    let lastValue = input.value;
    input.addEventListener("input", () => {
      element.defaultValue = input.value ? input.value : void 0;
    });
    input.addEventListener("blur", () => {
      const next = input.value;
      if (next === lastValue) return;
      lastValue = next;
      element.defaultValue = next ? next : void 0;
      finalize(element);
    });
  }
};
var ContainerComponent = class extends ElementComponentBase {
  constructor(definition, options = {}) {
    super(definition);
    if (!definition.defaultLayout) {
      throw new Error(`Container component "${definition.type}" requires a default layout configuration.`);
    }
    this.defaultLayout = { ...definition.defaultLayout };
    this.inspectorLabel = options.inspectorLabel ?? "Bezeichnung";
  }
  renderPreview(context) {
    renderContainerPreview(context);
  }
  renderInspector({ renderLabelField: renderLabelField2, renderContainerLayoutControls: renderContainerLayoutControls2 }) {
    renderLabelField2({ label: this.inspectorLabel });
    renderContainerLayoutControls2({});
  }
  ensureDefaults(element) {
    if (!element.layout) {
      element.layout = { ...this.defaultLayout };
    }
    if (!Array.isArray(element.children)) {
      element.children = [];
    }
  }
};
var SelectComponent = class extends FieldComponent {
  constructor(definition, options = {}) {
    super(definition, {
      inspectorLabel: options.inspectorLabel,
      placeholderInspectorLabel: options.placeholderInspectorLabel ?? "Platzhalter"
    });
    this.enableSearch = options.enableSearch ?? false;
  }
  getDefaultPlaceholder() {
    if (this.definition.defaultPlaceholder) {
      return this.definition.defaultPlaceholder;
    }
    return this.enableSearch ? "Suchen\u2026" : "Option w\xE4hlen\u2026";
  }
  renderPreview({ preview, element, finalize }) {
    const { field } = this.createFieldWrapper(preview, element);
    const select = field.createEl("select", { cls: "sm-le-preview__select" });
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
          element.defaultValue = void 0;
          placeholderOption.selected = true;
        }
      }
      if (this.enableSearch) {
        const searchInput = select._smSearchInput;
        if (searchInput) {
          searchInput.value = element.defaultValue ?? "";
          searchInput.placeholder = placeholderText;
        }
      }
    };
    renderSelectOptions();
    if (this.enableSearch) {
      enhanceSelectToSearch(select, element.placeholder ?? fallbackPlaceholder);
      const searchInput = select._smSearchInput;
      if (searchInput) {
        searchInput.addEventListener("blur", () => {
          const next = searchInput.value;
          element.defaultValue = next ? next : void 0;
          finalize(element);
        });
      }
    }
    select.onchange = () => {
      const value = select.value || void 0;
      if (value === element.defaultValue) return;
      element.defaultValue = value;
      if (this.enableSearch) {
        const searchInput = select._smSearchInput;
        if (searchInput) {
          searchInput.value = value ?? "";
        }
      }
      finalize(element);
    };
  }
  renderInspector(context) {
    super.renderInspector(context);
    context.renderOptionsEditor({});
  }
};

// src/elements/components/box-container.ts
var defaultLayout = { gap: 16, padding: 16, align: "stretch" };
var boxContainerComponent = new ContainerComponent({
  type: "box-container",
  buttonLabel: "BoxContainer",
  defaultLabel: "",
  category: "container",
  paletteGroup: "container",
  layoutOrientation: "vertical",
  width: 360,
  height: 220,
  defaultLayout
});
var box_container_default = boxContainerComponent;

// src/elements/components/dropdown.ts
var dropdownComponent = new SelectComponent(
  {
    type: "dropdown",
    buttonLabel: "Dropdown",
    defaultLabel: "",
    category: "element",
    paletteGroup: "input",
    defaultPlaceholder: "Option w\xE4hlen\u2026",
    options: ["Option A", "Option B"],
    width: 260,
    height: 150
  },
  { enableSearch: false }
);
var dropdown_default = dropdownComponent;

// src/elements/components/hbox-container.ts
var defaultLayout2 = { gap: 16, padding: 16, align: "center" };
var hboxContainerComponent = new ContainerComponent({
  type: "hbox-container",
  buttonLabel: "HBoxContainer",
  defaultLabel: "",
  category: "container",
  paletteGroup: "container",
  layoutOrientation: "horizontal",
  defaultDescription: "Ordnet verkn\xFCpfte Elemente automatisch nebeneinander an.",
  width: 360,
  height: 220,
  defaultLayout: defaultLayout2
});
var hbox_container_default = hboxContainerComponent;

// src/inline-edit.ts
function createInlineEditor(options) {
  const el = options.parent.createEl(options.multiline ? "div" : "span", { cls: "sm-le-inline-edit" });
  if (options.block) el.addClass("sm-le-inline-edit--block");
  if (options.multiline) el.addClass("sm-le-inline-edit--multiline");
  el.contentEditable = "true";
  el.spellcheck = false;
  el.dataset.placeholder = options.placeholder;
  const trim = options.trim ?? true;
  const initialValue = options.value ?? "";
  if (initialValue) {
    el.setText(initialValue);
  }
  let committedValue = trim ? initialValue.trim() : initialValue;
  const readValue = () => {
    const raw = el.textContent ?? "";
    return trim ? raw.trim() : raw;
  };
  const commit = () => {
    const next = readValue();
    if (next === committedValue) return;
    committedValue = next;
    options.onCommit(next);
  };
  el.addEventListener("keydown", (ev) => {
    if (!options.multiline && ev.key === "Enter") {
      ev.preventDefault();
      ev.target.blur();
    } else if (options.multiline && ev.key === "Enter" && !ev.shiftKey) {
      ev.preventDefault();
      ev.target.blur();
    }
  });
  el.addEventListener("blur", () => {
    commit();
    if (!readValue()) {
      el.empty();
    }
  });
  el.addEventListener("input", () => {
    options.onInput?.(readValue());
  });
  return el;
}

// src/elements/components/label.ts
var labelComponent = {
  definition: {
    type: "label",
    buttonLabel: "Label",
    defaultLabel: "\xDCberschrift",
    category: "element",
    paletteGroup: "element",
    width: 260,
    height: 160
  },
  renderPreview({ preview, element, finalize }) {
    const block = preview.createDiv({ cls: "sm-le-preview__headline" });
    const inner = block.createDiv({ cls: "sm-le-preview__headline-inner" });
    let labelEl;
    const autoScaleHeadlineText = () => {
      if (!labelEl || !inner.isConnected) return;
      const maxWidth = Math.max(0, inner.clientWidth - 12);
      const maxHeight = Math.max(0, inner.clientHeight - 12);
      if (!maxWidth || !maxHeight) return;
      const contentLength = (labelEl.textContent ?? "").trim().length;
      const minSize = 18;
      if (contentLength === 0) {
        const fallback = Math.max(minSize, Math.min(maxWidth, maxHeight) / 3);
        labelEl.style.fontSize = `${Math.round(fallback)}px`;
        return;
      }
      let low = minSize;
      let high = Math.max(minSize, Math.min(maxWidth, maxHeight));
      for (let i = 0; i < 10; i++) {
        const mid = (low + high) / 2;
        labelEl.style.fontSize = `${mid}px`;
        const fits = labelEl.scrollWidth <= maxWidth && labelEl.scrollHeight <= maxHeight;
        if (fits) {
          low = mid;
        } else {
          high = mid - 1;
        }
      }
      labelEl.style.fontSize = `${Math.floor(low)}px`;
    };
    labelEl = createInlineEditor({
      parent: inner,
      value: element.label,
      placeholder: "\xDCberschrift eingeben\u2026",
      multiline: true,
      block: true,
      trim: false,
      onInput: () => autoScaleHeadlineText(),
      onCommit: (value) => {
        const next = value || "";
        if (next === element.label) return;
        element.label = next;
        finalize(element);
        autoScaleHeadlineText();
      }
    });
    labelEl.addClass("sm-le-preview__headline-text");
    autoScaleHeadlineText();
    if (element.description !== void 0) {
      element.description = void 0;
    }
  }
};
var label_default = labelComponent;

// src/elements/components/search-dropdown.ts
var searchDropdownComponent = new SelectComponent(
  {
    type: "search-dropdown",
    buttonLabel: "Such-Dropdown",
    defaultLabel: "",
    category: "element",
    paletteGroup: "input",
    defaultPlaceholder: "Suchen\u2026",
    options: ["Erster Eintrag", "Zweiter Eintrag"],
    width: 280,
    height: 160
  },
  { enableSearch: true }
);
var search_dropdown_default = searchDropdownComponent;

// src/elements/components/separator.ts
var separatorComponent = {
  definition: {
    type: "separator",
    buttonLabel: "Trennstrich",
    defaultLabel: "",
    category: "element",
    paletteGroup: "element",
    width: 320,
    height: 80
  },
  renderPreview({ preview, element }) {
    const header = preview.createDiv({ cls: "sm-le-preview__separator" });
    const title = element.label?.trim() ? element.label : "";
    if (title) {
      header.createSpan({ cls: "sm-le-preview__label", text: title });
    } else {
      header.style.display = "none";
    }
    preview.createEl("hr", { cls: "sm-le-preview__divider" });
  },
  renderInspector({ renderLabelField: renderLabelField2 }) {
    renderLabelField2({ label: "Titel" });
  }
};
var separator_default = separatorComponent;

// src/elements/components/text-input.ts
var TextInputComponent = class extends TextFieldComponent {
  constructor() {
    super(
      {
        type: "text-input",
        buttonLabel: "Textfeld",
        defaultLabel: "",
        category: "element",
        paletteGroup: "input",
        width: 260,
        height: 140
      },
      {
        wrapperTag: "div",
        wrapperClass: "sm-le-preview__input-only",
        inputClass: "sm-le-preview__input",
        showLabelInPreview: false,
        supportsPlaceholder: false
      }
    );
  }
  renderInspector(_context) {
  }
};
var textInputComponent = new TextInputComponent();
var text_input_default = textInputComponent;

// src/elements/components/textarea.ts
var textareaComponent = new TextFieldComponent(
  {
    type: "textarea",
    buttonLabel: "Mehrzeiliges Feld",
    defaultLabel: "",
    category: "element",
    paletteGroup: "input",
    defaultPlaceholder: "Text erfassen\u2026",
    width: 320,
    height: 180
  },
  {
    inputClass: "sm-le-preview__textarea",
    supportsPlaceholder: true,
    multiline: true,
    rows: 4,
    placeholderInspectorLabel: "Platzhalter"
  }
);
var textarea_default = textareaComponent;

// src/elements/components/vbox-container.ts
var defaultLayout3 = { gap: 16, padding: 16, align: "stretch" };
var vboxContainerComponent = new ContainerComponent({
  type: "vbox-container",
  buttonLabel: "VBoxContainer",
  defaultLabel: "",
  category: "container",
  paletteGroup: "container",
  layoutOrientation: "vertical",
  defaultDescription: "Ordnet verkn\xFCpfte Elemente automatisch untereinander an.",
  width: 340,
  height: 260,
  defaultLayout: defaultLayout3
});
var vbox_container_default = vboxContainerComponent;

// src/elements/ui.ts
function createElementsButton(parent, options) {
  const { label, variant = "default", type = "button", icon, onClick } = options;
  const classes = ["sm-elements-button"];
  if (variant !== "default") {
    classes.push(`sm-elements-button--${variant}`);
  }
  const button = parent.createEl("button", {
    cls: classes.join(" "),
    text: icon ? void 0 : label
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
function createElementsField(parent, options) {
  const { label, layout = "stack", description } = options;
  const classes = ["sm-elements-field"];
  if (layout === "inline") classes.push("sm-elements-field--inline");
  if (layout === "grid") classes.push("sm-elements-field--grid");
  const fieldEl = parent.createDiv({ cls: classes.join(" ") });
  const labelEl = fieldEl.createEl("label", { cls: "sm-elements-field__label", text: label });
  const controlEl = fieldEl.createDiv({ cls: "sm-elements-field__control" });
  let descriptionEl;
  if (description) {
    descriptionEl = fieldEl.createDiv({ cls: "sm-elements-field__description", text: description });
  }
  return { fieldEl, labelEl, controlEl, descriptionEl };
}
function createElementsInput(parent, options = {}) {
  const { type = "text", value, placeholder, min, max, step, required, disabled, attr, autocomplete } = options;
  const input = parent.createEl("input", { cls: "sm-elements-input", attr: { type } });
  if (value !== void 0) input.value = value;
  if (placeholder !== void 0) input.placeholder = placeholder;
  if (min !== void 0) input.min = String(min);
  if (max !== void 0) input.max = String(max);
  if (step !== void 0) input.step = String(step);
  if (required) input.required = true;
  if (disabled) input.disabled = true;
  if (autocomplete !== void 0) input.autocomplete = autocomplete;
  if (attr) {
    for (const [key, val] of Object.entries(attr)) {
      input.setAttr(key, val);
    }
  }
  return input;
}
function createElementsSelect(parent, options) {
  const { options: items, value, placeholder, disabled } = options;
  const select = parent.createEl("select", { cls: "sm-elements-select" });
  if (placeholder) {
    const placeholderOption = select.createEl("option", { value: "", text: placeholder });
    placeholderOption.disabled = true;
    if (value === void 0) {
      placeholderOption.selected = true;
    }
  }
  for (const item of items) {
    const option = select.createEl("option", { value: item.value, text: item.label });
    if (item.disabled) option.disabled = true;
    if (value !== void 0 && item.value === value) option.selected = true;
  }
  if (disabled) select.disabled = true;
  return select;
}
function createElementsStatus(parent, options) {
  const { text, tone = "neutral" } = options;
  const classes = ["sm-elements-status", `sm-elements-status--${tone}`];
  const status = parent.createDiv({ cls: classes.join(" ") });
  status.setText(text);
  return status;
}
function createElementsHeading(parent, level, text) {
  return parent.createEl(`h${level}`, { cls: "sm-elements-heading", text });
}
function createElementsParagraph(parent, text) {
  return parent.createEl("p", { cls: "sm-elements-paragraph", text });
}
function createElementsMeta(parent, text) {
  return parent.createDiv({ cls: "sm-elements-meta", text });
}
function ensureFieldLabelFor(field, control) {
  if (field.labelEl.getAttr("for")) return;
  let id = control.id;
  if (!id) {
    id = `sm-elements-control-${Math.random().toString(36).slice(2)}`;
    control.id = id;
  }
  field.labelEl.setAttr("for", id);
}

// src/view-registry.ts
var LayoutViewBindingRegistry = class {
  constructor() {
    this.bindings = /* @__PURE__ */ new Map();
    this.listeners = /* @__PURE__ */ new Set();
  }
  register(def) {
    if (!def.id?.trim()) {
      throw new Error("View binding requires a non-empty id");
    }
    const id = def.id.trim();
    this.bindings.set(id, { ...def, id });
    this.emit();
  }
  unregister(id) {
    if (this.bindings.delete(id)) {
      this.emit();
    }
  }
  replaceAll(definitions) {
    this.bindings.clear();
    for (const def of definitions) {
      if (!def.id?.trim()) continue;
      const id = def.id.trim();
      this.bindings.set(id, { ...def, id });
    }
    this.emit();
  }
  getAll() {
    return Array.from(this.bindings.values());
  }
  get(id) {
    return this.bindings.get(id);
  }
  onChange(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  emit() {
    const snapshot = this.getAll();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
};
var registry = new LayoutViewBindingRegistry();
function registerViewBinding(definition) {
  registry.register(definition);
}
function unregisterViewBinding(id) {
  registry.unregister(id);
}
function resetViewBindings(definitions = []) {
  registry.replaceAll(definitions);
}
function getViewBindings() {
  return registry.getAll();
}
function getViewBinding(id) {
  return registry.get(id);
}
function onViewBindingsChanged(listener) {
  return registry.onChange(listener);
}

// src/elements/components/view-container.ts
var MIN_SCALE = 0.25;
var MAX_SCALE = 3;
var SURFACE_WIDTH = 960;
var SURFACE_HEIGHT = 640;
var ViewContainerComponent = class extends ElementComponentBase {
  constructor() {
    super({
      type: "view-container",
      buttonLabel: "View Container",
      defaultLabel: "",
      category: "element",
      paletteGroup: "container",
      width: 520,
      height: 340,
      defaultDescription: "Platzhalter f\xFCr externe Visualisierungen (z.\u202FB. Karten)"
    });
  }
  renderPreview(context) {
    const { preview, element, registerPreviewCleanup } = context;
    preview.addClass("sm-le-preview--view-container");
    const wrapper = preview.createDiv({ cls: "sm-view-container sm-view-container--design" });
    const viewport = wrapper.createDiv({ cls: "sm-view-container__viewport" });
    const stage = viewport.createDiv({ cls: "sm-view-container__content" });
    const overlay = wrapper.createDiv({ cls: "sm-view-container__overlay" });
    const binding = element.viewBindingId ? getViewBinding(element.viewBindingId) : null;
    const heading = overlay.createDiv({ cls: "sm-view-container__overlay-title" });
    heading.setText(binding ? binding.label : "Kein Feature verbunden");
    const subtitle = overlay.createDiv({ cls: "sm-view-container__overlay-subtitle" });
    subtitle.setText(binding ? binding.id : "W\xE4hle im Inspector ein Feature aus.");
    overlay.toggleClass("is-visible", !binding);
    const surface = stage.createDiv({ cls: "sm-view-container__surface" });
    surface.createDiv({ cls: "sm-view-container__surface-grid" });
    const info = surface.createDiv({ cls: "sm-view-container__surface-info" });
    info.createSpan({ cls: "sm-view-container__surface-label", text: binding?.label ?? "View Container" });
    info.createDiv({ cls: "sm-view-container__surface-id", text: binding?.id ?? "Feature ausw\xE4hlen\u2026" });
    viewport.style.touchAction = "none";
    let camera = { x: 0, y: 0, scale: 1 };
    const applyCamera = () => {
      surface.style.transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})`;
    };
    applyCamera();
    const supportsResizeObserver = typeof window.ResizeObserver !== "undefined";
    let resizeObserver = null;
    let fallbackLoopId = null;
    let pendingFitId = null;
    const scheduleFit = () => {
      if (pendingFitId !== null) return;
      pendingFitId = window.requestAnimationFrame(() => {
        pendingFitId = null;
        fitCameraToViewport();
      });
    };
    const fitCameraToViewport = () => {
      if (!viewport.isConnected) {
        return;
      }
      const rect = viewport.getBoundingClientRect();
      if (!rect.width || !rect.height) {
        if (supportsResizeObserver) {
          scheduleFit();
        }
        return;
      }
      const baseScale = Math.min(rect.width / SURFACE_WIDTH, rect.height / SURFACE_HEIGHT);
      if (!isFinite(baseScale) || baseScale <= 0) return;
      const nextScale = Math.min(MAX_SCALE, baseScale);
      const contentWidth = SURFACE_WIDTH * nextScale;
      const contentHeight = SURFACE_HEIGHT * nextScale;
      camera = {
        scale: nextScale,
        x: Math.round((rect.width - contentWidth) / 2),
        y: Math.round((rect.height - contentHeight) / 2)
      };
      applyCamera();
    };
    const disposeCameraSync = () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      }
      if (fallbackLoopId !== null) {
        window.cancelAnimationFrame(fallbackLoopId);
        fallbackLoopId = null;
      }
      if (pendingFitId !== null) {
        window.cancelAnimationFrame(pendingFitId);
        pendingFitId = null;
      }
    };
    if (supportsResizeObserver) {
      resizeObserver = new ResizeObserver(() => {
        scheduleFit();
      });
      resizeObserver.observe(viewport);
      scheduleFit();
    } else {
      const runFallbackLoop = () => {
        if (!viewport.isConnected) {
          disposeCameraSync();
          return;
        }
        fitCameraToViewport();
        fallbackLoopId = window.requestAnimationFrame(runFallbackLoop);
      };
      fallbackLoopId = window.requestAnimationFrame(runFallbackLoop);
    }
    registerPreviewCleanup(disposeCameraSync);
    let panPointer = null;
    let startX = 0;
    let startY = 0;
    let originX = 0;
    let originY = 0;
    const endPan = () => {
      if (panPointer === null) return;
      panPointer = null;
      viewport.style.cursor = "";
    };
    viewport.addEventListener("pointerdown", (ev) => {
      if (ev.button !== 1) return;
      ev.preventDefault();
      ev.stopPropagation();
      panPointer = ev.pointerId;
      startX = ev.clientX;
      startY = ev.clientY;
      originX = camera.x;
      originY = camera.y;
      viewport.setPointerCapture(ev.pointerId);
      viewport.style.cursor = "grabbing";
    });
    viewport.addEventListener("pointermove", (ev) => {
      if (panPointer === null || ev.pointerId !== panPointer) return;
      ev.preventDefault();
      ev.stopPropagation();
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      camera = { ...camera, x: originX + dx, y: originY + dy };
      applyCamera();
    });
    const releasePointer = (ev) => {
      if (panPointer === null || ev.pointerId !== panPointer) return;
      ev.preventDefault();
      ev.stopPropagation();
      viewport.releasePointerCapture(ev.pointerId);
      endPan();
    };
    viewport.addEventListener("pointerup", releasePointer);
    viewport.addEventListener("pointercancel", releasePointer);
    viewport.addEventListener("pointerleave", (ev) => {
      if (panPointer === null || ev.pointerId !== panPointer) return;
      endPan();
    });
    viewport.addEventListener(
      "wheel",
      (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const delta = ev.deltaY;
        const factor = Math.exp(-delta * 15e-4);
        const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, camera.scale * factor));
        if (Math.abs(nextScale - camera.scale) < 1e-4) return;
        const rect = viewport.getBoundingClientRect();
        const px = ev.clientX - rect.left;
        const py = ev.clientY - rect.top;
        const worldX = (px - camera.x) / camera.scale;
        const worldY = (py - camera.y) / camera.scale;
        camera = {
          scale: nextScale,
          x: px - worldX * nextScale,
          y: py - worldY * nextScale
        };
        applyCamera();
      },
      { passive: false }
    );
    viewport.addEventListener("contextmenu", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
    });
  }
  renderInspector(context) {
    const { element, callbacks, sections } = context;
    context.renderLabelField({ label: "Bezeichnung" });
    const bindings = getViewBindings();
    const field = createElementsField(sections.body, { label: "Feature" });
    field.fieldEl.addClass("sm-le-field");
    if (!bindings.length) {
      const notice = field.controlEl.createDiv({ cls: "sm-le-empty", text: "Kein kompatibles Feature registriert." });
      notice.addClass("sm-le-view-binding-empty");
      return;
    }
    const options = [
      { value: "", label: "Feature ausw\xE4hlen\u2026" },
      ...bindings.map((binding) => ({ value: binding.id, label: binding.label }))
    ];
    const select = createElementsSelect(field.controlEl, { options, value: element.viewBindingId ?? "" });
    ensureFieldLabelFor(field, select);
    select.onchange = () => {
      const next = select.value || void 0;
      if (next === element.viewBindingId) return;
      element.viewBindingId = next;
      callbacks.syncElementElement(element);
      callbacks.refreshExport();
      callbacks.updateStatus();
      callbacks.pushHistory();
      callbacks.renderInspector();
    };
    const metaHost = field.controlEl.createDiv({ cls: "sm-le-view-binding-meta" });
    if (element.viewBindingId) {
      const binding = getViewBinding(element.viewBindingId);
      if (binding?.description) {
        createElementsMeta(metaHost, binding.description);
      } else {
        createElementsMeta(metaHost, `ID: ${element.viewBindingId}`);
      }
    } else {
      createElementsMeta(metaHost, "W\xE4hle ein Feature, um den Container zu verbinden.");
    }
  }
};
var viewContainerComponent = new ViewContainerComponent();
var view_container_default = viewContainerComponent;

// src/elements/component-manifest.ts
var COMPONENTS = [
  box_container_default,
  dropdown_default,
  hbox_container_default,
  label_default,
  search_dropdown_default,
  separator_default,
  text_input_default,
  textarea_default,
  vbox_container_default,
  view_container_default
];

// src/elements/registry.ts
var components = [...COMPONENTS];
var componentByType = /* @__PURE__ */ new Map();
for (const component of components) {
  if (!component?.definition) continue;
  if (componentByType.has(component.definition.type)) {
    console.warn(`Duplicate layout element component for type "${component.definition.type}"`);
  }
  componentByType.set(component.definition.type, component);
}
function getLayoutElementComponent(type) {
  return componentByType.get(type);
}
function createDefaultElementDefinitions() {
  return components.map((component) => ({ ...component.definition }));
}

// src/definitions.ts
var MIN_ELEMENT_SIZE = 60;
var DEFAULT_ELEMENT_DEFINITIONS = createDefaultElementDefinitions();
var LayoutElementRegistry = class {
  constructor(initial) {
    this.definitions = /* @__PURE__ */ new Map();
    this.listeners = /* @__PURE__ */ new Set();
    for (const def of initial) {
      this.definitions.set(def.type, { ...def });
    }
  }
  register(definition) {
    this.definitions.set(definition.type, { ...definition });
    this.emit();
  }
  unregister(type) {
    if (this.definitions.delete(type)) {
      this.emit();
    }
  }
  replaceAll(definitions) {
    this.definitions.clear();
    for (const def of definitions) {
      this.definitions.set(def.type, { ...def });
    }
    this.emit();
  }
  getAll() {
    return Array.from(this.definitions.values());
  }
  get(type) {
    return this.definitions.get(type);
  }
  onChange(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  emit() {
    const snapshot = this.getAll();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
};
var registry2 = new LayoutElementRegistry(DEFAULT_ELEMENT_DEFINITIONS);
function getElementDefinitions() {
  return registry2.getAll();
}
function getElementDefinition(type) {
  return registry2.get(type);
}
function registerLayoutElementDefinition(definition) {
  registry2.register(definition);
}
function unregisterLayoutElementDefinition(type) {
  registry2.unregister(type);
}
function resetLayoutElementDefinitions(definitions) {
  registry2.replaceAll(definitions);
}
function onLayoutElementDefinitionsChanged(listener) {
  return registry2.onChange(listener);
}
var ATTRIBUTE_GROUPS = [
  {
    label: "Allgemein",
    options: [
      { value: "name", label: "Name" },
      { value: "type", label: "Typ" },
      { value: "size", label: "Gr\xF6\xDFe" },
      { value: "alignmentLawChaos", label: "Gesinnung (Gesetz/Chaos)" },
      { value: "alignmentGoodEvil", label: "Gesinnung (Gut/B\xF6se)" },
      { value: "cr", label: "Herausforderungsgrad" },
      { value: "xp", label: "Erfahrungspunkte" }
    ]
  },
  {
    label: "Kampfwerte",
    options: [
      { value: "ac", label: "R\xFCstungsklasse" },
      { value: "initiative", label: "Initiative" },
      { value: "hp", label: "Trefferpunkte" },
      { value: "hitDice", label: "Trefferw\xFCrfel" },
      { value: "pb", label: "Proficiency Bonus" }
    ]
  },
  {
    label: "Bewegung",
    options: [
      { value: "speedWalk", label: "Geschwindigkeit (Laufen)" },
      { value: "speedFly", label: "Geschwindigkeit (Fliegen)" },
      { value: "speedSwim", label: "Geschwindigkeit (Schwimmen)" },
      { value: "speedBurrow", label: "Geschwindigkeit (Graben)" },
      { value: "speedList", label: "Geschwindigkeiten (Liste)" }
    ]
  },
  {
    label: "Attribute",
    options: [
      { value: "str", label: "St\xE4rke" },
      { value: "dex", label: "Geschicklichkeit" },
      { value: "con", label: "Konstitution" },
      { value: "int", label: "Intelligenz" },
      { value: "wis", label: "Weisheit" },
      { value: "cha", label: "Charisma" }
    ]
  },
  {
    label: "Rettungsw\xFCrfe & Fertigkeiten",
    options: [
      { value: "saveProf.str", label: "Rettungswurf: St\xE4rke" },
      { value: "saveProf.dex", label: "Rettungswurf: Geschicklichkeit" },
      { value: "saveProf.con", label: "Rettungswurf: Konstitution" },
      { value: "saveProf.int", label: "Rettungswurf: Intelligenz" },
      { value: "saveProf.wis", label: "Rettungswurf: Weisheit" },
      { value: "saveProf.cha", label: "Rettungswurf: Charisma" },
      { value: "skillsProf", label: "Fertigkeiten (Proficiencies)" },
      { value: "skillsExpertise", label: "Fertigkeiten (Expertise)" }
    ]
  },
  {
    label: "Sinne & Sprache",
    options: [
      { value: "sensesList", label: "Sinne" },
      { value: "languagesList", label: "Sprachen" }
    ]
  },
  {
    label: "Resistenzen & Immunit\xE4ten",
    options: [
      { value: "damageVulnerabilitiesList", label: "Verwundbarkeiten" },
      { value: "damageResistancesList", label: "Resistenzen" },
      { value: "damageImmunitiesList", label: "Schadensimmunit\xE4ten" },
      { value: "conditionImmunitiesList", label: "Zustandsimmunit\xE4ten" }
    ]
  },
  {
    label: "Ausr\xFCstung & Ressourcen",
    options: [
      { value: "gearList", label: "Ausr\xFCstung" },
      { value: "passivesList", label: "Passive Werte" }
    ]
  },
  {
    label: "Texte & Abschnitte",
    options: [
      { value: "traits", label: "Traits (Text)" },
      { value: "actions", label: "Actions (Text)" },
      { value: "legendary", label: "Legendary Actions (Text)" },
      { value: "entries", label: "Strukturierte Eintr\xE4ge" },
      { value: "actionsList", label: "Strukturierte Actions" },
      { value: "spellsKnown", label: "Bekannte Zauber" }
    ]
  }
];
var ATTRIBUTE_LABEL_LOOKUP = new Map(
  ATTRIBUTE_GROUPS.flatMap((group) => group.options.map((opt) => [opt.value, opt.label]))
);
function isVerticalContainer(type) {
  const definition = registry2.get(type);
  if (definition?.layoutOrientation) {
    return definition.layoutOrientation !== "horizontal";
  }
  return type === "box-container" || type === "vbox-container";
}
function getAttributeSummary(attributes) {
  if (!attributes.length) return "Attribute w\xE4hlen\u2026";
  return attributes.map((attr) => ATTRIBUTE_LABEL_LOOKUP.get(attr) ?? attr).join(", ");
}
function getElementTypeLabel(type) {
  return registry2.get(type)?.buttonLabel ?? type;
}
function isContainerType(type) {
  const definition = registry2.get(type);
  if (definition) {
    return definition.category === "container";
  }
  return type === "box-container" || type === "vbox-container" || type === "hbox-container";
}

// src/utils.ts
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
function cloneLayoutElement(element) {
  return {
    ...element,
    attributes: [...element.attributes],
    options: element.options ? [...element.options] : void 0,
    layout: element.layout ? { ...element.layout } : void 0,
    children: element.children ? [...element.children] : void 0,
    viewState: element.viewState ? JSON.parse(JSON.stringify(element.viewState)) : void 0
  };
}
function arraysAreEqual(a, b) {
  const arrA = a ?? [];
  const arrB = b ?? [];
  if (arrA.length !== arrB.length) return false;
  for (let i = 0; i < arrA.length; i++) {
    if (arrA[i] !== arrB[i]) return false;
  }
  return true;
}
function recordsAreEqual(a, b) {
  if (a === b) return true;
  if (!a || !b) return !a && !b;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    const valA = a[key];
    const valB = b[key];
    if (Array.isArray(valA) && Array.isArray(valB)) {
      if (!arraysAreEqual(valA, valB)) return false;
      continue;
    }
    if (typeof valA === "object" && valA && typeof valB === "object" && valB) {
      if (!recordsAreEqual(valA, valB)) {
        return false;
      }
      continue;
    }
    if (valA !== valB) return false;
  }
  return true;
}
function elementsAreEqual(a, b) {
  if (a === b) return true;
  if (a.id !== b.id || a.type !== b.type || a.x !== b.x || a.y !== b.y || a.width !== b.width || a.height !== b.height || a.label !== b.label || a.description !== b.description || a.placeholder !== b.placeholder || a.defaultValue !== b.defaultValue || a.parentId !== b.parentId) {
    return false;
  }
  if (a.viewBindingId !== b.viewBindingId) return false;
  if (!recordsAreEqual(a.viewState, b.viewState)) {
    return false;
  }
  if (!arraysAreEqual(a.options, b.options)) return false;
  if (!arraysAreEqual(a.attributes, b.attributes)) return false;
  if (!arraysAreEqual(a.children, b.children)) return false;
  if (!!a.layout !== !!b.layout) return false;
  if (a.layout && b.layout) {
    if (a.layout.gap !== b.layout.gap || a.layout.padding !== b.layout.padding || a.layout.align !== b.layout.align) {
      return false;
    }
  }
  return true;
}
function snapshotsAreEqual(a, b) {
  if (!a || !b) return false;
  if (a.canvasWidth !== b.canvasWidth || a.canvasHeight !== b.canvasHeight || a.selectedElementId !== b.selectedElementId || a.elements.length !== b.elements.length) {
    return false;
  }
  for (let i = 0; i < a.elements.length; i++) {
    if (!elementsAreEqual(a.elements[i], b.elements[i])) return false;
  }
  return true;
}
function isContainerElement(element) {
  return isContainerType(element.type) && Array.isArray(element.children);
}
function collectDescendantIds(element, elements) {
  const lookup = new Map(elements.map((entry) => [entry.id, entry]));
  const result = /* @__PURE__ */ new Set();
  const stack = Array.isArray(element.children) ? [...element.children] : [];
  while (stack.length) {
    const id = stack.pop();
    if (result.has(id)) continue;
    result.add(id);
    const child = lookup.get(id);
    if (child?.children?.length) {
      stack.push(...child.children);
    }
  }
  return result;
}
function collectAncestorIds(element, elements) {
  const lookup = new Map(elements.map((entry) => [entry.id, entry]));
  const result = /* @__PURE__ */ new Set();
  let current = element.parentId ? lookup.get(element.parentId) ?? null : null;
  while (current) {
    if (result.has(current.id)) break;
    result.add(current.id);
    current = current.parentId ? lookup.get(current.parentId) ?? null : null;
  }
  return result;
}

// src/history.ts
var LayoutHistory = class {
  constructor(capture, restore) {
    this.capture = capture;
    this.restore = restore;
    this.snapshots = [];
    this.index = -1;
    this.restoring = false;
  }
  get isRestoring() {
    return this.restoring;
  }
  reset(initial) {
    this.snapshots = initial ? [cloneSnapshot(initial)] : [];
    this.index = this.snapshots.length - 1;
  }
  push(snapshot) {
    if (this.restoring) return;
    const next = snapshot ? cloneSnapshot(snapshot) : cloneSnapshot(this.capture());
    const last = this.snapshots[this.index];
    if (last && snapshotsAreEqual(last, next)) {
      return;
    }
    if (this.index < this.snapshots.length - 1) {
      this.snapshots.splice(this.index + 1);
    }
    this.snapshots.push(next);
    this.index = this.snapshots.length - 1;
  }
  undo() {
    if (this.index <= 0) return;
    const target = this.snapshots[this.index - 1];
    if (!target) return;
    this.index -= 1;
    this.restoreSnapshot(target);
  }
  redo() {
    if (this.index >= this.snapshots.length - 1) return;
    const target = this.snapshots[this.index + 1];
    if (!target) return;
    this.index += 1;
    this.restoreSnapshot(target);
  }
  restoreSnapshot(snapshot) {
    this.restoring = true;
    try {
      this.restore(cloneSnapshot(snapshot));
    } finally {
      this.restoring = false;
    }
  }
};
function cloneSnapshot(snapshot) {
  return {
    canvasWidth: snapshot.canvasWidth,
    canvasHeight: snapshot.canvasHeight,
    selectedElementId: snapshot.selectedElementId,
    elements: snapshot.elements.map(cloneLayoutElement)
  };
}

// src/attribute-popover.ts
var AttributePopoverController = class {
  constructor(callbacks) {
    this.callbacks = callbacks;
    this.state = null;
  }
  get activeElementId() {
    return this.state?.elementId ?? null;
  }
  open(element, anchor) {
    this.close();
    const container = document.createElement("div");
    container.className = "sm-le-attr-popover";
    container.style.position = "absolute";
    container.style.zIndex = "1000";
    container.style.visibility = "hidden";
    container.addEventListener("pointerdown", (ev) => ev.stopPropagation());
    const heading = document.createElement("div");
    heading.className = "sm-le-attr-popover__heading";
    heading.textContent = "Attribute";
    container.appendChild(heading);
    const hint = document.createElement("div");
    hint.className = "sm-le-attr-popover__hint";
    hint.textContent = "Mehrfachauswahl m\xF6glich.";
    container.appendChild(hint);
    const scroll = document.createElement("div");
    scroll.className = "sm-le-attr-popover__scroll";
    container.appendChild(scroll);
    const clearBtn = document.createElement("button");
    clearBtn.className = "sm-le-attr-popover__clear";
    clearBtn.textContent = "Alle entfernen";
    clearBtn.addEventListener("click", (ev) => {
      ev.preventDefault();
      if (element.attributes.length === 0) return;
      element.attributes = [];
      this.callbacks.syncElementElement(element);
      this.callbacks.refreshExport();
      this.callbacks.renderInspector();
      this.refresh();
      this.callbacks.updateStatus();
      this.callbacks.pushHistory();
    });
    container.appendChild(clearBtn);
    for (const group of ATTRIBUTE_GROUPS) {
      const groupEl = document.createElement("div");
      groupEl.className = "sm-le-attr-popover__group";
      const title = document.createElement("div");
      title.className = "sm-le-attr-popover__group-title";
      title.textContent = group.label;
      groupEl.appendChild(title);
      for (const option of group.options) {
        const optionLabel = document.createElement("label");
        optionLabel.className = "sm-le-attr-popover__option";
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.dataset.attr = option.value;
        checkbox.checked = element.attributes.includes(option.value);
        checkbox.addEventListener("change", () => {
          if (checkbox.checked) {
            if (!element.attributes.includes(option.value)) {
              element.attributes = [...element.attributes, option.value];
            }
          } else {
            element.attributes = element.attributes.filter((v) => v !== option.value);
          }
          this.callbacks.syncElementElement(element);
          this.callbacks.refreshExport();
          this.callbacks.renderInspector();
          this.refresh();
          this.callbacks.updateStatus();
          this.callbacks.pushHistory();
        });
        const labelText = document.createElement("span");
        labelText.textContent = option.label;
        optionLabel.appendChild(checkbox);
        optionLabel.appendChild(labelText);
        groupEl.appendChild(optionLabel);
      }
      scroll.appendChild(groupEl);
    }
    const onPointerDown = (ev) => {
      if (!(ev.target instanceof Node)) return;
      if (!container.contains(ev.target) && ev.target !== anchor && !anchor.contains(ev.target)) {
        this.close();
      }
    };
    const onKeyDown = (ev) => {
      if (ev.key === "Escape") {
        this.close();
      }
    };
    document.body.appendChild(container);
    const dispose = () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
      container.remove();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    this.state = {
      elementId: element.id,
      container,
      anchor,
      dispose
    };
    this.position();
    container.style.visibility = "visible";
  }
  close() {
    if (!this.state) return;
    this.state.dispose();
    this.state = null;
  }
  refresh() {
    if (!this.state) return;
    const element = this.callbacks.getElementById(this.state.elementId);
    if (!element) {
      this.close();
      return;
    }
    const checkboxes = this.state.container.querySelectorAll("input[type='checkbox'][data-attr]");
    checkboxes.forEach((checkbox) => {
      const attr = checkbox.dataset.attr;
      if (!attr) return;
      checkbox.checked = element.attributes.includes(attr);
    });
  }
  position() {
    if (!this.state) return;
    const { container, anchor } = this.state;
    const anchorRect = anchor.getBoundingClientRect();
    const popRect = container.getBoundingClientRect();
    const margin = 8;
    let left = anchorRect.left + window.scrollX;
    let top = anchorRect.bottom + window.scrollY + margin;
    const viewportWidth = window.innerWidth + window.scrollX;
    const viewportHeight = window.innerHeight + window.scrollY;
    if (left + popRect.width > viewportWidth - margin) {
      left = viewportWidth - popRect.width - margin;
    }
    if (left < margin) left = margin;
    if (top + popRect.height > viewportHeight - margin) {
      top = anchorRect.top + window.scrollY - popRect.height - margin;
    }
    if (top < margin) top = margin;
    container.style.left = `${Math.round(left)}px`;
    container.style.top = `${Math.round(top)}px`;
  }
};

// src/element-preview.ts
function renderElementPreview(deps) {
  const { host, element } = deps;
  const hostWithCleanup = host;
  if (hostWithCleanup.__smPreviewCleanup__) {
    hostWithCleanup.__smPreviewCleanup__();
    delete hostWithCleanup.__smPreviewCleanup__;
  }
  host.empty();
  host.toggleClass("sm-le-box__content", true);
  const preview = host.createDiv({ cls: `sm-le-preview sm-le-preview--${element.type}` });
  const registerPreviewCleanup = (cleanup) => {
    if (hostWithCleanup.__smPreviewCleanup__) {
      hostWithCleanup.__smPreviewCleanup__();
    }
    hostWithCleanup.__smPreviewCleanup__ = cleanup;
  };
  const context = { ...deps, preview, container: host, registerPreviewCleanup };
  const component = getLayoutElementComponent(element.type);
  if (component) {
    component.renderPreview(context);
    return;
  }
  renderFallbackPreview(context);
}
function renderFallbackPreview(context) {
  const { preview, element, finalize } = context;
  const fallback = preview.createDiv({ cls: "sm-le-preview__field" });
  const labelHost = fallback.createSpan({ cls: "sm-le-preview__label" });
  createInlineEditor({
    parent: labelHost,
    value: element.label,
    placeholder: "Label eingeben\u2026",
    onCommit: (value) => {
      const next = value || "";
      if (next === element.label) return;
      element.label = next;
      finalize(element);
    }
  });
}

// src/ui/editor-menu.ts
var activeMenu = null;
function openEditorMenu(options) {
  const { anchor, entries, event, onClose } = options;
  if (!anchor || !entries.length) {
    return null;
  }
  activeMenu?.close();
  const menu = document.createElement("div");
  menu.className = "sm-le-menu";
  let isOpen = true;
  const close = () => {
    if (!isOpen) return;
    isOpen = false;
    menu.remove();
    document.removeEventListener("pointerdown", handlePointerDown, true);
    document.removeEventListener("keydown", handleKeyDown, true);
    window.removeEventListener("blur", close);
    if (activeMenu && activeMenu.close === close) {
      activeMenu = null;
    }
    onClose?.();
  };
  const handlePointerDown = (ev) => {
    const target = ev.target;
    if (!target) {
      close();
      return;
    }
    if (!menu.contains(target) && !anchor.contains(target)) {
      close();
    }
  };
  const handleKeyDown = (ev) => {
    if (ev.key === "Escape") {
      ev.preventDefault();
      close();
    }
  };
  document.addEventListener("pointerdown", handlePointerDown, true);
  document.addEventListener("keydown", handleKeyDown, true);
  window.addEventListener("blur", close);
  for (const entry of entries) {
    if (entry.type === "separator") {
      menu.createDiv({ cls: "sm-le-menu__separator" });
      continue;
    }
    const item = createElementsButton(menu, { label: "" });
    item.addClass("sm-le-menu__item");
    item.setText("");
    item.type = "button";
    item.createSpan({ cls: "sm-le-menu__label", text: entry.label });
    if (entry.description) {
      item.createSpan({ cls: "sm-le-menu__description", text: entry.description });
    }
    if (entry.disabled) {
      item.setAttr("disabled", "disabled");
      item.addClass("is-disabled");
    }
    item.onclick = (ev) => {
      ev.preventDefault();
      if (entry.disabled) return;
      close();
      entry.onSelect();
    };
    item.onkeydown = (ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        if (!entry.disabled) {
          close();
          entry.onSelect();
        }
      }
    };
  }
  document.body.appendChild(menu);
  const anchorRect = anchor.getBoundingClientRect();
  const menuRect = menu.getBoundingClientRect();
  const offsetX = event ? event.clientX - anchorRect.left : 0;
  let left = anchorRect.left + window.scrollX + offsetX;
  let top = (event ? event.clientY : anchorRect.bottom) + window.scrollY;
  const viewportRight = window.scrollX + window.innerWidth;
  const viewportBottom = window.scrollY + window.innerHeight;
  if (left + menuRect.width > viewportRight - 8) {
    left = Math.max(8, viewportRight - menuRect.width - 8);
  }
  if (top + menuRect.height > viewportBottom - 8) {
    const above = anchorRect.top + window.scrollY - menuRect.height;
    if (above >= 8) {
      top = above;
    } else {
      top = Math.max(8, viewportBottom - menuRect.height - 8);
    }
  }
  menu.style.left = `${Math.round(left)}px`;
  menu.style.top = `${Math.round(top)}px`;
  const focusable = menu.querySelector(".sm-le-menu__item:not([disabled])");
  if (focusable) {
    focusable.focus();
  }
  const handle = { close };
  activeMenu = handle;
  return handle;
}

// src/inspector-panel.ts
function renderInspectorPanel(deps) {
  const { host, element } = deps;
  host.empty();
  const heading = createElementsHeading(host, 3, "Eigenschaften");
  heading.addClass("sm-le-panel__heading");
  if (!element) {
    host.createDiv({ cls: "sm-le-empty", text: "W\xE4hle ein Element, um Details anzupassen." });
    return;
  }
  const callbacks = deps.callbacks;
  const { elements, canvasWidth, canvasHeight, definitions } = deps;
  const isContainer = isContainerType(element.type);
  if (isContainer) {
    callbacks.ensureContainerDefaults(element);
  }
  const parentContainer = element.parentId ? elements.find((el) => el.id === element.parentId) : null;
  host.createDiv({ cls: "sm-le-meta", text: `Typ: ${getElementTypeLabel(element.type)}` });
  host.createDiv({
    cls: "sm-le-hint",
    text: "Benennungen und Eigenschaften pflegst du hier im Inspector. Reine Textbl\xF6cke bearbeitest du direkt im Arbeitsbereich."
  });
  const component = getLayoutElementComponent(element.type);
  const customHeader = host.createDiv({ cls: "sm-le-section sm-le-section--custom-header" });
  const containers = elements.filter((el) => isContainerType(el.type));
  if (containers.length) {
    const blockedContainers = /* @__PURE__ */ new Set();
    if (isContainerElement(element)) {
      const descendants = collectDescendantIds(element, elements);
      for (const id of descendants) blockedContainers.add(id);
      const ancestors = collectAncestorIds(element, elements);
      for (const id of ancestors) blockedContainers.add(id);
      blockedContainers.add(element.id);
    }
    const containerField = createElementsField(host, { label: "Container" });
    containerField.fieldEl.addClass("sm-le-field");
    const options = [
      { value: "", label: "Kein Container" },
      ...containers.filter((container) => !blockedContainers.has(container.id)).map((container) => ({
        value: container.id,
        label: container.label || getElementTypeLabel(container.type)
      }))
    ];
    const parentSelect = createElementsSelect(containerField.controlEl, {
      options,
      value: element.parentId ?? ""
    });
    ensureFieldLabelFor(containerField, parentSelect);
    parentSelect.onchange = () => {
      const value = parentSelect.value || null;
      callbacks.assignElementToContainer(element.id, value);
    };
  }
  const attributesField = createElementsField(host, { label: "Attribute" });
  attributesField.fieldEl.addClass("sm-le-field");
  const attributesChip = attributesField.controlEl.createDiv({ cls: "sm-le-attr" });
  attributesChip.setText(getAttributeSummary(element.attributes));
  const actions = host.createDiv({ cls: "sm-le-actions" });
  const deleteBtn = createElementsButton(actions, { label: "Element l\xF6schen", variant: "warning" });
  deleteBtn.classList.add("mod-warning");
  deleteBtn.onclick = () => callbacks.deleteElement(element.id);
  const sizeField = createElementsField(host, { label: "Gr\xF6\xDFe (px)", layout: "inline" });
  sizeField.fieldEl.addClass("sm-le-field");
  const widthInput = createElementsInput(sizeField.controlEl, {
    type: "number",
    min: MIN_ELEMENT_SIZE,
    value: String(Math.round(element.width))
  });
  ensureFieldLabelFor(sizeField, widthInput);
  widthInput.onchange = () => {
    const maxWidth = Math.max(MIN_ELEMENT_SIZE, canvasWidth - element.x);
    const next = clampNumber(parseInt(widthInput.value, 10) || element.width, MIN_ELEMENT_SIZE, maxWidth);
    element.width = next;
    widthInput.value = String(next);
    callbacks.syncElementElement(element);
    callbacks.refreshExport();
    if (isContainer) {
      callbacks.applyContainerLayout(element);
      if (parentContainer && isContainerType(parentContainer.type)) {
        callbacks.applyContainerLayout(parentContainer);
      }
    } else if (parentContainer && isContainerType(parentContainer.type)) {
      callbacks.applyContainerLayout(parentContainer);
    }
  };
  sizeField.controlEl.createSpan({ cls: "sm-elements-inline-text", text: "\xD7" });
  const heightInput = createElementsInput(sizeField.controlEl, {
    type: "number",
    min: MIN_ELEMENT_SIZE,
    value: String(Math.round(element.height))
  });
  heightInput.onchange = () => {
    const maxHeight = Math.max(MIN_ELEMENT_SIZE, canvasHeight - element.y);
    const next = clampNumber(parseInt(heightInput.value, 10) || element.height, MIN_ELEMENT_SIZE, maxHeight);
    element.height = next;
    heightInput.value = String(next);
    callbacks.syncElementElement(element);
    callbacks.refreshExport();
    if (isContainer) {
      callbacks.applyContainerLayout(element);
      if (parentContainer && isContainerType(parentContainer.type)) {
        callbacks.applyContainerLayout(parentContainer);
      }
    } else if (parentContainer && isContainerType(parentContainer.type)) {
      callbacks.applyContainerLayout(parentContainer);
    }
  };
  const positionField = createElementsField(host, { label: "Position (px)", layout: "inline" });
  positionField.fieldEl.addClass("sm-le-field");
  const posXInput = createElementsInput(positionField.controlEl, {
    type: "number",
    min: 0,
    value: String(Math.round(element.x))
  });
  ensureFieldLabelFor(positionField, posXInput);
  posXInput.onchange = () => {
    const maxX = Math.max(0, canvasWidth - element.width);
    const next = clampNumber(parseInt(posXInput.value, 10) || element.x, 0, maxX);
    element.x = next;
    posXInput.value = String(next);
    callbacks.syncElementElement(element);
    callbacks.refreshExport();
    if (isContainer) {
      callbacks.applyContainerLayout(element);
      if (parentContainer && isContainerType(parentContainer.type)) {
        callbacks.applyContainerLayout(parentContainer);
      }
    } else if (parentContainer && isContainerType(parentContainer.type)) {
      callbacks.applyContainerLayout(parentContainer);
    }
  };
  positionField.controlEl.createSpan({ cls: "sm-elements-inline-text", text: "," });
  const posYInput = createElementsInput(positionField.controlEl, {
    type: "number",
    min: 0,
    value: String(Math.round(element.y))
  });
  posYInput.onchange = () => {
    const maxY = Math.max(0, canvasHeight - element.height);
    const next = clampNumber(parseInt(posYInput.value, 10) || element.y, 0, maxY);
    element.y = next;
    posYInput.value = String(next);
    callbacks.syncElementElement(element);
    callbacks.refreshExport();
    if (isContainer) {
      callbacks.applyContainerLayout(element);
      if (parentContainer && isContainerType(parentContainer.type)) {
        callbacks.applyContainerLayout(parentContainer);
      }
    } else if (parentContainer && isContainerType(parentContainer.type)) {
      callbacks.applyContainerLayout(parentContainer);
    }
  };
  const customBody = host.createDiv({ cls: "sm-le-section sm-le-section--custom-body" });
  const sections = { header: customHeader, body: customBody };
  const inspectorContext = {
    element,
    callbacks,
    sections,
    renderLabelField: ({ label, host: target } = {}) => renderLabelField({
      host: target ?? sections.header,
      element,
      callbacks,
      label: label ?? "Bezeichnung"
    }),
    renderPlaceholderField: ({ label, host: target } = {}) => renderPlaceholderField({
      host: target ?? sections.body,
      element,
      callbacks,
      label: label ?? "Platzhalter"
    }),
    renderOptionsEditor: ({ host: target } = {}) => renderOptionsEditor({ host: target ?? sections.body, element, callbacks }),
    renderContainerLayoutControls: ({ host: target } = {}) => renderContainerLayoutControls({ host: target ?? sections.body, element, callbacks })
  };
  component?.renderInspector?.(inspectorContext);
  const meta = createElementsMeta(host, `Fl\xE4che: ${Math.round(element.width * element.height)} px\xB2`);
  meta.addClass("sm-le-meta");
  if (isContainer) {
    renderContainerInspectorSections({ element, host, elements, callbacks, definitions });
  } else {
    renderAttributeSelector({ element, attributesChip });
  }
}
function renderContainerInspectorSections(options) {
  const { element, host, elements, callbacks, definitions } = options;
  const quickAddField = createElementsField(host, { label: "Neues Element erstellen", layout: "stack" });
  quickAddField.fieldEl.addClass("sm-le-field");
  const quickAddBtn = createElementsButton(quickAddField.controlEl, { label: "Element hinzuf\xFCgen" });
  quickAddBtn.classList.add("sm-le-inline-add", "sm-le-inline-add--menu");
  quickAddBtn.onclick = (ev) => {
    ev.preventDefault();
    const standardDefs = definitions.filter((def) => !isContainerType(def.type));
    const containerDefs = definitions.filter((def) => isContainerType(def.type));
    const entries = [
      ...standardDefs.map((def) => ({
        type: "item",
        label: def.buttonLabel,
        onSelect: () => callbacks.createElement(def.type, { parentId: element.id })
      })),
      ...standardDefs.length && containerDefs.length ? [{ type: "separator" }] : [],
      ...containerDefs.map((def) => ({
        type: "item",
        label: def.buttonLabel,
        onSelect: () => callbacks.createElement(def.type, { parentId: element.id })
      }))
    ];
    openEditorMenu({ anchor: quickAddBtn, entries, event: ev });
  };
  const childField = createElementsField(host, { label: "Zugeordnete Elemente", layout: "stack" });
  childField.fieldEl.addClass("sm-le-field");
  const addRow = childField.controlEl.createDiv({ cls: "sm-le-container-add" });
  const addSelect = createElementsSelect(addRow, {
    options: [{ value: "", label: "Element ausw\xE4hlen\u2026" }],
    value: ""
  });
  const blockedIds = /* @__PURE__ */ new Set([element.id]);
  const descendants = collectDescendantIds(element, elements);
  for (const id of descendants) blockedIds.add(id);
  const ancestors = collectAncestorIds(element, elements);
  for (const id of ancestors) blockedIds.add(id);
  const candidates = elements.filter((el) => !blockedIds.has(el.id));
  for (const candidate of candidates) {
    const textBase = candidate.label || getElementTypeLabel(candidate.type);
    let optionText = textBase;
    if (candidate.parentId && candidate.parentId !== element.id) {
      const parentElement = elements.find((el) => el.id === candidate.parentId);
      if (parentElement) {
        const parentName = parentElement.label || getElementTypeLabel(parentElement.type);
        optionText = `${textBase} (in ${parentName})`;
      }
    }
    const option = document.createElement("option");
    option.value = candidate.id;
    option.text = optionText;
    addSelect.add(option);
  }
  const addButton = createElementsButton(addRow, { label: "Hinzuf\xFCgen" });
  addButton.onclick = (ev) => {
    ev.preventDefault();
    const target = addSelect.value;
    if (target) {
      callbacks.assignElementToContainer(target, element.id);
    }
  };
  const childList = childField.controlEl.createDiv({ cls: "sm-le-container-children" });
  const children = Array.isArray(element.children) ? element.children.map((childId) => elements.find((el) => el.id === childId)).filter((child) => !!child) : [];
  if (!children.length) {
    childList.createDiv({ cls: "sm-le-empty", text: "Keine Elemente verkn\xFCpft." });
  } else {
    for (const [idx, child] of children.entries()) {
      const row = childList.createDiv({ cls: "sm-le-container-child" });
      row.createSpan({ cls: "sm-le-container-child__label", text: child.label || getElementTypeLabel(child.type) });
      const controls = row.createDiv({ cls: "sm-le-container-child__actions" });
      const upBtn = createElementsButton(controls, { label: "\u2191" });
      upBtn.setAttr("title", "Nach oben");
      upBtn.disabled = idx === 0;
      upBtn.onclick = (ev) => {
        ev.preventDefault();
        callbacks.moveChildInContainer(element, child.id, -1);
      };
      const downBtn = createElementsButton(controls, { label: "\u2193" });
      downBtn.setAttr("title", "Nach unten");
      downBtn.disabled = idx === children.length - 1;
      downBtn.onclick = (ev) => {
        ev.preventDefault();
        callbacks.moveChildInContainer(element, child.id, 1);
      };
      const removeBtn = createElementsButton(controls, { label: "\u2715" });
      removeBtn.setAttr("title", "Entfernen");
      removeBtn.onclick = (ev) => {
        ev.preventDefault();
        callbacks.assignElementToContainer(child.id, null);
      };
    }
  }
}
function renderAttributeSelector(options) {
  const { element, attributesChip } = options;
  attributesChip.onclick = (ev) => {
    ev.preventDefault();
    const event = new CustomEvent("sm-layout-open-attributes", {
      detail: { elementId: element.id, anchor: attributesChip },
      bubbles: true
    });
    attributesChip.dispatchEvent(event);
  };
}
function renderPlaceholderField(options) {
  const { host, element, callbacks, label } = options;
  const field = createElementsField(host, { label });
  field.fieldEl.addClass("sm-le-field");
  const input = createElementsInput(field.controlEl, {});
  ensureFieldLabelFor(field, input);
  input.value = element.placeholder ?? "";
  const commit = () => {
    const raw = input.value;
    const next = raw ? raw : void 0;
    if (next === element.placeholder) return;
    element.placeholder = next;
    finalizeElementChange(element, callbacks);
  };
  input.onchange = commit;
  input.onblur = commit;
  return field.fieldEl;
}
function renderLabelField(options) {
  const { host, element, callbacks, label } = options;
  const field = createElementsField(host, { label });
  field.fieldEl.addClass("sm-le-field");
  const input = createElementsInput(field.controlEl, {});
  ensureFieldLabelFor(field, input);
  input.value = element.label ?? "";
  const commit = () => {
    const next = input.value ?? "";
    if (next === element.label) return;
    element.label = next;
    finalizeElementChange(element, callbacks, { rerender: true });
  };
  input.onchange = commit;
  input.onblur = commit;
  return field.fieldEl;
}
function renderOptionsEditor(options) {
  const { host, element, callbacks } = options;
  const field = createElementsField(host, { label: "Optionen", layout: "stack" });
  field.fieldEl.addClass("sm-le-field");
  const optionList = field.controlEl.createDiv({ cls: "sm-le-inline-options" });
  const optionValues = element.options ?? [];
  if (!optionValues.length) {
    optionList.createDiv({ cls: "sm-le-inline-options__empty", text: "Noch keine Optionen." });
  } else {
    optionValues.forEach((opt, index) => {
      const row = optionList.createDiv({ cls: "sm-le-inline-option" });
      const input = createElementsInput(row, { value: opt });
      input.addClass("sm-le-inline-option__input");
      input.onchange = () => {
        const next = input.value || opt;
        if (next === opt) return;
        const nextOptions = [...element.options ?? []];
        nextOptions[index] = next;
        element.options = nextOptions;
        if (element.defaultValue && element.defaultValue === opt) {
          element.defaultValue = next;
        }
        finalizeElementChange(element, callbacks, { rerender: true });
      };
      const remove = createElementsButton(row, { label: "\u2715" });
      remove.classList.add("sm-le-inline-option__remove");
      remove.setAttr("title", "Option entfernen");
      remove.onclick = (ev) => {
        ev.preventDefault();
        const nextOptions = (element.options ?? []).filter((_, idx) => idx !== index);
        element.options = nextOptions.length ? nextOptions : void 0;
        if (element.defaultValue && !nextOptions.includes(element.defaultValue)) {
          element.defaultValue = void 0;
        }
        finalizeElementChange(element, callbacks, { rerender: true });
      };
    });
  }
  const addButton = createElementsButton(field.controlEl, { label: "Option hinzuf\xFCgen" });
  addButton.classList.add("sm-le-inline-add");
  addButton.onclick = (ev) => {
    ev.preventDefault();
    const nextOptions = [...element.options ?? []];
    const labelText = `Option ${nextOptions.length + 1}`;
    nextOptions.push(labelText);
    element.options = nextOptions;
    finalizeElementChange(element, callbacks, { rerender: true });
  };
  return field.fieldEl;
}
function renderContainerLayoutControls(options) {
  const { host, element, callbacks } = options;
  if (!element.layout) return host;
  const field = createElementsField(host, { label: "Layout", layout: "stack" });
  field.fieldEl.addClass("sm-le-field");
  const controls = field.controlEl.createDiv({ cls: "sm-le-preview__layout" });
  const layout = element.layout;
  const gapWrap = controls.createDiv({ cls: "sm-le-inline-control" });
  gapWrap.createSpan({ text: "Abstand" });
  const gapInput = createElementsInput(gapWrap, { type: "number", min: 0 });
  gapInput.addClass("sm-le-inline-number");
  gapInput.value = String(Math.round(layout.gap));
  gapInput.onchange = () => {
    const next = Math.max(0, parseInt(gapInput.value, 10) || 0);
    if (next === layout.gap) return;
    layout.gap = next;
    gapInput.value = String(next);
    callbacks.applyContainerLayout(element, { silent: true });
    finalizeElementChange(element, callbacks);
  };
  const paddingWrap = controls.createDiv({ cls: "sm-le-inline-control" });
  paddingWrap.createSpan({ text: "Innenabstand" });
  const paddingInput = createElementsInput(paddingWrap, { type: "number", min: 0 });
  paddingInput.addClass("sm-le-inline-number");
  paddingInput.value = String(Math.round(layout.padding));
  paddingInput.onchange = () => {
    const next = Math.max(0, parseInt(paddingInput.value, 10) || 0);
    if (next === layout.padding) return;
    layout.padding = next;
    paddingInput.value = String(next);
    callbacks.applyContainerLayout(element, { silent: true });
    finalizeElementChange(element, callbacks);
  };
  const alignWrap = controls.createDiv({ cls: "sm-le-inline-control" });
  alignWrap.createSpan({ text: "Ausrichtung" });
  const containerType = element.type;
  const alignOptions = isVerticalContainer(containerType) ? [
    ["start", "Links"],
    ["center", "Zentriert"],
    ["end", "Rechts"],
    ["stretch", "Breite"]
  ] : [
    ["start", "Oben"],
    ["center", "Zentriert"],
    ["end", "Unten"],
    ["stretch", "H\xF6he"]
  ];
  const alignSelect = createElementsSelect(alignWrap, {
    options: alignOptions.map(([value, labelText]) => ({ value, label: labelText })),
    value: layout.align
  });
  alignSelect.addClass("sm-le-inline-select");
  alignSelect.onchange = () => {
    const next = alignSelect.value ?? layout.align;
    if (next === layout.align) return;
    layout.align = next;
    callbacks.applyContainerLayout(element, { silent: true });
    finalizeElementChange(element, callbacks);
  };
  return field;
}
function finalizeElementChange(element, callbacks, options) {
  callbacks.syncElementElement(element);
  callbacks.refreshExport();
  callbacks.updateStatus();
  callbacks.pushHistory();
  if (options?.rerender) {
    callbacks.renderInspector();
  }
}
function clampNumber(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

// src/layout-library.ts
var import_obsidian = require("obsidian");
var LAYOUT_FOLDER = "LayoutEditor/Layouts";
var LEGACY_LAYOUT_FOLDERS = ["Layout Editor/Layouts"];
var LAYOUT_FOLDER_CANDIDATES = [LAYOUT_FOLDER, ...LEGACY_LAYOUT_FOLDERS];
var FORBIDDEN_ID_CHARS = /[\\/]/;
async function ensureFolderPath(app, folderPath) {
  const normalized = (0, import_obsidian.normalizePath)(folderPath);
  const segments = normalized.split("/").filter(Boolean);
  let current = "";
  for (const segment of segments) {
    current = current ? `${current}/${segment}` : segment;
    const path = (0, import_obsidian.normalizePath)(current);
    const existing = app.vault.getAbstractFileByPath(path);
    if (existing) continue;
    await app.vault.createFolder(path).catch(() => {
    });
  }
}
async function ensureLayoutFolder(app) {
  await ensureFolderPath(app, LAYOUT_FOLDER);
}
function findLayoutFile(app, fileName) {
  for (const folder of LAYOUT_FOLDER_CANDIDATES) {
    const path = (0, import_obsidian.normalizePath)(`${folder}/${fileName}`);
    const file = app.vault.getAbstractFileByPath(path);
    if (file instanceof import_obsidian.TFile) {
      return file;
    }
  }
  return null;
}
function collectLayoutFiles(app) {
  const seen = /* @__PURE__ */ new Set();
  const files = [];
  for (const folder of LAYOUT_FOLDER_CANDIDATES) {
    const abstract = app.vault.getAbstractFileByPath((0, import_obsidian.normalizePath)(folder));
    if (!(abstract instanceof import_obsidian.TFolder)) continue;
    for (const child of abstract.children) {
      if (!(child instanceof import_obsidian.TFile) || child.extension !== "json") continue;
      if (seen.has(child.basename)) continue;
      seen.add(child.basename);
      files.push(child);
    }
  }
  return files;
}
function createFileName(id) {
  return `${id}.json`;
}
function sanitizeName(name) {
  return name.trim() || "Unbenanntes Layout";
}
function createId() {
  const globalCrypto = globalThis.crypto;
  if (globalCrypto?.randomUUID) {
    return globalCrypto.randomUUID();
  }
  return `layout-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}
function resolveLayoutId(candidate) {
  if (!candidate) {
    return createId();
  }
  const trimmed = candidate.trim();
  if (!trimmed) {
    return createId();
  }
  if (FORBIDDEN_ID_CHARS.test(trimmed)) {
    throw new Error("Layout-ID darf keine Pfadtrenner enthalten.");
  }
  if (trimmed === "." || trimmed === "..") {
    throw new Error("Layout-ID ist ung\xFCltig.");
  }
  return trimmed;
}
async function saveLayoutToLibrary(app, payload) {
  const id = resolveLayoutId(payload.id);
  const fileName = createFileName(id);
  let existing = findLayoutFile(app, fileName);
  const targetPath = (0, import_obsidian.normalizePath)(`${LAYOUT_FOLDER}/${fileName}`);
  if (!existing) {
    await ensureLayoutFolder(app);
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const canvasWidth = ensureCanvasDimension(payload.canvasWidth, "Breite");
  const canvasHeight = ensureCanvasDimension(payload.canvasHeight, "H\xF6he");
  const elements = normalizeElementsStrict(payload.elements);
  const entry = {
    id,
    name: sanitizeName(payload.name),
    canvasWidth,
    canvasHeight,
    elements,
    createdAt: existing instanceof import_obsidian.TFile ? (await readLayoutMeta(app, existing))?.createdAt ?? now : now,
    updatedAt: now
  };
  const body = JSON.stringify(entry, null, 2);
  if (existing instanceof import_obsidian.TFile) {
    await app.vault.modify(existing, body);
  } else {
    await app.vault.create(targetPath, body);
    existing = findLayoutFile(app, fileName);
  }
  return entry;
}
function ensureCanvasDimension(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error(`Ung\xFCltige ${label} f\xFCr das Layout.`);
  }
  return Math.round(value);
}
function parseDimension(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.trim());
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}
function normalizeStringArray(value) {
  let source;
  if (Array.isArray(value)) {
    source = value;
  } else if (value && typeof value === "object") {
    source = Object.values(value);
  } else {
    return void 0;
  }
  const filtered = source.filter((item) => typeof item === "string");
  return filtered.length ? filtered : [];
}
function normalizeLayoutConfig(value) {
  if (!value || typeof value !== "object") return void 0;
  const layout = value;
  const gap = parseDimension(layout.gap) ?? 0;
  const padding = parseDimension(layout.padding) ?? 0;
  const align = normalizeAlign(layout.align);
  return { gap, padding, align };
}
function normalizeElements(value) {
  const source = Array.isArray(value) ? value : value && typeof value === "object" ? Object.values(value) : null;
  if (!source) return null;
  const elements = [];
  for (const entry of source) {
    if (!entry || typeof entry !== "object") continue;
    const raw = entry;
    const id = typeof raw.id === "string" && raw.id.trim() ? raw.id : null;
    const type = typeof raw.type === "string" && raw.type.trim() ? raw.type : null;
    const x = parseDimension(raw.x);
    const y = parseDimension(raw.y);
    const width = parseDimension(raw.width);
    const height = parseDimension(raw.height);
    const label = typeof raw.label === "string" ? raw.label : "";
    if (!id || !type || x === null || y === null || width === null || height === null) continue;
    const element = {
      id,
      type,
      x,
      y,
      width,
      height,
      label,
      description: typeof raw.description === "string" ? raw.description : void 0,
      placeholder: typeof raw.placeholder === "string" ? raw.placeholder : void 0,
      defaultValue: typeof raw.defaultValue === "string" ? raw.defaultValue : void 0,
      options: normalizeStringArray(raw.options),
      attributes: normalizeStringArray(raw.attributes) ?? [],
      parentId: typeof raw.parentId === "string" ? raw.parentId : void 0,
      layout: normalizeLayoutConfig(raw.layout),
      children: normalizeStringArray(raw.children)
    };
    elements.push(element);
  }
  return elements;
}
function normalizeElementsStrict(value) {
  const normalized = normalizeElements(value);
  if (!normalized) {
    throw new Error("Layout enth\xE4lt keine g\xFCltigen Elemente.");
  }
  const expectedLength = Array.isArray(value) ? value.length : value && typeof value === "object" ? Object.keys(value).length : normalized.length;
  if (expectedLength !== normalized.length) {
    throw new Error("Mindestens ein Layout-Element enth\xE4lt ung\xFCltige Werte und konnte nicht gespeichert werden.");
  }
  return normalized;
}
function normalizeAlign(value) {
  if (typeof value !== "string") {
    return "stretch";
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "start" || normalized === "flex-start") return "start";
  if (normalized === "center") return "center";
  if (normalized === "end" || normalized === "flex-end") return "end";
  if (normalized === "stretch" || normalized === "space-between") return "stretch";
  return "stretch";
}
async function readLayoutMeta(app, file) {
  try {
    const raw = await app.vault.read(file);
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const canvasWidth = parseDimension(parsed.canvasWidth);
    const canvasHeight = parseDimension(parsed.canvasHeight);
    const elements = normalizeElements(parsed.elements);
    if (canvasWidth === null || canvasHeight === null || !elements) {
      return null;
    }
    const fallbackCreated = new Date(file.stat.ctime || Date.now()).toISOString();
    const fallbackUpdated = new Date(file.stat.mtime || Date.now()).toISOString();
    const fileId = file.basename;
    const resolvedName = typeof parsed.name === "string" && parsed.name.trim() ? parsed.name : fileId;
    return {
      id: fileId,
      name: resolvedName,
      canvasWidth,
      canvasHeight,
      elements,
      createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : fallbackCreated,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : fallbackUpdated
    };
  } catch (error) {
    console.error("Failed to read layout file", error);
    return null;
  }
}
async function listSavedLayouts(app) {
  await ensureLayoutFolder(app);
  const files = collectLayoutFiles(app);
  const out = [];
  for (const file of files) {
    const meta = await readLayoutMeta(app, file);
    if (meta) out.push(meta);
  }
  out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return out;
}
async function loadSavedLayout(app, id) {
  await ensureLayoutFolder(app);
  const fileName = createFileName(id);
  const file = findLayoutFile(app, fileName);
  if (!(file instanceof import_obsidian.TFile)) return null;
  return await readLayoutMeta(app, file);
}

// src/name-input-modal.ts
var import_obsidian2 = require("obsidian");
var NameInputModal = class extends import_obsidian2.Modal {
  constructor(app, onSubmit, options) {
    super(app);
    this.onSubmit = onSubmit;
    this.value = "";
    this.placeholder = options?.placeholder ?? "Layout-Namen eingeben";
    this.title = options?.title ?? "Neues Layout";
    this.ctaLabel = options?.cta ?? "Speichern";
    if (options?.initialValue) {
      this.value = options.initialValue.trim();
    }
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("sm-le-modal");
    const heading = createElementsHeading(contentEl, 3, this.title);
    heading.addClass("sm-le-modal__heading");
    const form = contentEl.createEl("form", { cls: "sm-le-modal__form" });
    const field = createElementsField(form, { label: "Name" });
    field.fieldEl.addClass("sm-le-modal__field");
    const inputEl = createElementsInput(field.controlEl, { placeholder: this.placeholder });
    ensureFieldLabelFor(field, inputEl);
    if (this.value) {
      inputEl.value = this.value;
    }
    inputEl.addEventListener("input", () => {
      this.value = inputEl.value.trim();
    });
    const actions = form.createDiv({ cls: "sm-le-modal__actions" });
    const submitBtn = createElementsButton(actions, { label: this.ctaLabel, variant: "primary", type: "submit" });
    submitBtn.addClass("mod-cta");
    form.onsubmit = (ev) => {
      ev.preventDefault();
      this.value = inputEl.value.trim();
      this.submit();
    };
    this.scope.register([], "Enter", () => {
      this.value = inputEl.value.trim();
      this.submit();
    });
    queueMicrotask(() => inputEl.focus());
  }
  onClose() {
    this.contentEl.empty();
    this.contentEl.removeClass("sm-le-modal");
  }
  submit() {
    const name = this.value || this.placeholder;
    this.close();
    this.onSubmit(name);
  }
};

// src/layout-picker-modal.ts
var import_obsidian3 = require("obsidian");
var LayoutPickerModal = class extends import_obsidian3.Modal {
  constructor(app, options) {
    super(app);
    this.layouts = [];
    this.selectedId = null;
    this.selectEl = null;
    this.statusEl = null;
    this.detailsEl = null;
    this.submitBtn = null;
    this.loadLayouts = options.loadLayouts;
    this.onPick = options.onPick;
  }
  async onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("sm-le-layout-picker");
    const heading = createElementsHeading(contentEl, 3, "Gespeichertes Layout laden");
    heading.addClass("sm-le-layout-picker__heading");
    createElementsParagraph(contentEl, "W\xE4hle ein Layout aus deiner Bibliothek, das in den Editor geladen werden soll.");
    this.selectEl = createElementsSelect(contentEl, { options: [], disabled: true });
    this.selectEl.classList.add("sm-le-layout-picker__select");
    this.selectEl.size = 1;
    this.selectEl.disabled = true;
    this.selectEl.addEventListener("change", () => this.handleSelectionChange());
    this.statusEl = createElementsStatus(contentEl, {
      text: "Layouts werden geladen \u2026"
    });
    this.statusEl.addClass("sm-le-layout-picker__status");
    this.detailsEl = contentEl.createDiv({ cls: "sm-le-layout-picker__details" });
    const buttonContainer = contentEl.createDiv({ cls: "modal-button-container" });
    const cancelBtn = createElementsButton(buttonContainer, { label: "Abbrechen" });
    cancelBtn.onclick = () => this.close();
    this.submitBtn = createElementsButton(buttonContainer, { label: "Layout laden", variant: "primary" });
    this.submitBtn.classList.add("mod-cta");
    this.submitBtn.disabled = true;
    this.submitBtn.onclick = () => this.submit();
    this.scope.register([], "Enter", () => this.submit());
    await this.fetchLayouts();
  }
  onClose() {
    this.contentEl.empty();
    this.layouts = [];
    this.selectedId = null;
    this.selectEl = null;
    this.statusEl = null;
    this.detailsEl = null;
    this.submitBtn = null;
  }
  async fetchLayouts() {
    if (!this.selectEl || !this.statusEl) return;
    try {
      const layouts = await this.loadLayouts();
      this.layouts = layouts;
      if (!layouts.length) {
        this.statusEl.setText("Keine gespeicherten Layouts gefunden.");
        this.selectEl.style.display = "none";
        this.submitBtn?.setAttribute("disabled", "disabled");
        return;
      }
      this.populateSelect();
      this.statusEl?.remove();
      this.statusEl = null;
      this.selectEl.disabled = false;
      this.selectEl.style.display = "";
      enhanceSelectToSearch(this.selectEl, "Layout suchen \u2026");
      this.handleSelectionChange();
    } catch (error) {
      console.error("LayoutPickerModal: failed to load layouts", error);
      if (!this.statusEl) {
        this.statusEl = createElementsStatus(this.contentEl, {
          text: "Layouts konnten nicht geladen werden.",
          tone: "warning"
        });
        this.statusEl.addClass("sm-le-layout-picker__status");
      } else {
        this.statusEl.setText("Layouts konnten nicht geladen werden.");
      }
      this.selectEl.style.display = "none";
      this.submitBtn?.setAttribute("disabled", "disabled");
    }
  }
  populateSelect() {
    if (!this.selectEl) return;
    const select = this.selectEl;
    const previous = this.selectedId;
    select.innerHTML = "";
    for (const layout of this.layouts) {
      const option = select.createEl("option", { value: layout.id });
      option.text = layout.name || layout.id;
    }
    if (!this.layouts.length) {
      this.selectedId = null;
      return;
    }
    const match = previous && this.layouts.some((layout) => layout.id === previous);
    const firstId = match ? previous : this.layouts[0].id;
    select.value = firstId;
    this.selectedId = firstId;
  }
  handleSelectionChange() {
    if (!this.selectEl) return;
    this.selectedId = this.selectEl.value || null;
    this.updateDetails();
    this.updateSubmitState();
  }
  updateDetails() {
    if (!this.detailsEl) return;
    if (!this.selectedId) {
      this.detailsEl.empty();
      return;
    }
    const layout = this.layouts.find((item) => item.id === this.selectedId);
    this.detailsEl.empty();
    if (!layout) return;
    const updated = formatTimestamp(layout.updatedAt);
    const created = layout.createdAt !== layout.updatedAt ? formatTimestamp(layout.createdAt) : null;
    const metaParts = [`Gr\xF6\xDFe: ${layout.canvasWidth} \xD7 ${layout.canvasHeight}`];
    metaParts.push(`Elemente: ${layout.elements.length}`);
    createElementsMeta(this.detailsEl, metaParts.join(" \xB7 "));
    const updatedEl = createElementsMeta(this.detailsEl, `Zuletzt aktualisiert: ${updated}`);
    if (created) {
      createElementsMeta(this.detailsEl, `Erstellt: ${created}`);
    }
    updatedEl.classList.add("sm-le-layout-picker__meta");
  }
  updateSubmitState() {
    if (!this.submitBtn) return;
    if (this.selectedId) {
      this.submitBtn.disabled = false;
      this.submitBtn.removeAttribute("disabled");
    } else {
      this.submitBtn.disabled = true;
      this.submitBtn.setAttribute("disabled", "disabled");
    }
  }
  submit() {
    const layoutId = this.selectedId;
    if (!layoutId) return;
    this.close();
    this.onPick(layoutId);
  }
};
function formatTimestamp(value) {
  try {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleString();
    }
  } catch (error) {
    console.warn("LayoutPickerModal: unable to format timestamp", value, error);
  }
  return value;
}

// src/element-picker-modal.ts
var import_obsidian4 = require("obsidian");

// src/ui/element-tree.ts
function renderElementTree(options) {
  const { host, nodes, onSelect, expandAll = false } = options;
  host.empty();
  const root = host.createDiv({ cls: "sm-elements-tree" });
  const context = { onSelect, depth: 0, expandAll };
  for (const node of nodes) {
    renderNode(root, node, context);
  }
}
function renderNode(container, node, context) {
  if (node.children && node.children.length > 0) {
    const groupEl = container.createDiv({ cls: "sm-elements-tree__group" });
    const headerEl = groupEl.createDiv({ cls: "sm-elements-tree__header" });
    const toggleEl = headerEl.createSpan({ cls: "sm-elements-tree__toggle" });
    headerEl.createSpan({ cls: "sm-elements-tree__label", text: node.label });
    const childrenEl = groupEl.createDiv({ cls: "sm-elements-tree__children" });
    let expanded = context.expandAll || context.depth === 0;
    const updateExpanded = () => {
      groupEl.toggleClass("is-expanded", expanded);
      toggleEl.setText(expanded ? "\u2212" : "+");
      childrenEl.style.display = expanded ? "flex" : "none";
    };
    updateExpanded();
    headerEl.addEventListener("click", (event) => {
      event.preventDefault();
      expanded = !expanded;
      updateExpanded();
    });
    const childContext = {
      onSelect: context.onSelect,
      depth: context.depth + 1,
      expandAll: context.expandAll
    };
    for (const child of node.children) {
      renderNode(childrenEl, child, childContext);
    }
    return;
  }
  if (!node.definition) return;
  const itemEl = container.createDiv({ cls: "sm-elements-tree__item" });
  const button = itemEl.createEl("button", {
    cls: "sm-elements-tree__item-button",
    text: node.label
  });
  button.type = "button";
  button.addEventListener("click", (event) => {
    event.preventDefault();
    context.onSelect(node.definition);
  });
}

// src/element-picker-modal.ts
var ElementPickerModal = class extends import_obsidian4.Modal {
  constructor(app, options) {
    super(app);
    this.filterText = "";
    this.treeHost = null;
    this.filterInput = null;
    this.emptyStateEl = null;
    this.definitions = options.definitions;
    this.onPick = options.onPick;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("sm-le-element-picker");
    createElementsHeading(contentEl, 3, "Element ausw\xE4hlen");
    createElementsParagraph(contentEl, "Durchsuche die Elementbibliothek und f\xFCge deinem Layout neue Bausteine hinzu.");
    const searchField = createElementsField(contentEl, { label: "Suchen", layout: "stack" });
    searchField.fieldEl.addClass("sm-le-element-picker__search");
    this.filterInput = createElementsInput(searchField.controlEl, {
      type: "search",
      placeholder: "Elementnamen oder Typen filtern \u2026"
    });
    ensureFieldLabelFor(searchField, this.filterInput);
    this.filterInput.addEventListener("input", () => this.handleFilterChange());
    this.treeHost = contentEl.createDiv({ cls: "sm-le-element-picker__tree" });
    this.renderTree();
    const buttonContainer = contentEl.createDiv({ cls: "modal-button-container" });
    const cancelBtn = createElementsButton(buttonContainer, { label: "Abbrechen" });
    cancelBtn.onclick = () => this.close();
  }
  onClose() {
    this.contentEl.empty();
    this.treeHost = null;
    this.filterInput = null;
    this.emptyStateEl = null;
    this.filterText = "";
  }
  handleFilterChange() {
    if (!this.filterInput) return;
    this.filterText = this.filterInput.value.trim();
    this.renderTree();
  }
  renderTree() {
    if (!this.treeHost) return;
    const definitions = this.getFilteredDefinitions();
    if (!definitions.length) {
      this.treeHost.empty();
      this.emptyStateEl = createElementsStatus(this.treeHost, {
        text: "Keine Elemente gefunden.",
        tone: "warning"
      });
      this.emptyStateEl.addClass("sm-le-element-picker__empty");
      return;
    }
    if (this.emptyStateEl) {
      this.emptyStateEl.remove();
      this.emptyStateEl = null;
    }
    const nodes = buildElementTree(definitions);
    renderElementTree({
      host: this.treeHost,
      nodes,
      expandAll: this.filterText.length > 0,
      onSelect: (definition) => this.selectDefinition(definition)
    });
  }
  getFilteredDefinitions() {
    const query = this.filterText.toLocaleLowerCase("de");
    const items = this.definitions.slice();
    items.sort((a, b) => a.buttonLabel.localeCompare(b.buttonLabel, "de"));
    if (!query) {
      return items;
    }
    return items.filter((definition) => {
      const label = definition.buttonLabel.toLocaleLowerCase("de");
      const type = definition.type.toLocaleLowerCase("de");
      const fallback = (definition.defaultLabel ?? "").toLocaleLowerCase("de");
      return label.includes(query) || type.includes(query) || fallback.includes(query);
    });
  }
  selectDefinition(definition) {
    this.close();
    this.onPick(definition.type);
  }
};
function buildElementTree(definitions) {
  const root = [];
  const index = /* @__PURE__ */ new Map();
  for (const definition of definitions) {
    const groups = getGroupPath(definition);
    let parentKey = "";
    let target = root;
    for (const group of groups) {
      const key = parentKey ? `${parentKey}/${group.id}` : group.id;
      let node = index.get(key);
      if (!node) {
        node = { id: key, label: group.label, children: [] };
        target.push(node);
        index.set(key, node);
      }
      target = node.children;
      parentKey = key;
    }
    target.push({ id: definition.type, label: definition.buttonLabel, definition });
  }
  sortTree(root);
  return root;
}
function sortTree(nodes) {
  nodes.sort((a, b) => a.label.localeCompare(b.label, "de"));
  for (const node of nodes) {
    if (node.children && node.children.length > 0) {
      sortTree(node.children);
    }
  }
}
function getGroupPath(definition) {
  const path = [];
  if (isContainerDefinition(definition)) {
    path.push({ id: "container", label: "Container" });
    const orientation = definition.layoutOrientation ?? "vertical";
    if (orientation === "horizontal") {
      path.push({ id: "container-horizontal", label: "Horizontale Container" });
    } else {
      path.push({ id: "container-vertical", label: "Vertikale Container" });
    }
    return path;
  }
  const paletteGroup = definition.paletteGroup;
  if (paletteGroup && paletteGroup !== "element") {
    path.push({ id: `group-${paletteGroup}`, label: getPaletteGroupLabel(paletteGroup) });
  } else {
    path.push({ id: "general", label: "Allgemeine Elemente" });
  }
  return path;
}
function isContainerDefinition(definition) {
  return definition.category === "container" || definition.paletteGroup === "container";
}
function getPaletteGroupLabel(groupId) {
  switch (groupId) {
    case "input":
      return "Eingabeelemente";
    case "container":
      return "Container";
    default:
      return capitalize(groupId);
  }
}
function capitalize(value) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

// src/view.ts
var VIEW_LAYOUT_EDITOR = "salt-layout-editor";
var LayoutEditorView = class extends import_obsidian5.ItemView {
  constructor() {
    super(...arguments);
    this.elements = [];
    this.selectedElementId = null;
    this.canvasWidth = 800;
    this.canvasHeight = 600;
    this.isImporting = false;
    this.elementDefinitions = getElementDefinitions();
    this.disposeDefinitionListener = null;
    this.disposeViewBindingListener = null;
    this.structureWidth = 260;
    this.inspectorWidth = 320;
    this.minPanelWidth = 200;
    this.minStageWidth = 320;
    this.resizerSize = 6;
    this.cameraScale = 1;
    this.cameraX = 0;
    this.cameraY = 0;
    this.panPointerId = null;
    this.panStartX = 0;
    this.panStartY = 0;
    this.panOriginX = 0;
    this.panOriginY = 0;
    this.hasInitializedCamera = false;
    this.structureRootDropZone = null;
    this.addElementControlEl = null;
    this.elementElements = /* @__PURE__ */ new Map();
    this.draggedElementId = null;
    this.isSavingLayout = false;
    this.lastSavedLayoutId = null;
    this.lastSavedLayoutName = "";
    this.lastSavedLayoutCreatedAt = null;
    this.lastSavedLayoutUpdatedAt = null;
    this.history = new LayoutHistory(
      () => this.captureSnapshot(),
      (snapshot) => this.restoreSnapshot(snapshot)
    );
    this.attributePopover = new AttributePopoverController({
      getElementById: (id) => this.elements.find((el) => el.id === id),
      syncElementElement: (element) => this.syncElementElement(element),
      refreshExport: () => this.refreshExport(),
      renderInspector: () => this.renderInspector(),
      updateStatus: () => this.updateStatus(),
      pushHistory: () => this.pushHistory()
    });
    this.onKeyDown = (ev) => {
      if (this.isEditingTarget(ev.target)) {
        return;
      }
      const key = ev.key.toLowerCase();
      const isModifier = ev.metaKey || ev.ctrlKey;
      if (key === "delete") {
        if (this.selectedElementId) {
          ev.preventDefault();
          this.deleteElement(this.selectedElementId);
        }
        return;
      }
      if (!isModifier) return;
      if (key === "z") {
        ev.preventDefault();
        if (ev.shiftKey) {
          this.redo();
        } else {
          this.undo();
        }
      }
    };
    this.onStagePointerDown = (event) => {
      if (event.button !== 1) return;
      if (!this.stageViewportEl) return;
      event.preventDefault();
      this.panPointerId = event.pointerId;
      this.panStartX = event.clientX;
      this.panStartY = event.clientY;
      this.panOriginX = this.cameraX;
      this.panOriginY = this.cameraY;
      this.stageViewportEl.setPointerCapture(event.pointerId);
      this.stageViewportEl.addClass("is-panning");
    };
    this.onStagePointerMove = (event) => {
      if (this.panPointerId === null) return;
      if (event.pointerId !== this.panPointerId) return;
      const dx = event.clientX - this.panStartX;
      const dy = event.clientY - this.panStartY;
      this.cameraX = this.panOriginX + dx;
      this.cameraY = this.panOriginY + dy;
      this.applyCameraTransform();
    };
    this.onStagePointerUp = (event) => {
      if (this.panPointerId === null) return;
      if (event.pointerId !== this.panPointerId) return;
      this.stageViewportEl?.releasePointerCapture(event.pointerId);
      this.stageViewportEl?.removeClass("is-panning");
      this.panPointerId = null;
    };
    this.onStageWheel = (event) => {
      if (!this.stageViewportEl) return;
      if (!event.deltaY) return;
      event.preventDefault();
      const scaleFactor = event.deltaY < 0 ? 1.1 : 1 / 1.1;
      const nextScale = clamp(this.cameraScale * scaleFactor, 0.25, 3);
      if (Math.abs(nextScale - this.cameraScale) < 1e-4) return;
      const rect = this.stageViewportEl.getBoundingClientRect();
      const pointerX = event.clientX - rect.left;
      const pointerY = event.clientY - rect.top;
      const worldX = (pointerX - this.cameraX) / this.cameraScale;
      const worldY = (pointerY - this.cameraY) / this.cameraScale;
      this.cameraScale = nextScale;
      this.cameraX = pointerX - worldX * this.cameraScale;
      this.cameraY = pointerY - worldY * this.cameraScale;
      this.applyCameraTransform();
    };
  }
  getViewType() {
    return VIEW_LAYOUT_EDITOR;
  }
  getDisplayText() {
    return "Layout Editor";
  }
  getIcon() {
    return "layout-grid";
  }
  async onOpen() {
    this.contentEl.addClass("sm-layout-editor");
    this.disposeDefinitionListener = onLayoutElementDefinitionsChanged((defs) => {
      this.elementDefinitions = defs;
      this.renderAddElementControl();
      this.renderInspector();
    });
    this.disposeViewBindingListener = onViewBindingsChanged(() => {
      this.renderInspector();
      this.renderElements();
    });
    this.render();
    this.refreshExport();
    this.updateStatus();
  }
  async onClose() {
    this.attributePopover.close();
    this.elementElements.clear();
    this.contentEl.empty();
    this.contentEl.removeClass("sm-layout-editor");
    this.addElementControlEl = null;
    this.saveButton = void 0;
    this.isSavingLayout = false;
    this.disposeDefinitionListener?.();
    this.disposeDefinitionListener = null;
    this.disposeViewBindingListener?.();
    this.disposeViewBindingListener = null;
  }
  isEditingTarget(target) {
    if (!target) return false;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
      return true;
    }
    if (target instanceof HTMLElement && target.isContentEditable) {
      return true;
    }
    return false;
  }
  captureSnapshot() {
    return {
      canvasWidth: this.canvasWidth,
      canvasHeight: this.canvasHeight,
      selectedElementId: this.selectedElementId,
      elements: this.elements.map(cloneLayoutElement)
    };
  }
  restoreSnapshot(snapshot) {
    this.canvasWidth = snapshot.canvasWidth;
    this.canvasHeight = snapshot.canvasHeight;
    this.selectedElementId = snapshot.selectedElementId;
    this.elements = snapshot.elements.map(cloneLayoutElement);
    if (this.widthInput) this.widthInput.value = String(this.canvasWidth);
    if (this.heightInput) this.heightInput.value = String(this.canvasHeight);
    this.attributePopover.close();
    this.applyCanvasSize();
    this.renderElements();
    this.renderInspector();
    this.refreshExport();
    this.updateStatus();
  }
  pushHistory() {
    if (this.history.isRestoring) return;
    this.history.push();
  }
  undo() {
    this.history.undo();
  }
  redo() {
    this.history.redo();
  }
  finalizeInlineMutation(element) {
    if (this.history.isRestoring) return;
    this.syncElementElement(element);
    if (isContainerElement(element)) {
      this.applyContainerLayout(element, { silent: true });
    }
    this.refreshExport();
    this.renderInspector();
    this.updateStatus();
    this.pushHistory();
  }
  render() {
    const root = this.contentEl;
    root.empty();
    const header = root.createDiv({ cls: "sm-le-header" });
    createElementsHeading(header, 2, "Layout Editor");
    const controls = header.createDiv({ cls: "sm-le-controls" });
    const addGroup = createElementsField(controls, { label: "Element hinzuf\xFCgen", layout: "stack" });
    addGroup.fieldEl.addClass("sm-le-control");
    addGroup.fieldEl.addClass("sm-le-control--stack");
    this.addElementControlEl = addGroup.controlEl;
    this.addElementControlEl.addClass("sm-le-add");
    this.renderAddElementControl();
    const libraryGroup = createElementsField(controls, { label: "Layout-Bibliothek", layout: "stack" });
    libraryGroup.fieldEl.addClass("sm-le-control");
    this.importBtn = createElementsButton(libraryGroup.controlEl, { label: "Gespeichertes Layout laden" });
    this.importBtn.onclick = () => this.promptImportSavedLayout();
    const sizeGroup = createElementsField(controls, { label: "Arbeitsfl\xE4che", layout: "inline" });
    sizeGroup.fieldEl.addClass("sm-le-control");
    const sizeWrapper = sizeGroup.controlEl;
    sizeWrapper.addClass("sm-le-size");
    this.widthInput = createElementsInput(sizeWrapper, {
      type: "number",
      min: 200,
      max: 2e3,
      value: String(this.canvasWidth)
    });
    ensureFieldLabelFor(sizeGroup, this.widthInput);
    this.widthInput.onchange = () => {
      const next = clamp(parseInt(this.widthInput.value, 10) || this.canvasWidth, 200, 2e3);
      this.canvasWidth = next;
      this.widthInput.value = String(next);
      this.applyCanvasSize();
      this.refreshExport();
      this.updateStatus();
      this.pushHistory();
    };
    sizeWrapper.createSpan({ cls: "sm-elements-inline-text", text: "\xD7" });
    this.heightInput = createElementsInput(sizeWrapper, {
      type: "number",
      min: 200,
      max: 2e3,
      value: String(this.canvasHeight)
    });
    this.heightInput.onchange = () => {
      const next = clamp(parseInt(this.heightInput.value, 10) || this.canvasHeight, 200, 2e3);
      this.canvasHeight = next;
      this.heightInput.value = String(next);
      this.applyCanvasSize();
      this.refreshExport();
      this.updateStatus();
      this.pushHistory();
    };
    sizeWrapper.createSpan({ cls: "sm-elements-inline-text", text: "px" });
    this.statusEl = createElementsStatus(header, { text: "" });
    this.statusEl.addClass("sm-le-status");
    this.bodyEl = root.createDiv({ cls: "sm-le-body" });
    this.structurePanelEl = this.bodyEl.createDiv({ cls: "sm-le-panel sm-le-panel--structure" });
    this.structurePanelEl.createEl("h3", { text: "Struktur" });
    this.structureHost = this.structurePanelEl.createDiv({ cls: "sm-le-structure" });
    const leftResizer = this.bodyEl.createDiv({ cls: "sm-le-resizer sm-le-resizer--structure" });
    leftResizer.setAttr("role", "separator");
    leftResizer.setAttr("aria-orientation", "vertical");
    leftResizer.tabIndex = 0;
    leftResizer.onpointerdown = (event) => this.beginResizePanel(event, "structure");
    const stage = this.bodyEl.createDiv({ cls: "sm-le-stage" });
    this.stageViewportEl = stage.createDiv({ cls: "sm-le-stage__viewport" });
    this.stageViewportEl.addEventListener("pointerdown", this.onStagePointerDown);
    this.stageViewportEl.addEventListener("pointermove", this.onStagePointerMove);
    this.stageViewportEl.addEventListener("pointerup", this.onStagePointerUp);
    this.stageViewportEl.addEventListener("pointercancel", this.onStagePointerUp);
    this.stageViewportEl.addEventListener("wheel", this.onStageWheel, { passive: false });
    this.cameraPanEl = this.stageViewportEl.createDiv({ cls: "sm-le-stage__camera" });
    this.cameraZoomEl = this.cameraPanEl.createDiv({ cls: "sm-le-stage__zoom" });
    this.canvasEl = this.cameraZoomEl.createDiv({ cls: "sm-le-canvas" });
    this.canvasEl.style.width = `${this.canvasWidth}px`;
    this.canvasEl.style.height = `${this.canvasHeight}px`;
    this.registerDomEvent(this.canvasEl, "pointerdown", (ev) => {
      if (ev.target === this.canvasEl) {
        this.selectElement(null);
      }
    });
    this.registerDomEvent(window, "keydown", this.onKeyDown);
    const rightResizer = this.bodyEl.createDiv({ cls: "sm-le-resizer sm-le-resizer--inspector" });
    rightResizer.setAttr("role", "separator");
    rightResizer.setAttr("aria-orientation", "vertical");
    rightResizer.tabIndex = 0;
    rightResizer.onpointerdown = (event) => this.beginResizePanel(event, "inspector");
    this.inspectorPanelEl = this.bodyEl.createDiv({ cls: "sm-le-panel sm-le-panel--inspector" });
    this.inspectorPanelEl.createEl("h3", { text: "Eigenschaften" });
    this.inspectorHost = this.inspectorPanelEl.createDiv({ cls: "sm-le-inspector" });
    this.registerDomEvent(this.inspectorHost, "sm-layout-open-attributes", (ev) => {
      const detail = ev.detail;
      if (!detail) return;
      const element = this.elements.find((el) => el.id === detail.elementId);
      if (element) {
        this.attributePopover.open(element, detail.anchor);
        this.attributePopover.position();
      }
    });
    const exportWrap = root.createDiv({ cls: "sm-le-export" });
    exportWrap.createEl("h3", { text: "Layout-Daten" });
    const exportControls = exportWrap.createDiv({ cls: "sm-le-export__controls" });
    const copyBtn = createElementsButton(exportControls, { label: "JSON kopieren" });
    copyBtn.onclick = async () => {
      if (!this.exportEl.value) return;
      try {
        const clip = navigator.clipboard;
        if (!clip || typeof clip.writeText !== "function") {
          throw new Error("Clipboard API nicht verf\xFCgbar");
        }
        await clip.writeText(this.exportEl.value);
        new import_obsidian5.Notice("Layout kopiert");
      } catch (error) {
        console.error("Clipboard write failed", error);
        new import_obsidian5.Notice("Konnte nicht in die Zwischenablage kopieren");
      }
    };
    this.saveButton = createElementsButton(exportControls, { label: "Layout speichern", variant: "primary" });
    this.saveButton.onclick = () => this.promptSaveLayout();
    this.exportEl = exportWrap.createEl("textarea", {
      cls: "sm-le-export__textarea",
      attr: { rows: "10", readonly: "readonly" }
    });
    this.sandboxEl = root.createDiv({ cls: "sm-le-sandbox" });
    this.sandboxEl.style.position = "absolute";
    this.sandboxEl.style.top = "-10000px";
    this.sandboxEl.style.left = "-10000px";
    this.sandboxEl.style.visibility = "hidden";
    this.sandboxEl.style.pointerEvents = "none";
    this.sandboxEl.style.width = "960px";
    this.sandboxEl.style.padding = "24px";
    this.sandboxEl.style.boxSizing = "border-box";
    this.renderElements();
    this.renderInspector();
    this.history.reset(this.captureSnapshot());
    this.applyPanelSizes();
    this.applyCameraTransform();
    this.renderStructure();
    requestAnimationFrame(() => {
      if (this.hasInitializedCamera) return;
      this.centerCamera();
      this.hasInitializedCamera = true;
    });
  }
  renderAddElementControl() {
    if (!this.addElementControlEl) return;
    const host = this.addElementControlEl;
    host.empty();
    const button = createElementsButton(host, { label: "+ Element", variant: "primary" });
    button.classList.add("sm-le-add__trigger");
    button.onclick = () => this.openElementPicker();
  }
  openElementPicker() {
    if (!this.elementDefinitions.length) {
      new import_obsidian5.Notice("Keine Elementtypen registriert.");
      return;
    }
    const modal = new ElementPickerModal(this.app, {
      definitions: this.elementDefinitions,
      onPick: (type) => this.createElement(type)
    });
    modal.open();
  }
  findDefinition(type) {
    return this.elementDefinitions.find((def) => def.type === type) ?? getElementDefinition(type);
  }
  promptSaveLayout() {
    if (this.isSavingLayout) return;
    const modal = new NameInputModal(
      this.app,
      (name) => {
        void this.handleSaveLayout(name);
      },
      {
        placeholder: "Layout-Namen eingeben",
        title: "Layout speichern",
        cta: "Speichern",
        initialValue: this.lastSavedLayoutName
      }
    );
    modal.open();
  }
  async handleSaveLayout(name) {
    const trimmed = name.trim();
    if (!trimmed) {
      new import_obsidian5.Notice("Bitte gib einen Namen f\xFCr das Layout an");
      return;
    }
    if (this.isSavingLayout) return;
    this.isSavingLayout = true;
    this.saveButton?.setAttribute("disabled", "disabled");
    const reuseId = this.lastSavedLayoutName === trimmed ? this.lastSavedLayoutId ?? void 0 : void 0;
    try {
      const saved = await saveLayoutToLibrary(this.app, {
        name: trimmed,
        id: reuseId,
        canvasWidth: this.canvasWidth,
        canvasHeight: this.canvasHeight,
        elements: this.elements.map(cloneLayoutElement)
      });
      this.lastSavedLayoutId = saved.id;
      this.lastSavedLayoutName = saved.name;
      this.lastSavedLayoutCreatedAt = saved.createdAt;
      this.lastSavedLayoutUpdatedAt = saved.updatedAt;
      new import_obsidian5.Notice(`Layout \u201E${saved.name}\u201D gespeichert`);
    } catch (error) {
      console.error("Failed to save layout", error);
      const message = error instanceof Error && error.message ? error.message : "Konnte Layout nicht speichern";
      new import_obsidian5.Notice(message);
    } finally {
      this.isSavingLayout = false;
      this.saveButton?.removeAttribute("disabled");
    }
  }
  applyPanelSizes() {
    if (this.structurePanelEl) {
      const width = Math.max(this.minPanelWidth, Math.round(this.structureWidth));
      this.structurePanelEl.style.flex = `0 0 ${width}px`;
      this.structurePanelEl.style.width = `${width}px`;
    }
    if (this.inspectorPanelEl) {
      const width = Math.max(this.minPanelWidth, Math.round(this.inspectorWidth));
      this.inspectorPanelEl.style.flex = `0 0 ${width}px`;
      this.inspectorPanelEl.style.width = `${width}px`;
    }
  }
  beginResizePanel(event, target) {
    if (event.button !== 0) return;
    if (!this.bodyEl) return;
    event.preventDefault();
    const handle = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
    const pointerId = event.pointerId;
    const otherWidth = target === "structure" ? this.inspectorWidth : this.structureWidth;
    const onPointerMove = (ev) => {
      if (ev.pointerId !== pointerId) return;
      const bodyRect = this.bodyEl.getBoundingClientRect();
      const maxWidth = Math.max(
        this.minPanelWidth,
        bodyRect.width - otherWidth - this.resizerSize * 2 - this.minStageWidth
      );
      let proposedWidth;
      if (target === "structure") {
        proposedWidth = ev.clientX - bodyRect.left - this.resizerSize / 2;
      } else {
        proposedWidth = bodyRect.right - ev.clientX - this.resizerSize / 2;
      }
      const next = clamp(Math.round(proposedWidth), this.minPanelWidth, maxWidth);
      if (target === "structure") {
        this.structureWidth = next;
      } else {
        this.inspectorWidth = next;
      }
      this.applyPanelSizes();
    };
    const onPointerUp = (ev) => {
      if (ev.pointerId !== pointerId) return;
      handle?.removeEventListener("pointermove", onPointerMove);
      handle?.removeEventListener("pointerup", onPointerUp);
      handle?.releasePointerCapture(pointerId);
      handle?.removeClass("is-active");
    };
    handle?.setPointerCapture(pointerId);
    handle?.addClass("is-active");
    handle?.addEventListener("pointermove", onPointerMove);
    handle?.addEventListener("pointerup", onPointerUp);
  }
  centerCamera() {
    if (!this.stageViewportEl) return;
    const rect = this.stageViewportEl.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const scaledWidth = this.canvasWidth * this.cameraScale;
    const scaledHeight = this.canvasHeight * this.cameraScale;
    this.cameraX = Math.round((rect.width - scaledWidth) / 2);
    this.cameraY = Math.round((rect.height - scaledHeight) / 2);
    this.applyCameraTransform();
  }
  applyCameraTransform() {
    if (this.cameraPanEl) {
      this.cameraPanEl.style.transform = `translate(${Math.round(this.cameraX)}px, ${Math.round(this.cameraY)}px)`;
    }
    if (this.cameraZoomEl) {
      this.cameraZoomEl.style.transform = `scale(${this.cameraScale})`;
    }
  }
  focusElementInCamera(element) {
    if (!this.stageViewportEl) return;
    const rect = this.stageViewportEl.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const scale = this.cameraScale || 1;
    const centerX = element.x + element.width / 2;
    const centerY = element.y + element.height / 2;
    this.cameraX = Math.round(rect.width / 2 - centerX * scale);
    this.cameraY = Math.round(rect.height / 2 - centerY * scale);
    this.applyCameraTransform();
  }
  applyCanvasSize() {
    if (!this.canvasEl) return;
    this.canvasEl.style.width = `${this.canvasWidth}px`;
    this.canvasEl.style.height = `${this.canvasHeight}px`;
    for (const element of this.elements) {
      const maxX = Math.max(0, this.canvasWidth - element.width);
      const maxY = Math.max(0, this.canvasHeight - element.height);
      element.x = clamp(element.x, 0, maxX);
      element.y = clamp(element.y, 0, maxY);
      const maxWidth = Math.max(MIN_ELEMENT_SIZE, this.canvasWidth - element.x);
      const maxHeight = Math.max(MIN_ELEMENT_SIZE, this.canvasHeight - element.y);
      element.width = clamp(element.width, MIN_ELEMENT_SIZE, maxWidth);
      element.height = clamp(element.height, MIN_ELEMENT_SIZE, maxHeight);
      this.syncElementElement(element);
    }
    for (const element of this.elements) {
      if (isContainerType(element.type)) {
        this.applyContainerLayout(element, { silent: true });
      }
    }
    this.attributePopover.refresh();
    this.renderStructure();
  }
  createElement(type, options) {
    const def = this.findDefinition(type);
    const width = def ? def.width : Math.min(240, Math.max(160, Math.round(this.canvasWidth * 0.25)));
    const height = def ? def.height : Math.min(160, Math.max(120, Math.round(this.canvasHeight * 0.25)));
    const element = {
      id: generateElementId(),
      type,
      x: Math.max(0, Math.round((this.canvasWidth - width) / 2)),
      y: Math.max(0, Math.round((this.canvasHeight - height) / 2)),
      width,
      height,
      label: def?.defaultLabel ?? type,
      description: def?.defaultDescription,
      placeholder: def?.defaultPlaceholder,
      defaultValue: def?.defaultValue,
      options: def?.options ? [...def.options] : void 0,
      attributes: []
    };
    if (def?.defaultLayout) {
      element.layout = { ...def.defaultLayout };
      element.children = [];
    }
    const requestedParentId = options?.parentId ?? null;
    let parentContainer = null;
    if (requestedParentId) {
      const candidate = this.elements.find((el) => el.id === requestedParentId);
      if (candidate && isContainerElement(candidate)) {
        parentContainer = candidate;
      }
    }
    if (!parentContainer) {
      const selected = this.selectedElementId ? this.elements.find((el) => el.id === this.selectedElementId) : null;
      parentContainer = selected && isContainerElement(selected) ? selected : null;
    }
    if (parentContainer) {
      element.parentId = parentContainer.id;
      const padding = parentContainer.layout.padding;
      element.x = parentContainer.x + padding;
      element.y = parentContainer.y + padding;
      element.width = Math.min(parentContainer.width - padding * 2, element.width);
      element.height = Math.min(parentContainer.height - padding * 2, element.height);
    }
    this.elements.push(element);
    if (parentContainer) {
      this.addChildToContainer(parentContainer, element.id);
      this.applyContainerLayout(parentContainer);
    }
    this.renderElements();
    this.selectElement(element.id);
    this.refreshExport();
    this.updateStatus();
    this.pushHistory();
  }
  renderElements() {
    if (!this.canvasEl) return;
    const seen = /* @__PURE__ */ new Set();
    for (const element of this.elements) {
      if (isContainerType(element.type)) {
        this.ensureContainerDefaults(element);
      }
      seen.add(element.id);
      let el = this.elementElements.get(element.id);
      if (!el) {
        el = this.createElementNode(element);
        this.elementElements.set(element.id, el);
      }
      this.syncElementElement(element);
    }
    for (const [id, el] of Array.from(this.elementElements.entries())) {
      if (!seen.has(id)) {
        el.remove();
        this.elementElements.delete(id);
      }
    }
    this.updateSelectionStyles();
    this.updateStatus();
    this.attributePopover.refresh();
    this.renderStructure();
  }
  createElementNode(element) {
    const el = this.canvasEl.createDiv({ cls: "sm-le-box" });
    el.dataset.id = element.id;
    const content = el.createDiv({ cls: "sm-le-box__content" });
    content.dataset.role = "content";
    const updateCursor = (event) => {
      const mode = this.resolveInteractionMode(el, event);
      if (!mode) {
        el.style.cursor = "";
        return;
      }
      if (mode.type === "resize") {
        const cursor = mode.corner === "nw" || mode.corner === "se" ? "nwse-resize" : "nesw-resize";
        el.style.cursor = cursor;
      } else {
        el.style.cursor = "move";
      }
    };
    el.addEventListener("pointermove", (ev) => {
      if (ev.buttons) return;
      updateCursor(ev);
    });
    el.addEventListener("pointerleave", () => {
      if (el.hasClass("is-interacting")) return;
      el.style.cursor = "";
    });
    el.addEventListener("pointerdown", (ev) => {
      this.selectElement(element.id);
      const mode = this.resolveInteractionMode(el, ev);
      if (!mode) {
        return;
      }
      ev.preventDefault();
      ev.stopPropagation();
      el.addClass("is-interacting");
      if (mode.type === "resize") {
        this.beginResize(element, ev, mode.corner, () => {
          el.removeClass("is-interacting");
          el.style.cursor = "";
        });
      } else {
        this.beginMove(element, ev, () => {
          el.removeClass("is-interacting");
          el.style.cursor = "";
        });
      }
    });
    return el;
  }
  syncElementElement(element) {
    const el = this.elementElements.get(element.id);
    if (!el) return;
    el.style.left = `${Math.round(element.x)}px`;
    el.style.top = `${Math.round(element.y)}px`;
    el.style.width = `${Math.round(element.width)}px`;
    el.style.height = `${Math.round(element.height)}px`;
    el.classList.toggle("is-container", isContainerType(element.type));
    const contentEl = el.querySelector('[data-role="content"]');
    if (contentEl) {
      renderElementPreview({
        host: contentEl,
        element,
        elements: this.elements,
        finalize: (target) => this.finalizeInlineMutation(target),
        ensureContainerDefaults: (target) => this.ensureContainerDefaults(target),
        applyContainerLayout: (target, options) => this.applyContainerLayout(target, options),
        pushHistory: () => this.pushHistory(),
        createElement: (type, options) => this.createElement(type, options)
      });
    }
  }
  selectElement(id) {
    this.attributePopover.close();
    this.selectedElementId = id;
    this.updateSelectionStyles();
    this.renderInspector();
    this.renderStructure();
  }
  updateSelectionStyles() {
    for (const [id, el] of this.elementElements) {
      el.classList.toggle("is-selected", id === this.selectedElementId);
    }
  }
  renderInspector() {
    if (!this.inspectorHost) return;
    const element = this.selectedElementId ? this.elements.find((el) => el.id === this.selectedElementId) : null;
    renderInspectorPanel({
      host: this.inspectorHost,
      element: element ?? null,
      elements: this.elements,
      definitions: this.elementDefinitions,
      canvasWidth: this.canvasWidth,
      canvasHeight: this.canvasHeight,
      callbacks: {
        ensureContainerDefaults: (target) => this.ensureContainerDefaults(target),
        assignElementToContainer: (elementId, containerId) => this.assignElementToContainer(elementId, containerId),
        syncElementElement: (target) => this.syncElementElement(target),
        refreshExport: () => this.refreshExport(),
        updateStatus: () => this.updateStatus(),
        pushHistory: () => this.pushHistory(),
        renderInspector: () => this.renderInspector(),
        applyContainerLayout: (target, options) => this.applyContainerLayout(target, options),
        createElement: (type, options) => this.createElement(type, options),
        moveChildInContainer: (container, childId, offset) => this.moveChildInContainer(container, childId, offset),
        deleteElement: (id) => this.deleteElement(id)
      }
    });
    this.attributePopover.refresh();
    this.renderStructure();
  }
  refreshExport() {
    if (!this.exportEl) return;
    const payload = {
      canvasWidth: Math.round(this.canvasWidth),
      canvasHeight: Math.round(this.canvasHeight),
      elements: this.elements.map((element) => {
        const clone = cloneLayoutElement(element);
        return {
          ...clone,
          x: Math.round(clone.x),
          y: Math.round(clone.y),
          width: Math.round(clone.width),
          height: Math.round(clone.height)
        };
      }),
      id: this.lastSavedLayoutId,
      name: this.lastSavedLayoutName.trim() ? this.lastSavedLayoutName : null,
      createdAt: this.lastSavedLayoutCreatedAt,
      updatedAt: this.lastSavedLayoutUpdatedAt ?? this.lastSavedLayoutCreatedAt
    };
    this.exportEl.value = JSON.stringify(payload, null, 2);
  }
  updateStatus() {
    if (!this.statusEl) return;
    const count = this.elements.length;
    const selection = this.selectedElementId ? this.elements.find((el) => el.id === this.selectedElementId) : null;
    const parts = [`${count} Element${count === 1 ? "" : "e"}`];
    if (selection) {
      parts.push(`Ausgew\xE4hlt: ${selection.label || getElementTypeLabel(selection.type)}`);
    }
    this.statusEl.setText(parts.join(" \xB7 "));
  }
  renderStructure() {
    if (!this.structureHost) return;
    this.structureHost.empty();
    this.structureRootDropZone = null;
    if (!this.elements.length) {
      this.structureHost.createDiv({ cls: "sm-le-empty", text: "Noch keine Elemente." });
      return;
    }
    const elementById = new Map(this.elements.map((element) => [element.id, element]));
    const childrenByParent = /* @__PURE__ */ new Map();
    for (const element of this.elements) {
      const parentExists = element.parentId && elementById.has(element.parentId) ? element.parentId : null;
      const key = parentExists ?? null;
      const bucket = childrenByParent.get(key);
      if (bucket) {
        bucket.push(element);
      } else {
        childrenByParent.set(key, [element]);
      }
    }
    for (const element of this.elements) {
      if (!isContainerElement(element) || !element.children?.length) continue;
      const list = childrenByParent.get(element.id);
      if (!list) continue;
      const lookup = new Map(list.map((child) => [child.id, child]));
      const ordered = [];
      for (const childId of element.children) {
        const child = lookup.get(childId);
        if (child) {
          ordered.push(child);
          lookup.delete(childId);
        }
      }
      for (const child of list) {
        if (lookup.has(child.id)) {
          ordered.push(child);
          lookup.delete(child.id);
        }
      }
      childrenByParent.set(element.id, ordered);
    }
    const rootDropZone = this.structureHost.createDiv({
      cls: "sm-le-structure__root-drop",
      text: "Ziehe ein Element hierher, um es aus seinem Container zu l\xF6sen."
    });
    this.structureRootDropZone = rootDropZone;
    const canDropToRoot = () => {
      if (!this.draggedElementId) return false;
      const dragged = elementById.get(this.draggedElementId);
      if (!dragged) return false;
      return Boolean(dragged.parentId);
    };
    rootDropZone.addEventListener("dragenter", (event) => {
      if (!canDropToRoot()) return;
      event.preventDefault();
      rootDropZone.addClass("is-active");
    });
    rootDropZone.addEventListener("dragover", (event) => {
      if (!canDropToRoot()) return;
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "move";
      }
      rootDropZone.addClass("is-active");
    });
    rootDropZone.addEventListener("dragleave", (event) => {
      const related = event.relatedTarget;
      if (!related || !rootDropZone.contains(related)) {
        rootDropZone.removeClass("is-active");
      }
    });
    rootDropZone.addEventListener("drop", (event) => {
      if (!canDropToRoot()) return;
      event.preventDefault();
      event.stopPropagation();
      rootDropZone.removeClass("is-active");
      const draggedId = this.draggedElementId;
      if (draggedId) {
        this.assignElementToContainer(draggedId, null);
      }
      this.clearStructureDragState();
    });
    const renderLevel = (parentId, container) => {
      const children = childrenByParent.get(parentId);
      if (!children || !children.length) return;
      const listEl = container.createEl("ul", { cls: "sm-le-structure__list" });
      for (const child of children) {
        const itemEl = listEl.createEl("li", { cls: "sm-le-structure__item" });
        const entry = createElementsButton(itemEl, { label: "" });
        entry.addClass("sm-le-structure__entry");
        entry.dataset.id = child.id;
        if (this.selectedElementId === child.id) {
          entry.addClass("is-selected");
        }
        entry.setText("");
        const name = child.label?.trim() || getElementTypeLabel(child.type);
        entry.createSpan({ cls: "sm-le-structure__title", text: name });
        const parentElement = child.parentId ? elementById.get(child.parentId) ?? null : null;
        const metaParts = [getElementTypeLabel(child.type)];
        if (parentElement) {
          const parentName = parentElement.label?.trim() || getElementTypeLabel(parentElement.type);
          metaParts.push(`\xDCbergeordnet: ${parentName}`);
        }
        if (isContainerElement(child)) {
          const count = child.children?.length ?? 0;
          const label = count === 1 ? "1 Kind" : `${count} Kinder`;
          metaParts.push(label);
          entry.addClass("sm-le-structure__entry--container");
        }
        entry.createSpan({ cls: "sm-le-structure__meta", text: metaParts.join(" \u2022 ") });
        entry.onclick = (ev) => {
          ev.preventDefault();
          this.selectElement(child.id);
          this.focusElementInCamera(child);
        };
        entry.draggable = true;
        entry.addClass("is-draggable");
        entry.addEventListener("dragstart", (dragEvent) => {
          this.draggedElementId = child.id;
          dragEvent.dataTransfer?.setData("text/plain", child.id);
          if (dragEvent.dataTransfer) {
            dragEvent.dataTransfer.effectAllowed = "move";
          }
        });
        entry.addEventListener("dragend", () => {
          this.clearStructureDragState();
        });
        if (isContainerElement(child)) {
          const canDropHere = () => this.canDropOnContainer(child.id);
          entry.addEventListener("dragenter", (dragEvent) => {
            if (!canDropHere()) return;
            dragEvent.preventDefault();
            entry.addClass("is-drop-target");
          });
          entry.addEventListener("dragover", (dragEvent) => {
            if (!canDropHere()) return;
            dragEvent.preventDefault();
            if (dragEvent.dataTransfer) {
              dragEvent.dataTransfer.dropEffect = "move";
            }
            entry.addClass("is-drop-target");
          });
          entry.addEventListener("dragleave", (dragEvent) => {
            const related = dragEvent.relatedTarget;
            if (!related || !entry.contains(related)) {
              entry.removeClass("is-drop-target");
            }
          });
          entry.addEventListener("drop", (dragEvent) => {
            if (!canDropHere()) return;
            dragEvent.preventDefault();
            dragEvent.stopPropagation();
            const draggedId = this.draggedElementId;
            if (draggedId) {
              this.assignElementToContainer(draggedId, child.id);
            }
            this.clearStructureDragState();
          });
        }
        renderLevel(child.id, itemEl);
      }
    };
    renderLevel(null, this.structureHost);
  }
  clearStructureDragState() {
    this.draggedElementId = null;
    if (this.structureHost) {
      const targets = Array.from(this.structureHost.querySelectorAll(".sm-le-structure__entry.is-drop-target"));
      for (const target of targets) {
        target.removeClass("is-drop-target");
      }
    }
    this.structureRootDropZone?.removeClass("is-active");
  }
  canDropOnContainer(containerId) {
    if (!this.draggedElementId) return false;
    const container = this.elements.find((el) => el.id === containerId);
    if (!container || !isContainerElement(container)) return false;
    const dragged = this.elements.find((el) => el.id === this.draggedElementId);
    if (!dragged) return false;
    if (dragged.id === containerId) return false;
    if (dragged.parentId === containerId) return false;
    if (isContainerElement(dragged)) {
      const descendants = collectDescendantIds(dragged, this.elements);
      if (descendants.has(containerId)) return false;
    }
    let cursor = container.parentId ? this.elements.find((el) => el.id === container.parentId) : null;
    while (cursor) {
      if (cursor.id === dragged.id) return false;
      cursor = cursor.parentId ? this.elements.find((el) => el.id === cursor.parentId) : null;
    }
    return true;
  }
  deleteElement(id) {
    const index = this.elements.findIndex((b) => b.id === id);
    if (index === -1) return;
    const element = this.elements[index];
    this.elements.splice(index, 1);
    if (isContainerType(element.type) && Array.isArray(element.children)) {
      for (const childId of element.children) {
        const child = this.elements.find((el2) => el2.id === childId);
        if (child) {
          child.parentId = void 0;
          this.syncElementElement(child);
        }
      }
    }
    if (element.parentId) {
      const parent = this.elements.find((el2) => el2.id === element.parentId);
      if (parent) {
        this.removeChildFromContainer(parent, element.id);
        this.applyContainerLayout(parent);
      }
    }
    const el = this.elementElements.get(id);
    el?.remove();
    this.elementElements.delete(id);
    if (this.attributePopover.activeElementId === id) {
      this.attributePopover.close();
    }
    if (this.selectedElementId === id) {
      this.selectedElementId = null;
    }
    this.renderInspector();
    this.refreshExport();
    this.updateStatus();
    this.pushHistory();
    this.renderStructure();
  }
  addChildToContainer(container, childId) {
    if (!Array.isArray(container.children)) container.children = [];
    if (!container.children.includes(childId)) {
      container.children.push(childId);
    }
  }
  removeChildFromContainer(container, childId) {
    if (!container.children) return;
    container.children = container.children.filter((id) => id !== childId);
  }
  assignElementToContainer(elementId, containerId) {
    const element = this.elements.find((el) => el.id === elementId);
    if (!element) return;
    const currentParent = element.parentId ? this.elements.find((el) => el.id === element.parentId) : null;
    let nextParent = null;
    if (containerId) {
      const candidate = this.elements.find((el) => el.id === containerId);
      if (candidate && isContainerElement(candidate)) {
        if (candidate.id === element.id) {
          nextParent = null;
        } else if (isContainerElement(element)) {
          const descendants = collectDescendantIds(element, this.elements);
          if (!descendants.has(candidate.id)) {
            let cursor = candidate.parentId ? this.elements.find((el) => el.id === candidate.parentId) : null;
            let isValid = true;
            while (cursor) {
              if (cursor.id === element.id) {
                isValid = false;
                break;
              }
              cursor = cursor.parentId ? this.elements.find((el) => el.id === cursor.parentId) : null;
            }
            if (isValid) {
              nextParent = candidate;
            }
          }
        } else {
          nextParent = candidate;
        }
      }
    }
    if (containerId && !nextParent) {
      return;
    }
    const resolvedParent = nextParent ?? null;
    const currentId = currentParent && isContainerElement(currentParent) ? currentParent.id : null;
    const nextId = resolvedParent ? resolvedParent.id : null;
    if (currentId === nextId) {
      return;
    }
    if (currentParent && isContainerElement(currentParent)) {
      this.removeChildFromContainer(currentParent, element.id);
      this.applyContainerLayout(currentParent);
    }
    if (nextParent) {
      element.parentId = nextParent.id;
      this.addChildToContainer(nextParent, element.id);
      this.applyContainerLayout(nextParent);
    } else {
      element.parentId = void 0;
    }
    this.syncElementElement(element);
    this.refreshExport();
    this.renderInspector();
    this.updateStatus();
    this.pushHistory();
    this.renderStructure();
  }
  moveChildInContainer(container, childId, offset) {
    if (!isContainerElement(container) || !container.children) return;
    const index = container.children.indexOf(childId);
    if (index === -1) return;
    const nextIndex = clamp(index + offset, 0, container.children.length - 1);
    if (index === nextIndex) return;
    const next = [...container.children];
    const [removed] = next.splice(index, 1);
    next.splice(nextIndex, 0, removed);
    container.children = next;
    this.applyContainerLayout(container);
    this.pushHistory();
  }
  applyContainerLayout(element, options) {
    if (!isContainerElement(element)) return;
    const padding = element.layout.padding;
    const gap = element.layout.gap;
    const align = element.layout.align;
    const children = [];
    const validIds = [];
    for (const id of element.children ?? []) {
      if (id === element.id) continue;
      const child = this.elements.find((el) => el.id === id);
      if (child) {
        children.push(child);
        validIds.push(id);
      }
    }
    element.children = validIds;
    if (!children.length) {
      if (!options?.silent) {
        this.refreshExport();
        this.renderInspector();
      }
      return;
    }
    const innerWidth = Math.max(MIN_ELEMENT_SIZE, element.width - padding * 2);
    const innerHeight = Math.max(MIN_ELEMENT_SIZE, element.height - padding * 2);
    const gapCount = Math.max(0, children.length - 1);
    if (isVerticalContainer(element.type)) {
      const availableHeight = innerHeight - gap * gapCount;
      const slotHeight = Math.max(MIN_ELEMENT_SIZE, Math.floor(availableHeight / children.length));
      let y = element.y + padding;
      for (const child of children) {
        child.parentId = element.id;
        child.height = slotHeight;
        child.y = y;
        let width = innerWidth;
        if (align === "stretch") {
          child.x = element.x + padding;
        } else {
          width = Math.min(child.width, innerWidth);
          if (align === "center") {
            child.x = element.x + padding + Math.round((innerWidth - width) / 2);
          } else if (align === "end") {
            child.x = element.x + padding + (innerWidth - width);
          } else {
            child.x = element.x + padding;
          }
        }
        child.width = width;
        y += slotHeight + gap;
        this.syncElementElement(child);
      }
    } else {
      const availableWidth = innerWidth - gap * gapCount;
      const slotWidth = Math.max(MIN_ELEMENT_SIZE, Math.floor(availableWidth / children.length));
      let x = element.x + padding;
      for (const child of children) {
        child.parentId = element.id;
        child.width = slotWidth;
        child.x = x;
        let height = innerHeight;
        if (align === "stretch") {
          child.y = element.y + padding;
        } else {
          height = Math.min(child.height, innerHeight);
          if (align === "center") {
            child.y = element.y + padding + Math.round((innerHeight - height) / 2);
          } else if (align === "end") {
            child.y = element.y + padding + (innerHeight - height);
          } else {
            child.y = element.y + padding;
          }
        }
        child.height = height;
        x += slotWidth + gap;
        this.syncElementElement(child);
      }
    }
    this.syncElementElement(element);
    if (!options?.silent) {
      this.refreshExport();
      this.renderInspector();
      this.updateStatus();
    }
    this.attributePopover.refresh();
    if (!options?.silent) {
      this.renderStructure();
    }
  }
  ensureContainerDefaults(element) {
    if (!isContainerType(element.type)) return;
    const component = getLayoutElementComponent(element.type);
    if (component?.ensureDefaults) {
      component.ensureDefaults(element);
    } else {
      if (!element.layout) {
        const def = this.findDefinition(element.type);
        if (def?.defaultLayout) {
          element.layout = { ...def.defaultLayout };
        } else {
          element.layout = { gap: 16, padding: 16, align: "stretch" };
        }
      }
      if (!Array.isArray(element.children)) {
        element.children = [];
      }
    }
  }
  beginMove(element, event, onComplete) {
    const startX = event.clientX;
    const startY = event.clientY;
    const originX = element.x;
    const originY = element.y;
    const isContainer = isContainerType(element.type);
    const parent = element.parentId ? this.elements.find((el) => el.id === element.parentId) : null;
    const childOrigins = isContainer ? element.children?.map((id) => {
      const child = this.elements.find((el) => el.id === id);
      return child ? { child, x: child.x, y: child.y } : null;
    }).filter((entry) => !!entry) ?? [] : [];
    const onMove = (ev) => {
      const scale = this.cameraScale || 1;
      const dx = (ev.clientX - startX) / scale;
      const dy = (ev.clientY - startY) / scale;
      const nextX = originX + dx;
      const nextY = originY + dy;
      const maxX = Math.max(0, this.canvasWidth - element.width);
      const maxY = Math.max(0, this.canvasHeight - element.height);
      element.x = clamp(nextX, 0, maxX);
      element.y = clamp(nextY, 0, maxY);
      this.syncElementElement(element);
      if (isContainer) {
        for (const entry of childOrigins) {
          const childMaxX = Math.max(0, this.canvasWidth - entry.child.width);
          const childMaxY = Math.max(0, this.canvasHeight - entry.child.height);
          entry.child.x = clamp(entry.x + dx, 0, childMaxX);
          entry.child.y = clamp(entry.y + dy, 0, childMaxY);
          this.syncElementElement(entry.child);
        }
      }
      this.refreshExport();
      this.renderInspector();
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (isContainer) {
        this.applyContainerLayout(element);
      } else if (parent && isContainerType(parent.type)) {
        this.applyContainerLayout(parent);
      }
      this.pushHistory();
      onComplete?.();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }
  beginResize(element, event, corner, onComplete) {
    const startX = event.clientX;
    const startY = event.clientY;
    const originW = element.width;
    const originH = element.height;
    const isContainer = isContainerType(element.type);
    const parent = element.parentId ? this.elements.find((el) => el.id === element.parentId) : null;
    const originX = element.x;
    const originY = element.y;
    const resizeLeft = corner === "nw" || corner === "sw";
    const resizeTop = corner === "nw" || corner === "ne";
    const onMove = (ev) => {
      const scale = this.cameraScale || 1;
      const dx = (ev.clientX - startX) / scale;
      const dy = (ev.clientY - startY) / scale;
      let nextX = originX;
      let nextY = originY;
      let nextW = originW;
      let nextH = originH;
      if (resizeLeft) {
        const maxLeft = originX + originW - MIN_ELEMENT_SIZE;
        const proposedX = clamp(originX + dx, 0, maxLeft);
        nextX = proposedX;
        nextW = originW + (originX - proposedX);
      } else {
        const maxWidth = Math.max(MIN_ELEMENT_SIZE, this.canvasWidth - originX);
        nextW = clamp(originW + dx, MIN_ELEMENT_SIZE, maxWidth);
      }
      if (resizeTop) {
        const maxTop = originY + originH - MIN_ELEMENT_SIZE;
        const proposedY = clamp(originY + dy, 0, maxTop);
        nextY = proposedY;
        nextH = originH + (originY - proposedY);
      } else {
        const maxHeight = Math.max(MIN_ELEMENT_SIZE, this.canvasHeight - originY);
        nextH = clamp(originH + dy, MIN_ELEMENT_SIZE, maxHeight);
      }
      element.x = nextX;
      element.y = nextY;
      element.width = nextW;
      element.height = nextH;
      this.syncElementElement(element);
      if (isContainer) {
        this.applyContainerLayout(element, { silent: true });
      }
      this.refreshExport();
      this.renderInspector();
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (isContainer) {
        this.applyContainerLayout(element);
      } else if (parent && isContainerType(parent.type)) {
        this.applyContainerLayout(parent);
      }
      this.pushHistory();
      onComplete?.();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }
  resolveInteractionMode(el, event) {
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const margin = Math.min(14, rect.width / 2, rect.height / 2);
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;
    if (offsetX < 0 || offsetY < 0 || offsetX > rect.width || offsetY > rect.height) {
      return null;
    }
    const nearLeft = offsetX <= margin;
    const nearRight = rect.width - offsetX <= margin;
    const nearTop = offsetY <= margin;
    const nearBottom = rect.height - offsetY <= margin;
    if (nearLeft && nearTop) return { type: "resize", corner: "nw" };
    if (nearRight && nearTop) return { type: "resize", corner: "ne" };
    if (nearLeft && nearBottom) return { type: "resize", corner: "sw" };
    if (nearRight && nearBottom) return { type: "resize", corner: "se" };
    if (nearLeft || nearRight || nearTop || nearBottom) return { type: "move" };
    return null;
  }
  promptImportSavedLayout() {
    if (this.isImporting) return;
    const modal = new LayoutPickerModal(this.app, {
      loadLayouts: () => listSavedLayouts(this.app),
      onPick: (layoutId) => {
        void this.importSavedLayout(layoutId);
      }
    });
    modal.open();
  }
  async importSavedLayout(layoutId) {
    if (this.isImporting) return;
    this.isImporting = true;
    this.importBtn?.addClass("is-loading");
    if (this.importBtn) this.importBtn.disabled = true;
    try {
      const layout = await loadSavedLayout(this.app, layoutId);
      if (!layout) {
        new import_obsidian5.Notice("Layout konnte nicht geladen werden");
        return;
      }
      this.applySavedLayout(layout);
      new import_obsidian5.Notice(`Layout \u201E${layout.name}\u201D geladen`);
    } catch (error) {
      console.error("Failed to import saved layout", error);
      new import_obsidian5.Notice("Konnte Layout nicht laden");
    } finally {
      this.sandboxEl.empty();
      this.importBtn?.removeClass("is-loading");
      if (this.importBtn) this.importBtn.disabled = false;
      this.isImporting = false;
    }
  }
  applySavedLayout(layout) {
    this.attributePopover.close();
    this.canvasWidth = layout.canvasWidth;
    this.canvasHeight = layout.canvasHeight;
    this.elements = layout.elements.map(cloneLayoutElement);
    this.selectedElementId = null;
    this.lastSavedLayoutId = layout.id;
    this.lastSavedLayoutName = layout.name;
    this.lastSavedLayoutCreatedAt = layout.createdAt;
    this.lastSavedLayoutUpdatedAt = layout.updatedAt;
    if (this.widthInput) this.widthInput.value = String(this.canvasWidth);
    if (this.heightInput) this.heightInput.value = String(this.canvasHeight);
    this.applyCanvasSize();
    this.centerCamera();
    this.renderElements();
    this.renderInspector();
    this.refreshExport();
    this.updateStatus();
    this.history.reset(this.captureSnapshot());
  }
  nextFrame() {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
  }
};
function generateElementId() {
  return `element-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

// src/css.ts
var LAYOUT_EDITOR_CSS = `
.sm-layout-editor {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 0.75rem 1rem 1.5rem;
}

.sm-elements-heading {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
}

.sm-elements-field {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
}

.sm-elements-field__label {
    font-size: 0.8rem;
    color: var(--text-muted);
}

.sm-elements-field__control {
    display: flex;
    gap: 0.35rem;
    align-items: center;
}

.sm-elements-field--inline .sm-elements-field__control {
    flex-wrap: wrap;
}

.sm-elements-field__description {
    font-size: 0.75rem;
    color: var(--text-muted);
}

.sm-elements-input,
.sm-elements-select,
.sm-elements-textarea {
    width: 100%;
    border: 1px solid var(--background-modifier-border);
    background: var(--background-primary);
    border-radius: 6px;
    padding: 0.35rem 0.5rem;
    font-size: 0.9rem;
    color: inherit;
    transition: border-color 120ms ease, box-shadow 120ms ease;
}

.sm-elements-input:focus,
.sm-elements-select:focus,
.sm-elements-textarea:focus {
    outline: none;
    border-color: var(--interactive-accent);
    box-shadow: 0 0 0 2px var(--interactive-accent, rgba(0, 0, 0, 0.08));
}

.sm-elements-select {
    appearance: none;
    background-image: var(--icon-s-caret-down);
    background-repeat: no-repeat;
    background-position: right 0.5rem center;
    padding-right: 1.75rem;
}

.sm-elements-textarea {
    min-height: 120px;
    resize: vertical;
}

.sm-elements-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    padding: 0.4rem 0.75rem;
    border-radius: 8px;
    border: 1px solid var(--background-modifier-border);
    background: var(--background-secondary);
    color: inherit;
    font-size: 0.9rem;
    cursor: pointer;
    transition: background-color 120ms ease, border-color 120ms ease, color 120ms ease;
    text-decoration: none;
}

.sm-elements-button:hover {
    background: var(--background-modifier-hover);
}

.sm-elements-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.sm-elements-button--primary {
    background: var(--interactive-accent);
    border-color: var(--interactive-accent);
    color: var(--text-on-accent, #ffffff);
}

.sm-elements-button--warning {
    background: var(--color-red);
    border-color: var(--color-red);
    color: var(--text-on-accent, #ffffff);
}

.sm-elements-inline-text {
    font-size: 0.85rem;
    color: var(--text-muted);
}

.sm-elements-status {
    font-size: 0.9rem;
    color: var(--text-muted);
}

.sm-elements-status--info {
    color: var(--interactive-accent);
}

.sm-elements-status--warning {
    color: var(--color-orange);
}

.sm-elements-status--success {
    color: var(--color-green);
}

.sm-elements-meta {
    font-size: 0.8rem;
    color: var(--text-muted);
}

.sm-elements-paragraph {
    margin: 0 0 0.75rem 0;
    font-size: 0.9rem;
    color: inherit;
}

.sm-elements-stack {
    display: flex;
    gap: var(--sm-elements-stack-gap, 0.5rem);
}

.sm-elements-stack--column {
    flex-direction: column;
}

.sm-elements-stack--row {
    flex-direction: row;
    align-items: center;
    flex-wrap: wrap;
}

.sm-le-header {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    align-items: center;
    justify-content: space-between;
}

.sm-le-header h2 {
    margin: 0;
}

.sm-le-controls {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    align-items: flex-end;
}

.sm-le-control {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    min-width: 120px;
}

.sm-le-control--stack {
    min-width: 220px;
}

.sm-le-control label {
    font-size: 0.8rem;
    color: var(--text-muted);
}

.sm-le-size {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
}

.sm-le-add {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
}

.sm-le-add__trigger {
    flex: 1 1 100%;
    justify-content: flex-start;
}

.sm-le-element-picker {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    min-width: 420px;
}

.sm-le-element-picker__search {
    margin-bottom: 0.25rem;
}

.sm-le-element-picker__tree {
    max-height: 320px;
    overflow-y: auto;
    border: 1px solid var(--background-modifier-border);
    border-radius: 12px;
    padding: 0.5rem;
    background: var(--background-secondary);
}

.sm-le-element-picker__empty {
    padding: 1.25rem 0.5rem;
    text-align: center;
}

.sm-elements-tree {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.sm-elements-tree__group {
    border: 1px solid var(--background-modifier-border);
    border-radius: 10px;
    background: var(--background-primary);
    overflow: hidden;
}

.sm-elements-tree__header {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0.45rem 0.6rem;
    cursor: pointer;
    user-select: none;
}

.sm-elements-tree__toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.1rem;
    height: 1.1rem;
    border-radius: 6px;
    background: var(--background-secondary);
    color: var(--text-muted);
    font-size: 0.75rem;
    font-weight: 600;
}

.sm-elements-tree__label {
    font-weight: 600;
    font-size: 0.9rem;
}

.sm-elements-tree__children {
    display: none;
    flex-direction: column;
    gap: 0.25rem;
    border-left: 1px dashed var(--background-modifier-border);
    margin: 0 0 0.4rem 0.85rem;
    padding: 0.35rem 0.5rem 0.35rem 0.75rem;
}

.sm-elements-tree__group.is-expanded > .sm-elements-tree__children {
    display: flex;
}

.sm-elements-tree__item {
    display: block;
}

.sm-elements-tree__item-button {
    width: 100%;
    text-align: left;
    border: none;
    background: transparent;
    padding: 0.4rem 0.5rem;
    border-radius: 6px;
    font-size: 0.9rem;
    cursor: pointer;
    transition: background-color 120ms ease, color 120ms ease;
}

.sm-elements-tree__item-button:hover,
.sm-elements-tree__item-button:focus {
    background: var(--background-modifier-hover);
    outline: none;
}

.sm-elements-tree__item-button:active {
    background: var(--interactive-accent);
    color: var(--text-on-accent, #ffffff);
}

.sm-le-status {
    font-size: 0.9rem;
    color: var(--text-muted);
}

.sm-le-body {
    display: flex;
    align-items: stretch;
    gap: 0.75rem;
    min-height: 520px;
}

.sm-le-panel {
    flex: 0 0 auto;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 12px;
    padding: 0.75rem;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    box-sizing: border-box;
    min-width: 200px;
}

.sm-le-panel h3 {
    margin: 0;
    font-size: 0.95rem;
}

.sm-le-panel__heading {
    margin: 0;
    font-size: 0.95rem;
}

.sm-le-panel--structure {
    flex-basis: 260px;
}

.sm-le-panel--inspector {
    flex-basis: 320px;
}

.sm-le-structure {
    flex: 1;
    overflow-y: auto;
    padding-right: 0.25rem;
}

.sm-le-structure__list {
    list-style: none;
    margin: 0;
    padding: 0;
}

.sm-le-structure__item {
    display: block;
}

.sm-le-structure__item > .sm-le-structure__list {
    margin-left: 0.85rem;
    padding-left: 0.75rem;
    border-left: 1px dashed var(--background-modifier-border);
    margin-top: 0.35rem;
}

.sm-le-structure__entry {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.15rem;
    border: none;
    background: transparent;
    color: inherit;
    text-align: left;
    padding: 0.4rem 0.5rem;
    border-radius: 8px;
    cursor: pointer;
    transition: background-color 120ms ease, color 120ms ease;
}

.sm-le-structure__entry:hover {
    background: var(--background-modifier-hover);
}

.sm-le-structure__entry.is-selected {
    background: var(--interactive-accent);
    color: var(--text-on-accent, #ffffff);
}

.sm-le-structure__entry.is-selected .sm-le-structure__meta {
    color: inherit;
    opacity: 0.85;
}

.sm-le-structure__entry.is-drop-target {
    background: var(--interactive-accent);
    color: var(--text-on-accent, #ffffff);
}

.sm-le-structure__entry.is-drop-target .sm-le-structure__title,
.sm-le-structure__entry.is-drop-target .sm-le-structure__meta {
    color: inherit;
}

.sm-le-structure__entry.is-drop-target .sm-le-structure__meta {
    opacity: 0.85;
}

.sm-le-structure__title {
    font-weight: 600;
    line-height: 1.2;
}

.sm-le-structure__meta {
    font-size: 0.75rem;
    color: var(--text-muted);
    line-height: 1.2;
}

.sm-le-structure__entry.is-draggable {
    cursor: grab;
}

.sm-le-structure__entry.is-draggable:active {
    cursor: grabbing;
}

.sm-le-structure__root-drop {
    font-size: 0.75rem;
    color: var(--text-muted);
    padding: 0.35rem 0.5rem;
    border: 1px dashed var(--background-modifier-border);
    border-radius: 8px;
    margin-bottom: 0.75rem;
    text-align: center;
    background: rgba(0, 0, 0, 0.02);
    transition: background-color 120ms ease, color 120ms ease, border-color 120ms ease;
}

.sm-le-structure__root-drop.is-active {
    background: var(--interactive-accent);
    color: var(--text-on-accent, #ffffff);
    border-color: var(--interactive-accent);
}

.sm-le-resizer {
    flex: 0 0 6px;
    border-radius: 999px;
    background: var(--background-modifier-border);
    cursor: col-resize;
    align-self: stretch;
    transition: background-color 120ms ease;
}

.sm-le-resizer:hover,
.sm-le-resizer.is-active {
    background: var(--interactive-accent);
}

.sm-le-stage {
    flex: 1 1 auto;
    min-width: 320px;
    display: flex;
    align-items: stretch;
    justify-content: stretch;
}

.sm-le-stage__viewport {
    position: relative;
    flex: 1;
    border: 1px solid var(--background-modifier-border);
    border-radius: 12px;
    overflow: hidden;
    background: var(--background-secondary);
    min-height: 520px;
    cursor: grab;
}

.sm-le-stage__viewport::before {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    background-image:
        linear-gradient(
            0deg,
            rgba(0, 0, 0, 0.035) 1px,
            transparent 1px
        ),
        linear-gradient(
            90deg,
            rgba(0, 0, 0, 0.035) 1px,
            transparent 1px
        );
    background-size: 40px 40px;
}

.sm-le-stage__viewport.is-panning {
    cursor: grabbing;
}

.sm-le-stage__camera {
    position: absolute;
    top: 0;
    left: 0;
    transform-origin: top left;
}

.sm-le-stage__zoom {
    transform-origin: top left;
}

.sm-le-canvas {
    position: relative;
    border: 1px dashed var(--background-modifier-border);
    background: var(--background-secondary);
    border-radius: 12px;
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.05);
    overflow: hidden;
}

.sm-le-box {
    position: absolute;
    display: flex;
    align-items: stretch;
    justify-content: stretch;
    border: 1px solid transparent;
    border-radius: 12px;
    cursor: default;
    transition: border-color 120ms ease, box-shadow 120ms ease;
}

.sm-le-box:hover {
    border-color: var(--background-modifier-border);
}

.sm-le-box.is-container {
    border-style: dashed;
    border-color: color-mix(in srgb, var(--background-modifier-border) 70%, transparent);
}

.sm-le-box.is-selected {
    border-color: var(--interactive-accent);
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.04), 0 0 0 4px rgba(56, 189, 248, 0.18);
}

.sm-le-box.is-selected.is-container {
    border-color: var(--interactive-accent);
}

.sm-le-box.is-interacting {
    cursor: grabbing;
}

.sm-le-box__content {
    flex: 1;
    display: flex;
    align-items: stretch;
    justify-content: stretch;
    padding: 0;
}

.sm-le-preview {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.15rem;
    box-sizing: border-box;
}

.sm-le-preview--view-container {
    flex: 1;
}

.sm-view-container {
    position: relative;
    display: flex;
    align-items: stretch;
    justify-content: stretch;
    flex: 1;
    border-radius: 12px;
    border: 1px solid var(--background-modifier-border);
    background: var(--background-primary);
    overflow: hidden;
}

.sm-view-container--design {
    background: linear-gradient(
            135deg,
            color-mix(in srgb, var(--background-secondary) 78%, transparent) 0%,
            color-mix(in srgb, var(--background-secondary) 88%, transparent) 100%
        );
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.05);
}

.sm-view-container__viewport {
    position: relative;
    flex: 1;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    cursor: grab;
    touch-action: none;
    background: color-mix(in srgb, var(--background-secondary) 92%, transparent);
}

.sm-view-container__content {
    width: 100%;
    height: 100%;
    transform-origin: top left;
}

.sm-view-container__surface {
    position: relative;
    width: 960px;
    height: 640px;
    border-radius: 18px;
    background: color-mix(in srgb, var(--background-primary) 92%, transparent);
    border: 1px solid color-mix(in srgb, var(--background-modifier-border) 80%, transparent);
    box-shadow: 0 18px 45px rgba(15, 23, 42, 0.14);
    overflow: hidden;
}

.sm-view-container__surface-grid {
    position: absolute;
    inset: 0;
    background-image:
        linear-gradient(0deg, rgba(148, 163, 184, 0.08) 1px, transparent 1px),
        linear-gradient(90deg, rgba(148, 163, 184, 0.08) 1px, transparent 1px);
    background-size: 48px 48px;
    pointer-events: none;
}

.sm-view-container__surface-info {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    align-items: center;
    text-align: center;
    padding: 0.75rem 1rem;
    border-radius: 12px;
    background: rgba(15, 23, 42, 0.08);
    color: color-mix(in srgb, var(--text-muted) 88%, transparent);
    backdrop-filter: blur(6px);
}

.sm-view-container__surface-label {
    font-weight: 600;
    color: var(--text-normal);
}

.sm-view-container__surface-id {
    font-size: 0.85rem;
    color: color-mix(in srgb, var(--text-muted) 90%, transparent);
}

.sm-view-container__overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 1.5rem;
    background: linear-gradient(180deg, rgba(15, 23, 42, 0.45), rgba(15, 23, 42, 0.65));
    color: white;
    opacity: 0;
    pointer-events: none;
    transition: opacity 150ms ease;
}

.sm-view-container__overlay.is-visible {
    opacity: 1;
    pointer-events: auto;
}

.sm-view-container__overlay-title {
    font-weight: 600;
    font-size: 1.1rem;
}

.sm-view-container__overlay-subtitle {
    font-size: 0.85rem;
    opacity: 0.8;
}

.sm-le-preview__headline {
    flex: 1;
    display: flex;
    align-items: stretch;
    justify-content: stretch;
}

.sm-le-preview__headline-inner {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 0.4rem;
    width: 100%;
    height: 100%;
}

.sm-le-preview__headline-text {
    width: 100%;
    min-height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    line-height: 1.1;
    font-weight: 600;
    word-break: break-word;
}

.sm-le-preview__headline-text.sm-le-inline-edit:empty::before {
    width: 100%;
    text-align: center;
}

.sm-le-preview__text-block,
.sm-le-preview__field,
.sm-le-preview__separator,
.sm-le-preview__container-header {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.sm-le-preview__container {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    padding: 0.35rem;
    border-radius: 8px;
    background: transparent;
    border: 1px dashed color-mix(in srgb, var(--background-modifier-border) 65%, transparent);
}

.sm-le-preview__container-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    padding: 0.25rem;
    border-radius: 6px;
    min-height: 48px;
}

.sm-le-preview__container-placeholder {
    font-size: 0.75rem;
    color: var(--text-muted);
    text-align: center;
    padding: 0.25rem 0;
}

.sm-le-preview__text {
    font-size: 1rem;
    line-height: 1.4;
}

.sm-le-preview__subtext {
    font-size: 0.85rem;
    color: var(--text-muted);
    line-height: 1.4;
}

.sm-le-preview__label {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-muted);
}

.sm-le-preview__meta {
    font-size: 0.7rem;
    color: var(--text-muted);
    display: flex;
    flex-wrap: wrap;
    gap: 0.2rem;
}

.sm-le-preview__input,
.sm-le-preview__textarea,
.sm-le-preview__select {
    width: 100%;
    border-radius: 4px;
    border: 1px solid var(--background-modifier-border);
    padding: 0.3rem 0.4rem;
    background: var(--background-primary);
    font: inherit;
    color: inherit;
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.08);
}

.sm-le-preview__textarea {
    resize: vertical;
    min-height: 80px;
}

.sm-le-preview__input-only {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: stretch;
    padding: 0.2rem;
}

.sm-le-preview__input-only .sm-le-preview__input {
    height: 100%;
}

.sm-le-inline-edit {
    display: inline-block;
    padding: 0.05rem 0.15rem;
    border-radius: 4px;
    cursor: text;
    transition: box-shadow 120ms ease, background 120ms ease;
    min-width: 0.6rem;
}

.sm-le-inline-edit--block {
    display: block;
}

.sm-le-inline-edit--multiline {
    min-height: 2.2rem;
    white-space: pre-wrap;
}

.sm-le-inline-edit:focus {
    outline: none;
    box-shadow: 0 0 0 1px var(--interactive-accent);
    background: rgba(var(--interactive-accent-rgb), 0.08);
}

.sm-le-inline-edit:empty::before {
    content: attr(data-placeholder);
    color: var(--text-muted);
    pointer-events: none;
}

.sm-le-inline-meta {
    font-size: 0.75rem;
    color: var(--text-muted);
    display: block;
}

.sm-le-inline-options {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
}

.sm-le-inline-options__empty {
    font-size: 0.8rem;
    color: var(--text-muted);
    font-style: italic;
}

.sm-le-inline-option {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    background: var(--background-secondary);
    border-radius: 8px;
    padding: 0.35rem 0.5rem;
}

.sm-le-inline-option__input {
    flex: 1;
    min-width: 0;
    border: 1px solid transparent;
    background: transparent;
    padding: 0.15rem 0.25rem;
    font: inherit;
    color: inherit;
}

.sm-le-inline-option__input:focus {
    outline: none;
    border-color: var(--interactive-accent);
    background: var(--background-primary);
    box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.18);
}

.sm-le-inline-option__remove {
    border: none;
    background: transparent;
    padding: 0.1rem 0.35rem;
    font-size: 0.85rem;
    color: var(--text-muted);
    cursor: pointer;
    border-radius: 6px;
    transition: color 120ms ease, background 120ms ease;
}

.sm-le-inline-option__remove:hover {
    color: var(--text-normal);
    background: rgba(56, 189, 248, 0.12);
}

.sm-le-view-binding-meta {
    margin-top: 0.35rem;
    color: var(--text-muted);
    font-size: 0.85rem;
}

.sm-le-view-binding-empty {
    color: var(--text-muted);
}

.sm-le-inline-add {
    align-self: flex-start;
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
}

.sm-le-inline-add--menu {
    align-self: flex-start;
}

.sm-le-menu {
    position: absolute;
    z-index: 10000;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 10px;
    box-shadow: 0 8px 22px rgba(15, 23, 42, 0.18);
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    padding: 0.3rem;
    min-width: 180px;
}

.sm-le-menu__item {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.15rem;
    border: none;
    background: transparent;
    color: inherit;
    text-align: left;
    padding: 0.45rem 0.55rem;
    border-radius: 8px;
    cursor: pointer;
    font-size: 0.85rem;
    transition: background-color 120ms ease, color 120ms ease;
}

.sm-le-menu__item:hover,
.sm-le-menu__item:focus-visible {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
}

.sm-le-menu__item.is-disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.sm-le-menu__label {
    font-weight: 600;
}

.sm-le-menu__description {
    font-size: 0.75rem;
    color: var(--text-muted);
}

.sm-le-menu__separator {
    height: 1px;
    background: var(--background-modifier-border);
    margin: 0.15rem 0.25rem;
}

.sm-le-preview__divider {
    border: none;
    border-top: 1px solid var(--background-modifier-border);
    margin: 0.25rem 0 0;
}

.sm-le-preview__layout {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
}

.sm-le-inline-control {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    font-size: 0.7rem;
    color: var(--text-muted);
}

.sm-le-inline-number,
.sm-le-inline-select {
    border-radius: 4px;
    border: 1px solid var(--background-modifier-border);
    padding: 0.2rem 0.3rem;
    font: inherit;
    background: var(--background-primary);
    color: inherit;
}

.sm-le-inspector {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    overflow-y: auto;
    padding-right: 0.25rem;
}

.sm-le-modal {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
}

.sm-le-modal__form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.sm-le-modal__field {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
}

.sm-le-modal__field label {
    font-size: 0.75rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-muted);
}

.sm-le-modal__field input {
    font: inherit;
    padding: 0.45rem 0.6rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
}

.sm-le-modal__actions {
    display: flex;
    justify-content: flex-end;
}

.sm-le-modal__actions .mod-cta {
    min-width: 120px;
}

.sm-le-field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.sm-le-field label {
    font-size: 0.7rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-muted);
}

.sm-le-hint {
    font-size: 0.7rem;
    color: var(--text-muted);
    line-height: 1.3;
}

.sm-le-field textarea,
.sm-le-field input {
    width: 100%;
    box-sizing: border-box;
}

.sm-le-field--attributes {
    gap: 0.5rem;
}

.sm-le-field--stack {
    gap: 0.6rem;
}

.sm-le-attributes {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    max-height: 220px;
    overflow-y: auto;
    padding-right: 0.25rem;
}

.sm-le-attributes__group {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.35rem 0.4rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
}

.sm-le-attributes__group-title {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-muted);
}

.sm-le-attributes__option {
    display: flex;
    align-items: center;
    gap: 0.35rem;
}

.sm-le-attributes__option input {
    margin: 0;
}

.sm-le-container-add {
    display: flex;
    gap: 0.35rem;
    align-items: center;
}

.sm-le-container-add select {
    flex: 1;
}

.sm-le-container-add button {
    white-space: nowrap;
}

.sm-le-container-children {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    max-height: 200px;
    overflow-y: auto;
    padding-right: 0.25rem;
}

.sm-le-container-child {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.35rem 0.45rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    background: var(--background-secondary);
}

.sm-le-container-child__label {
    font-size: 0.85rem;
    font-weight: 500;
}

.sm-le-container-child__actions {
    display: flex;
    align-items: center;
    gap: 0.25rem;
}

.sm-le-container-child__actions button {
    padding: 0.1rem 0.4rem;
    font-size: 0.75rem;
}

.sm-le-field--grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.5rem;
    align-items: end;
}

.sm-le-actions {
    display: flex;
    gap: 0.5rem;
    align-items: center;
}

.sm-le-empty {
    color: var(--text-muted);
    font-size: 0.9rem;
}

.sm-le-meta {
    font-size: 0.85rem;
    color: var(--text-muted);
}

.sm-le-attr-popover {
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 12px;
    box-shadow: 0 18px 40px rgba(0, 0, 0, 0.35);
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: 240px;
}

.sm-le-attr-popover__heading {
    font-weight: 600;
    font-size: 0.9rem;
}

.sm-le-attr-popover__hint {
    font-size: 0.75rem;
    color: var(--text-muted);
}

.sm-le-attr-popover__clear {
    align-self: flex-end;
    font-size: 0.75rem;
}

.sm-le-attr-popover__scroll {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-height: 220px;
    overflow-y: auto;
    padding-right: 0.25rem;
}

.sm-le-attr-popover__group {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    padding: 0.35rem 0.45rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
}

.sm-le-attr-popover__group-title {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-muted);
}

.sm-le-attr-popover__option {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.85rem;
}

.sm-le-export {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.sm-le-export__controls {
    display: flex;
    justify-content: flex-end;
}

.sm-le-export__textarea {
    width: 100%;
    box-sizing: border-box;
    font-family: var(--font-monospace);
    min-height: 160px;
}

.sm-le-sandbox {
    position: absolute;
    top: -10000px;
    left: -10000px;
    visibility: hidden;
    pointer-events: none;
}

@media (max-width: 960px) {
    .sm-le-body {
        grid-template-columns: 1fr;
    }

    .sm-le-inspector {
        min-width: 0;
    }
}

.sm-sd {
    position: relative;
    display: inline-block;
    width: auto;
    min-width: 0;
}

.sm-sd__input {
    width: 100%;
}

.sm-sd__menu {
    position: absolute;
    left: 0;
    right: 0;
    top: calc(100% + 4px);
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    padding: 0.25rem;
    display: none;
    max-height: 240px;
    overflow: auto;
    z-index: 1000;
}

.sm-sd.is-open .sm-sd__menu {
    display: block;
}

.sm-sd__item {
    padding: 0.25rem 0.35rem;
    border-radius: 6px;
    cursor: pointer;
}

.sm-sd__item.is-active,
.sm-sd__item:hover {
    background: var(--background-secondary);
}
`;

// src/seed-layouts.ts
var SEED_LAYOUT_ID = "layout-editor-default";
var SEED_LAYOUT_NAME = "Layout Editor \u2013 Kreaturenvorlage";
var seedElements = [
  {
    id: "el-title",
    type: "label",
    x: 48,
    y: 48,
    width: 864,
    height: 120,
    label: "Kreaturen\xFCbersicht",
    description: "",
    attributes: []
  },
  {
    id: "el-meta",
    type: "hbox-container",
    x: 48,
    y: 200,
    width: 864,
    height: 200,
    label: "Grunddaten",
    description: "",
    attributes: [],
    layout: { gap: 16, padding: 16, align: "stretch" },
    children: ["el-name", "el-size", "el-type", "el-alignment"]
  },
  {
    id: "el-name",
    type: "text-input",
    x: 64,
    y: 216,
    width: 196,
    height: 168,
    label: "Name",
    placeholder: "Kreaturennamen eingeben\u2026",
    attributes: ["name"],
    parentId: "el-meta"
  },
  {
    id: "el-size",
    type: "dropdown",
    x: 276,
    y: 216,
    width: 196,
    height: 168,
    label: "Gr\xF6\xDFe",
    placeholder: "Gr\xF6\xDFe w\xE4hlen\u2026",
    options: ["Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan"],
    attributes: ["size"],
    parentId: "el-meta"
  },
  {
    id: "el-type",
    type: "dropdown",
    x: 488,
    y: 216,
    width: 196,
    height: 168,
    label: "Typ",
    placeholder: "Typ w\xE4hlen\u2026",
    options: [
      "Aberration",
      "Beast",
      "Celestial",
      "Construct",
      "Dragon",
      "Elemental",
      "Fey",
      "Fiend",
      "Giant",
      "Humanoid",
      "Monstrosity",
      "Ooze",
      "Plant",
      "Undead"
    ],
    attributes: ["type"],
    parentId: "el-meta"
  },
  {
    id: "el-alignment",
    type: "dropdown",
    x: 700,
    y: 216,
    width: 196,
    height: 168,
    label: "Gesinnung",
    placeholder: "Gesinnung w\xE4hlen\u2026",
    options: [
      "Lawful Good",
      "Neutral Good",
      "Chaotic Good",
      "Lawful Neutral",
      "True Neutral",
      "Chaotic Neutral",
      "Lawful Evil",
      "Neutral Evil",
      "Chaotic Evil"
    ],
    attributes: ["alignment"],
    parentId: "el-meta"
  },
  {
    id: "el-ability-heading",
    type: "label",
    x: 48,
    y: 420,
    width: 864,
    height: 80,
    label: "Attribute",
    description: "",
    attributes: []
  },
  {
    id: "el-abilities",
    type: "hbox-container",
    x: 48,
    y: 520,
    width: 864,
    height: 180,
    label: "Ability Scores",
    description: "",
    attributes: [],
    layout: { gap: 16, padding: 16, align: "stretch" },
    children: ["el-str", "el-dex", "el-con", "el-int", "el-wis", "el-cha"]
  },
  {
    id: "el-str",
    type: "text-input",
    x: 64,
    y: 536,
    width: 125,
    height: 148,
    label: "STR",
    placeholder: "10",
    attributes: ["str"],
    parentId: "el-abilities"
  },
  {
    id: "el-dex",
    type: "text-input",
    x: 205,
    y: 536,
    width: 125,
    height: 148,
    label: "DEX",
    placeholder: "10",
    attributes: ["dex"],
    parentId: "el-abilities"
  },
  {
    id: "el-con",
    type: "text-input",
    x: 346,
    y: 536,
    width: 125,
    height: 148,
    label: "CON",
    placeholder: "10",
    attributes: ["con"],
    parentId: "el-abilities"
  },
  {
    id: "el-int",
    type: "text-input",
    x: 487,
    y: 536,
    width: 125,
    height: 148,
    label: "INT",
    placeholder: "10",
    attributes: ["int"],
    parentId: "el-abilities"
  },
  {
    id: "el-wis",
    type: "text-input",
    x: 628,
    y: 536,
    width: 125,
    height: 148,
    label: "WIS",
    placeholder: "10",
    attributes: ["wis"],
    parentId: "el-abilities"
  },
  {
    id: "el-cha",
    type: "text-input",
    x: 769,
    y: 536,
    width: 125,
    height: 148,
    label: "CHA",
    placeholder: "10",
    attributes: ["cha"],
    parentId: "el-abilities"
  },
  {
    id: "el-stats-heading",
    type: "label",
    x: 48,
    y: 720,
    width: 864,
    height: 80,
    label: "Kampfwerte",
    description: "",
    attributes: []
  },
  {
    id: "el-stats",
    type: "hbox-container",
    x: 48,
    y: 820,
    width: 864,
    height: 180,
    label: "Statistiken",
    description: "",
    attributes: [],
    layout: { gap: 16, padding: 16, align: "stretch" },
    children: ["el-ac", "el-hp", "el-speed", "el-initiative"]
  },
  {
    id: "el-ac",
    type: "text-input",
    x: 64,
    y: 836,
    width: 196,
    height: 148,
    label: "R\xFCstungsklasse",
    placeholder: "AC",
    attributes: ["ac"],
    parentId: "el-stats"
  },
  {
    id: "el-hp",
    type: "text-input",
    x: 276,
    y: 836,
    width: 196,
    height: 148,
    label: "Trefferpunkte",
    placeholder: "HP",
    attributes: ["hp"],
    parentId: "el-stats"
  },
  {
    id: "el-speed",
    type: "text-input",
    x: 488,
    y: 836,
    width: 196,
    height: 148,
    label: "Geschwindigkeit",
    placeholder: "30 ft.",
    attributes: ["speed"],
    parentId: "el-stats"
  },
  {
    id: "el-initiative",
    type: "text-input",
    x: 700,
    y: 836,
    width: 196,
    height: 148,
    label: "Initiative",
    placeholder: "+2",
    attributes: ["initiative"],
    parentId: "el-stats"
  },
  {
    id: "el-senses",
    type: "search-dropdown",
    x: 48,
    y: 1020,
    width: 420,
    height: 120,
    label: "Sinne",
    placeholder: "Sinn hinzuf\xFCgen\u2026",
    options: ["Darkvision", "Blindsight", "Tremorsense", "Truesight", "Passive Perception"],
    attributes: ["senses"]
  },
  {
    id: "el-languages",
    type: "search-dropdown",
    x: 492,
    y: 1020,
    width: 420,
    height: 120,
    label: "Sprachen",
    placeholder: "Sprache hinzuf\xFCgen\u2026",
    options: [
      "Common",
      "Dwarvish",
      "Elvish",
      "Giant",
      "Goblin",
      "Draconic",
      "Infernal",
      "Sylvan"
    ],
    attributes: ["languages"]
  },
  {
    id: "el-divider",
    type: "separator",
    x: 48,
    y: 1168,
    width: 864,
    height: 24,
    label: "",
    attributes: []
  },
  {
    id: "el-traits-heading",
    type: "label",
    x: 48,
    y: 1210,
    width: 864,
    height: 80,
    label: "Eigenschaften",
    description: "",
    attributes: []
  },
  {
    id: "el-traits",
    type: "textarea",
    x: 48,
    y: 1290,
    width: 864,
    height: 220,
    label: "Traits",
    placeholder: "Sonderf\xE4higkeiten und Besonderheiten beschreiben\u2026",
    attributes: ["traits"]
  },
  {
    id: "el-actions-heading",
    type: "label",
    x: 48,
    y: 1530,
    width: 864,
    height: 80,
    label: "Aktionen",
    description: "",
    attributes: []
  },
  {
    id: "el-actions",
    type: "textarea",
    x: 48,
    y: 1610,
    width: 864,
    height: 220,
    label: "Actions",
    placeholder: "Angriffe und Aktionen dokumentieren\u2026",
    attributes: ["actions"]
  }
];
var seedBlueprint = {
  canvasWidth: 960,
  canvasHeight: 1880,
  elements: seedElements
};
async function ensureSeedLayouts(app) {
  try {
    const existing = await loadSavedLayout(app, SEED_LAYOUT_ID);
    if (existing) {
      return;
    }
  } catch (error) {
    console.warn("Layout Editor: konnte Seed-Layout nicht pr\xFCfen", error);
  }
  try {
    await saveLayoutToLibrary(app, {
      ...seedBlueprint,
      name: SEED_LAYOUT_NAME,
      id: SEED_LAYOUT_ID
    });
  } catch (error) {
    console.error("Layout Editor: Seed-Layout konnte nicht gespeichert werden", error);
  }
}

// src/main.ts
var LayoutEditorPlugin = class extends import_obsidian6.Plugin {
  async onload() {
    resetLayoutElementDefinitions(DEFAULT_ELEMENT_DEFINITIONS);
    await ensureSeedLayouts(this.app);
    this.registerView(VIEW_LAYOUT_EDITOR, (leaf) => new LayoutEditorView(leaf));
    this.addRibbonIcon("layout-grid", "Layout Editor \xF6ffnen", () => {
      void this.openView();
    });
    this.addCommand({
      id: "open-layout-editor",
      name: "Layout Editor \xF6ffnen",
      callback: () => this.openView()
    });
    this.injectCss();
    this.api = {
      viewType: VIEW_LAYOUT_EDITOR,
      openView: () => this.openView(),
      registerElementDefinition: registerLayoutElementDefinition,
      unregisterElementDefinition: unregisterLayoutElementDefinition,
      resetElementDefinitions: (definitions) => {
        if (definitions && definitions.length) {
          resetLayoutElementDefinitions(definitions);
        } else {
          resetLayoutElementDefinitions(DEFAULT_ELEMENT_DEFINITIONS);
        }
      },
      getElementDefinitions,
      onDefinitionsChanged: (listener) => onLayoutElementDefinitionsChanged(listener),
      saveLayout: (payload) => saveLayoutToLibrary(this.app, payload),
      listLayouts: () => listSavedLayouts(this.app),
      loadLayout: (id) => loadSavedLayout(this.app, id),
      registerViewBinding,
      unregisterViewBinding,
      resetViewBindings: (definitions) => {
        resetViewBindings(definitions ?? []);
      },
      getViewBindings,
      onViewBindingsChanged: (listener) => onViewBindingsChanged(listener)
    };
  }
  onunload() {
    resetLayoutElementDefinitions(DEFAULT_ELEMENT_DEFINITIONS);
    resetViewBindings();
    this.removeCss();
  }
  getApi() {
    return this.api;
  }
  async openView() {
    const leaf = this.app.workspace.getLeaf(true);
    await leaf.setViewState({ type: VIEW_LAYOUT_EDITOR, active: true });
    this.app.workspace.revealLeaf(leaf);
  }
  injectCss() {
    const style = document.createElement("style");
    style.id = "layout-editor-css";
    style.textContent = LAYOUT_EDITOR_CSS;
    document.head.appendChild(style);
    this.register(() => style.remove());
  }
  removeCss() {
    document.getElementById("layout-editor-css")?.remove();
  }
};
