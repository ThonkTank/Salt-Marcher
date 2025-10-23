// src/app/ipc-commands.ts
// Production command handlers for IPC server
import { App, Plugin } from 'obsidian';
import { IPCServer } from './ipc-server';
import { logger } from './plugin-logger';

/**
 * Close all open create modals
 */
function closeAllModals(): void {
  const modals = document.querySelectorAll('.modal-container');
  modals.forEach(modal => {
    const closeButton = modal.querySelector('.modal-close-button') as HTMLElement;
    if (closeButton) {
      closeButton.click();
    }
  });
}

/**
 * Register production IPC commands
 * Dev commands are registered separately in dev-tools/
 */
export function registerIPCCommands(server: IPCServer, plugin: Plugin): void {

  // Reload plugin
  server.registerCommand('reload-plugin', async (app) => {
    logger.log('[IPC-CMD] Reloading plugin...');

    // @ts-ignore - accessing internal Obsidian API
    await app.plugins.disablePlugin('salt-marcher');
    await new Promise(resolve => setTimeout(resolve, 100));
    // @ts-ignore
    await app.plugins.enablePlugin('salt-marcher');

    logger.log('[IPC-CMD] Plugin reloaded');
    return { status: 'reloaded' };
  });

  // Edit creature
  server.registerCommand('edit-creature', async (app, args) => {
    const [creatureName] = args;

    logger.log('[IPC-CMD] Opening creature editor:', creatureName || 'new');

    // Close all existing modals first
    closeAllModals();
    await new Promise(resolve => setTimeout(resolve, 100));

    // Dynamic import to avoid circular dependencies
    const { openLibraryModal } = await import('../workmodes/library/core/library-mode-service-port');

    // Don't await - just fire and forget so the command returns immediately
    openLibraryModal(app, 'creatures', creatureName).catch(err => {
      logger.error('[IPC-CMD] Failed to open creature modal:', err);
    });

    // Wait a bit for the modal to open
    await new Promise(resolve => setTimeout(resolve, 300));

    return { status: 'opened', entity: creatureName || 'new' };
  });

  // Edit spell
  server.registerCommand('edit-spell', async (app, args) => {
    const [spellName] = args;
    if (!spellName) throw new Error('Spell name required');

    logger.log('[IPC-CMD] Opening spell editor:', spellName);

    // Close all existing modals first
    closeAllModals();
    await new Promise(resolve => setTimeout(resolve, 100));

    const { openLibraryModal } = await import('../workmodes/library/core/library-mode-service-port');

    // Don't await - just fire and forget
    openLibraryModal(app, 'spells', spellName).catch(err => {
      logger.error('[IPC-CMD] Failed to open spell modal:', err);
    });

    await new Promise(resolve => setTimeout(resolve, 300));

    return { status: 'opened', entity: spellName };
  });

  // Edit item
  server.registerCommand('edit-item', async (app, args) => {
    const [itemName] = args;
    if (!itemName) throw new Error('Item name required');

    logger.log('[IPC-CMD] Opening item editor:', itemName);

    // Close all existing modals first
    closeAllModals();
    await new Promise(resolve => setTimeout(resolve, 100));

    const { openLibraryModal } = await import('../workmodes/library/core/library-mode-service-port');

    // Don't await - just fire and forget
    openLibraryModal(app, 'items', itemName).catch(err => {
      logger.error('[IPC-CMD] Failed to open item modal:', err);
    });

    await new Promise(resolve => setTimeout(resolve, 300));

    return { status: 'opened', entity: itemName };
  });

  // Edit equipment
  server.registerCommand('edit-equipment', async (app, args) => {
    const [equipmentName] = args;
    if (!equipmentName) throw new Error('Equipment name required');

    logger.log('[IPC-CMD] Opening equipment editor:', equipmentName);

    // Close all existing modals first
    closeAllModals();
    await new Promise(resolve => setTimeout(resolve, 100));

    const { openLibraryModal } = await import('../workmodes/library/core/library-mode-service-port');

    // Don't await - just fire and forget
    openLibraryModal(app, 'equipments', equipmentName).catch(err => {
      logger.error('[IPC-CMD] Failed to open equipment modal:', err);
    });

    await new Promise(resolve => setTimeout(resolve, 300));

    return { status: 'opened', entity: equipmentName };
  });

  // Get logs (return recent log entries)
  server.registerCommand('get-logs', async (app, args) => {
    const lines = parseInt(args[0]) || 50;

    // Read last N lines from CONSOLE_LOG.txt
    const fs = require('fs');
    const path = require('path');
    const logPath = path.join(app.vault.adapter.basePath, 'CONSOLE_LOG.txt');

    try {
      const content = fs.readFileSync(logPath, 'utf-8');
      const allLines = content.split('\n');
      const recentLines = allLines.slice(-lines);
      return { lines: recentLines };
    } catch (error) {
      return { lines: [], error: String(error) };
    }
  });

  // Import presets
  server.registerCommand('import-presets', async (app, args) => {
    const [category, ...flags] = args;
    const force = flags.includes('--force');

    if (!category) {
      throw new Error('Category required. Valid categories: creatures, spells, items, equipment, terrains, regions, calendars, all');
    }

    logger.log(`[IPC-CMD] Importing ${category} presets (force: ${force})...`);

    // Dynamic import to avoid circular dependencies
    const { importPresetsByCategory } = await import('../../Presets/lib/plugin-presets');

    const result = await importPresetsByCategory(app, category, force);

    logger.log(`[IPC-CMD] Preset import complete: ${category}`);

    return {
      status: 'imported',
      category: result.category,
      force,
      message: force
        ? `Re-imported ${category} presets (deleted and recreated existing files)`
        : `Imported ${category} presets (skipped existing files)`
    };
  });

  // Regenerate index files
  server.registerCommand('regenerate-indexes', async (app) => {
    logger.log('[IPC-CMD] Regenerating library indexes...');

    // Dynamic import to avoid circular dependencies
    const { generateAllIndexes } = await import('../workmodes/library/core/index-files');

    await generateAllIndexes(app);

    logger.log('[IPC-CMD] Index regeneration complete');

    return {
      status: 'regenerated',
      message: 'All library index files regenerated successfully'
    };
  });
}
