// src/apps/library/create/shared/layouts.ts
// Bündelt Builder für Karten- und Grid-Layouts in den Library-Editoren.
import { Setting } from "obsidian";

export type ValidationRunner = () => string[];

export type ValidationRegistrar = (runner: ValidationRunner) => ValidationRunner;

export type ValidationResult = string[] | { issues: string[]; summary?: string };

export interface FormCardOptions {
  title: string;
  subtitle?: string;
  registerValidator?: ValidationRegistrar;
}

export interface FormCardHandles {
  card: HTMLElement;
  body: HTMLElement;
  registerValidation: (compute: () => ValidationResult) => ValidationRunner;
}

export function createFormCard(parent: HTMLElement, options: FormCardOptions): FormCardHandles {
  const { title, subtitle, registerValidator } = options;

  const card = parent.createDiv({ cls: "sm-cc-card" });
  const head = card.createDiv({ cls: "sm-cc-card__head" });
  const heading = head.createDiv({ cls: "sm-cc-card__heading" });
  heading.createEl("h3", { text: title, cls: "sm-cc-card__title" });
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

  return { card, body, registerValidation };
}

export interface FieldGridOptions {
  variant?: string;
  className?: string | string[];
}

export interface FieldSettingOptions {
  className?: string | string[];
}

export interface FieldGridHandles {
  grid: HTMLElement;
  createSetting(label: string, options?: FieldSettingOptions): Setting;
}

export function createFieldGrid(parent: HTMLElement, options?: FieldGridOptions): FieldGridHandles {
  const classes = ["sm-cc-field-grid"];
  if (options?.variant) classes.push(`sm-cc-field-grid--${options.variant}`);
  if (options?.className) {
    const extras = Array.isArray(options.className) ? options.className : [options.className];
    classes.push(...extras);
  }

  const grid = parent.createDiv({ cls: classes.join(" ") });

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
