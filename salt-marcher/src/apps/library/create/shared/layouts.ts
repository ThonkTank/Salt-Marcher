// src/apps/library/create/shared/layouts.ts
// Bündelt Builder für Karten- und Grid-Layouts in den Library-Editoren.
import { Setting } from "obsidian";

export type ValidationRunner = () => string[];

export type ValidationRegistrar = (runner: ValidationRunner) => ValidationRunner;

export interface FormCardOptions {
  title: string;
  subtitle?: string;
  registerValidator?: ValidationRegistrar;
}

export interface FormCardHandles {
  card: HTMLElement;
  body: HTMLElement;
  registerValidation: (compute: () => string[]) => ValidationRunner;
}

export function createFormCard(parent: HTMLElement, options: FormCardOptions): FormCardHandles {
  const { title, subtitle, registerValidator } = options;

  const card = parent.createDiv({ cls: "sm-cc-card" });
  const head = card.createDiv({ cls: "sm-cc-card__head" });
  head.createEl("h3", { text: title, cls: "sm-cc-card__title" });
  if (subtitle) head.createEl("p", { text: subtitle, cls: "sm-cc-card__subtitle" });

  const validation = card.createDiv({ cls: "sm-cc-card__validation", attr: { hidden: "" } });
  const validationList = validation.createEl("ul", { cls: "sm-cc-card__validation-list" });

  const applyValidation = (issues: string[]) => {
    const hasIssues = issues.length > 0;
    card.toggleClass("is-invalid", hasIssues);
    if (!hasIssues) {
      validation.setAttribute("hidden", "");
      validation.classList.remove("is-visible");
      validationList.empty();
      return;
    }
    validation.removeAttribute("hidden");
    validation.classList.add("is-visible");
    validationList.empty();
    for (const message of issues) {
      validationList.createEl("li", { text: message });
    }
  };

  const body = card.createDiv({ cls: "sm-cc-card__body" });

  const registerValidation = (compute: () => string[]) => {
    const runner: ValidationRunner = () => {
      const issues = compute();
      applyValidation(issues);
      return issues;
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
