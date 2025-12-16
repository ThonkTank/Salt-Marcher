// src/features/data-manager/open-create-modal.ts
// Public entry point for the declarative workmode create modal.
import type { App } from "obsidian";
import { CreateModal } from "./modal";
import type {
  CreateSpec,
  OpenCreateModalOptions,
  OpenCreateModalResult,
} from "../types";

function resolveAppInstance(options?: OpenCreateModalOptions): App {
  if (options?.app) return options.app;
  const globalApp = (globalThis as { app?: App }).app;
  if (!globalApp) {
    throw new Error("Obsidian App instance is required to open the create modal");
  }
  return globalApp;
}

export function openCreateModal<
  TDraft extends Record<string, unknown> & { name: string },
  TSerialized,
>(
  spec: CreateSpec<TDraft, TSerialized>,
  options?: OpenCreateModalOptions,
): Promise<OpenCreateModalResult | null> {
  const app = resolveAppInstance(options);

  return new Promise((resolve) => {
    const modal = new CreateModal(app, spec, options, resolve);
    modal.open();
  });
}
