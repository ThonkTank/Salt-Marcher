// src/features/data-manager/field-renderer-registry.ts
// Central registry for field renderers

import type { FieldRegistryEntry, RenderFieldArgs, FieldRenderHandle } from "../../types";

/**
 * Central registry for field renderers.
 * Each field type registers a renderer that can render it.
 */
class FieldRendererRegistry {
  private renderers: FieldRegistryEntry[] = [];

  /**
   * Register a field renderer.
   */
  register(entry: FieldRegistryEntry): void {
    this.renderers.push(entry);
  }

  /**
   * Render a field using the first matching renderer.
   */
  render(args: RenderFieldArgs): FieldRenderHandle & { setErrors?: (errors: string[]) => void; container?: HTMLElement; synchronizer?: any } {
    for (const renderer of this.renderers) {
      if (renderer.supports(args.spec)) {
        return renderer.render(args);
      }
    }

    // Fallback for unsupported types
    const fallback = args.container.createDiv({ cls: "sm-cc-field--unsupported" });
    fallback.createEl("label", { text: args.spec.label });
    fallback.createEl("p", { text: `Unsupported field type: ${args.spec.type}` });
    return { container: fallback };
  }
}

/**
 * Global registry instance.
 */
export const fieldRendererRegistry = new FieldRendererRegistry();
