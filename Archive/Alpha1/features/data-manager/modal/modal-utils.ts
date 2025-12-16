// src/features/data-manager/modal-utils.ts
// Modal-level utility functions for create modal

import type { Setting } from "obsidian";
import type { AnyFieldSpec, CreateSpec } from "../types";

/**
 * Interface for validation controls.
 */
export interface ValidationControls {
  apply: (errors: string[]) => void;
  container: HTMLElement;
}

/**
 * Creates validation controls for a Setting.
 * Shows/hides validation errors for a field.
 */
export function createValidationControls(setting: Setting): ValidationControls {
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

/**
 * Deep clones a value using structuredClone if available, otherwise JSON.parse/stringify.
 */
export function deepClone<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Resolves default values for a draft from spec.
 */
export function resolveDefaults<TDraft extends Record<string, unknown>>(
  spec: CreateSpec<TDraft, unknown>,
  name: string,
): Partial<TDraft> {
  const fromSpec = typeof spec.defaults === "function"
    ? spec.defaults({ presetName: name })
    : spec.defaults;
  return fromSpec ? { ...fromSpec } : {};
}

/**
 * Orders fields based on an optional ID list.
 * If ids is provided, returns fields in that order. Otherwise returns fields as-is.
 */
export function orderFields(fields: AnyFieldSpec[], ids: string[] | undefined): AnyFieldSpec[] {
  if (!ids || ids.length === 0) return fields;
  const lookup = new Map(fields.map((field) => [field.id, field] as const));
  const ordered: AnyFieldSpec[] = [];
  for (const id of ids) {
    const entry = lookup.get(id);
    if (!entry) continue;
    ordered.push(entry);
  }
  return ordered;
}

/**
 * Interface for schema error issues (Zod-like).
 */
export interface SchemaErrorIssue {
  path?: Array<string | number>;
  message?: string;
}

/**
 * Extracts schema issues from an error object (e.g., Zod error).
 */
export function extractSchemaIssues(error: unknown): SchemaErrorIssue[] {
  if (!error || typeof error !== "object") return [];
  const maybeIssues = (error as { issues?: unknown }).issues;
  if (!Array.isArray(maybeIssues)) return [];
  return maybeIssues.filter((issue): issue is SchemaErrorIssue => typeof issue === "object" && issue !== null);
}
