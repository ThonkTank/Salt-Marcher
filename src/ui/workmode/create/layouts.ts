// src/ui/workmode/create/layouts.ts
// Bündelt Builder für Karten- und Grid-Layouts in den Workmode-Create-Dialogen.
import { Setting } from "obsidian";
import type { ValidationRegistrar, ValidationResult, ValidationRunner } from "./types";

export interface FormCardOptions {
  title: string;
  subtitle?: string;
  registerValidator?: ValidationRegistrar;
  id?: string;
  headingId?: string;
  role?: string;
}

export interface FormCardHandles {
  card: HTMLElement;
  body: HTMLElement;
  heading: HTMLHeadingElement;
  registerValidation: (compute: () => ValidationResult) => ValidationRunner;
}

export function createFormCard(parent: HTMLElement, options: FormCardOptions): FormCardHandles {
  const { title, subtitle, registerValidator, id, headingId, role } = options;

  const card = parent.createDiv({ cls: "sm-cc-card" });
  if (id) card.id = id;
  const computedHeadingId = headingId ?? (id ? `${id}__title` : undefined);
  card.setAttribute("role", role ?? "region");
  if (computedHeadingId) {
    card.setAttribute("aria-labelledby", computedHeadingId);
  }
  const head = card.createDiv({ cls: "sm-cc-card__head" });
  const heading = head.createDiv({ cls: "sm-cc-card__heading" });
  const headingTitle = heading.createEl("h3", { text: title, cls: "sm-cc-card__title" });
  if (computedHeadingId) headingTitle.id = computedHeadingId;
  const status = heading.createSpan({
    cls: "sm-cc-card__status",
    attr: { hidden: "" },
  });
  if (subtitle) head.createEl("p", { text: subtitle, cls: "sm-cc-card__subtitle" });

  const validation = card.createDiv({ cls: "sm-cc-card__validation", attr: { hidden: "" } });
  const validationList = validation.createEl("ul", { cls: "sm-cc-card__validation-list" });

  const applyValidation = (issues: string[], summary?: string) => {
    const hasIssues = issues.length > 0;
    card.toggleClass("is-invalid", hasIssues);
    if (!hasIssues) {
      validation.setAttribute("hidden", "");
      validation.classList.remove("is-visible");
      validationList.empty();
      status.textContent = "";
      status.setAttribute("hidden", "");
      status.classList.remove("is-active");
      return;
    }
    validation.removeAttribute("hidden");
    validation.classList.add("is-visible");
    validationList.empty();
    for (const message of issues) {
      validationList.createEl("li", { text: message });
    }
    const fallbackSummary = issues.length === 1 ? issues[0] : `${issues.length} Probleme`;
    status.textContent = summary?.trim() || fallbackSummary;
    status.removeAttribute("hidden");
    status.classList.add("is-active");
  };

  const body = card.createDiv({ cls: "sm-cc-card__body" });

  const registerValidation = (compute: () => ValidationResult) => {
    const runner: ValidationRunner = () => {
      const result = compute();
      const normalized = Array.isArray(result)
        ? { issues: result, summary: undefined }
        : result ?? { issues: [], summary: undefined };
      applyValidation(normalized.issues, normalized.summary);
      return normalized.issues;
    };
    return registerValidator ? registerValidator(runner) : runner;
  };

  return { card, body, heading: headingTitle, registerValidation };
}

export interface FieldGridOptions {
  variant?: string;
  className?: string | string[];
  minColumnWidth?: string;
}

export interface FieldSettingOptions {
  className?: string | string[];
}

export interface FieldGridHandles {
  grid: HTMLElement;
  createSetting(label: string, options?: FieldSettingOptions): Setting;
}

function collectClasses(base: string[], extra?: string | string[]): string[] {
  if (!extra) return base;
  const extras = Array.isArray(extra) ? extra : [extra];
  return [...base, ...extras];
}

export function createFieldGrid(parent: HTMLElement, options?: FieldGridOptions): FieldGridHandles {
  const classes = ["sm-cc-field-grid"];
  if (options?.variant) classes.push(`sm-cc-field-grid--${options.variant}`);
  if (options?.className) {
    classes.push(...collectClasses([], options.className));
  }

  const grid = parent.createDiv({ cls: classes.join(" ") });
  if (options?.minColumnWidth) {
    grid.style.gridTemplateColumns = `repeat(auto-fit, minmax(${options.minColumnWidth}, 1fr))`;
  }

  const createSetting = (label: string, settingOptions?: FieldSettingOptions) => {
    const setting = new Setting(grid).setName(label);
    setting.settingEl.addClass("sm-cc-setting");
    const additional = settingOptions?.className;
    if (additional) {
      const extras = Array.isArray(additional) ? additional : [additional];
      setting.settingEl.classList.add(...extras);
    }
    return setting;
  };

  return { grid, createSetting };
}

export interface IrregularGridOptions {
  columns: Array<string>;
  className?: string | string[];
  columnGap?: string;
  rowGap?: string;
  role?: string;
}

export interface IrregularGridHandles {
  grid: HTMLElement;
  createCell(className?: string | string[]): HTMLElement;
}

export function createIrregularGrid(parent: HTMLElement, options: IrregularGridOptions): IrregularGridHandles {
  const grid = parent.createDiv({
    cls: collectClasses(["sm-cc-field-grid", "sm-cc-field-grid--irregular"], options.className).join(" "),
  });
  grid.style.gridTemplateColumns = options.columns.join(" ");
  if (options.columnGap) grid.style.columnGap = options.columnGap;
  if (options.rowGap) grid.style.rowGap = options.rowGap;
  if (options.role) grid.setAttribute("role", options.role);

  const createCell = (className?: string | string[]) => {
    return grid.createDiv({ cls: collectClasses([], className).join(" ") });
  };

  return { grid, createCell };
}

export interface RepeatingGridOptions {
  className?: string | string[];
  itemClassName?: string | string[];
  tag?: keyof HTMLElementTagNameMap;
  role?: string;
}

export interface RepeatingGridHandles {
  grid: HTMLElement;
  createItem(options?: { className?: string | string[]; tag?: keyof HTMLElementTagNameMap }): HTMLElement;
}

export function createRepeatingGrid(parent: HTMLElement, options?: RepeatingGridOptions): RepeatingGridHandles {
  const grid = parent.createDiv({
    cls: collectClasses(["sm-cc-repeating-grid"], options?.className).join(" "),
  });
  if (options?.role) grid.setAttribute("role", options.role);

  const createItem = (itemOptions?: { className?: string | string[]; tag?: keyof HTMLElementTagNameMap }) => {
    const tag = itemOptions?.tag ?? options?.tag ?? "div";
    const itemClasses = collectClasses([], options?.itemClassName);
    const combined = collectClasses(itemClasses, itemOptions?.className).join(" ");
    return grid.createEl(tag, { cls: combined });
  };

  return { grid, createItem };
}
