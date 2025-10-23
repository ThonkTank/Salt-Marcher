// src/workmodes/library/core/library-mode-service-port.ts
// Public API for opening library modals from external commands

import { App } from 'obsidian';
import { openCreateModal } from '../../../features/data-manager/modal/open-create-modal';
import { getCreateSpec } from '../registry';
import { listVaultPresets } from '../../../../Presets/lib/vault-preset-loader';
import type { EntityKind } from '../../../../Presets/lib/entity-registry';

/**
 * Open a library modal for creating or editing an entity.
 * @param app - Obsidian App instance
 * @param kind - Entity kind (creature, spell, item, equipment)
 * @param entityName - Name of entity to edit (optional, creates new if not provided)
 */
export async function openLibraryModal(
  app: App,
  kind: EntityKind,
  entityName?: string
): Promise<void> {
  const spec = getCreateSpec(kind);
  if (!spec) {
    throw new Error(`No create spec found for entity kind: ${kind}`);
  }

  let preset: any = undefined;

  // If editing existing entity, load it
  if (entityName) {
    const files = await listVaultPresets(app, kind);

    // Load frontmatter from each file and find matching entity
    for (const file of files) {
      const cache = app.metadataCache.getFileCache(file);
      const fm = cache?.frontmatter;

      // Match by frontmatter name (case-insensitive)
      if (fm?.name && fm.name.toLowerCase() === entityName.toLowerCase()) {
        // Load full data using the spec's loader
        preset = await spec.loader?.fromFrontmatter?.(fm, file) ?? fm;
        break;
      }
    }

    if (!preset) {
      throw new Error(`Entity not found: ${entityName}`);
    }
  }

  await openCreateModal(spec, {
    app,
    preset,
  });
}
