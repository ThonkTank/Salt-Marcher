// src/workmodes/library/core/library-mode-service-port.ts
// Public API for opening library modals from external commands

import type { App } from 'obsidian';
import { listVaultPresets } from '../../../../Presets/lib/vault-preset-loader';
import { configurableLogger } from '@services/logging/configurable-logger';
const logger = configurableLogger.forModule('library-service-port');
import { openCreateModal } from '@features/data-manager/modal/open-create-modal';
import { getCreateSpec } from '../registry';
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
    logger.debug(`Found ${files.length} files for ${kind}`);
    logger.debug(`Looking for entity: ${entityName}`);

    // Normalize entity name for matching (remove hyphens/spaces, lowercase)
    const normalizeForMatch = (str: string) =>
      str.toLowerCase().replace(/[-\s]/g, '');
    const normalizedSearchName = normalizeForMatch(entityName);

    // Load frontmatter from each file and find matching entity
    for (const file of files) {
      const cache = app.metadataCache.getFileCache(file);
      const fm = cache?.frontmatter;

      logger.debug(`Checking file: ${file.path}, hasCache: ${!!cache}, hasFrontmatter: ${!!fm}, name: ${fm?.name}`);

      // Match by frontmatter name (case-insensitive, ignoring hyphens/spaces)
      if (fm?.name && normalizeForMatch(fm.name) === normalizedSearchName) {
        logger.debug(`Found match: ${fm.name}`);
        // Load full data using the spec's loader
        preset = await spec.loader?.fromFrontmatter?.(fm, file) ?? fm;
        break;
      }
    }

    if (!preset) {
      logger.error(`Entity not found: ${entityName} (checked ${files.length} files)`);
      throw new Error(`Entity not found: ${entityName}`);
    }
  }

  await openCreateModal(spec, {
    app,
    preset,
  });
}
