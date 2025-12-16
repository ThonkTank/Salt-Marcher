// src/app/ipc-commands.ts
// Production command handlers for IPC server
import type { Plugin } from 'obsidian';
import { configurableLogger } from '@services/logging/configurable-logger';
const logger = configurableLogger.forModule('ipc-commands');
import type { IPCServer } from './ipc-server';

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
    logger.debug('Reloading plugin...');

    // @ts-ignore - accessing internal Obsidian API
    await app.plugins.disablePlugin('salt-marcher');
    await new Promise(resolve => setTimeout(resolve, 100));
    // @ts-ignore
    await app.plugins.enablePlugin('salt-marcher');

    logger.debug('Plugin reloaded');
    return { status: 'reloaded' };
  });

  // Edit creature
  server.registerCommand('edit-creature', async (app, args) => {
    const [creatureName] = args;

    logger.debug('Opening creature editor:', creatureName || 'new');

    // Close all existing modals first
    closeAllModals();
    await new Promise(resolve => setTimeout(resolve, 100));

    // Dynamic import to avoid circular dependencies
    const { openLibraryModal } = await import('../workmodes/library/core/library-mode-service-port');

    // Don't await - just fire and forget so the command returns immediately
    openLibraryModal(app, 'creatures', creatureName).catch(err => {
      logger.error('Failed to open creature modal:', err);
    });

    // Wait a bit for the modal to open
    await new Promise(resolve => setTimeout(resolve, 300));

    return { status: 'opened', entity: creatureName || 'new' };
  });

  // Edit spell
  server.registerCommand('edit-spell', async (app, args) => {
    const [spellName] = args;
    if (!spellName) throw new Error('Spell name required');

    logger.debug('Opening spell editor:', spellName);

    // Close all existing modals first
    closeAllModals();
    await new Promise(resolve => setTimeout(resolve, 100));

    const { openLibraryModal } = await import('../workmodes/library/core/library-mode-service-port');

    // Don't await - just fire and forget
    openLibraryModal(app, 'spells', spellName).catch(err => {
      logger.error('Failed to open spell modal:', err);
    });

    await new Promise(resolve => setTimeout(resolve, 300));

    return { status: 'opened', entity: spellName };
  });

  // Edit item
  server.registerCommand('edit-item', async (app, args) => {
    const [itemName] = args;
    if (!itemName) throw new Error('Item name required');

    logger.debug('Opening item editor:', itemName);

    // Close all existing modals first
    closeAllModals();
    await new Promise(resolve => setTimeout(resolve, 100));

    const { openLibraryModal } = await import('../workmodes/library/core/library-mode-service-port');

    // Don't await - just fire and forget
    openLibraryModal(app, 'items', itemName).catch(err => {
      logger.error('Failed to open item modal:', err);
    });

    await new Promise(resolve => setTimeout(resolve, 300));

    return { status: 'opened', entity: itemName };
  });

  // Edit equipment
  server.registerCommand('edit-equipment', async (app, args) => {
    const [equipmentName] = args;
    if (!equipmentName) throw new Error('Equipment name required');

    logger.debug('Opening equipment editor:', equipmentName);

    // Close all existing modals first
    closeAllModals();
    await new Promise(resolve => setTimeout(resolve, 100));

    const { openLibraryModal } = await import('../workmodes/library/core/library-mode-service-port');

    // Don't await - just fire and forget
    openLibraryModal(app, 'equipments', equipmentName).catch(err => {
      logger.error('Failed to open equipment modal:', err);
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

    logger.debug(`Importing ${category} presets (force: ${force})...`);

    // Dynamic import to avoid circular dependencies
    const { importPresetsByCategory } = await import('../../Presets/lib/plugin-presets');

    const result = await importPresetsByCategory(app, category, force);

    logger.debug(`Preset import complete: ${category}`);

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
    logger.debug('Regenerating library indexes...');

    // Dynamic import to avoid circular dependencies
    const { generateAllIndexes } = await import('../workmodes/library/core/index-files');

    await generateAllIndexes(app);

    logger.debug('Index regeneration complete');

    return {
      status: 'regenerated',
      message: 'All library index files regenerated successfully'
    };
  });

  // Performance metrics commands
  server.registerCommand('performance-metrics', async (app) => {
    logger.debug('Fetching performance metrics...');

    const { getPerformanceMetrics } = await import('@services/performance');
    const metrics = getPerformanceMetrics();
    const allMetrics = metrics.dumpMetrics();

    return JSON.stringify(allMetrics);
  });

  server.registerCommand('performance-clear', async (app) => {
    logger.debug('Clearing performance metrics...');

    const { getPerformanceMetrics } = await import('@services/performance');
    const metrics = getPerformanceMetrics();
    metrics.clear();

    return { status: 'cleared', message: 'Performance metrics cleared successfully' };
  });

  // DOM inspection
  server.registerCommand('dom-inspect', async (app, args) => {
    const { handleDOMInspect } = await import('./ipc-server');
    return await handleDOMInspect(app, args);
  });

  // Cartographer: Open map file
  server.registerCommand('cartographer-open', async (app, args) => {
    const [mapPath] = args;
    if (!mapPath) throw new Error('Map path required');

    logger.debug('Opening map in Cartographer:', mapPath);

    // Get the file from the vault
    const file = app.vault.getAbstractFileByPath(mapPath);
    if (!file) {
      throw new Error(`Map file not found: ${mapPath}`);
    }

    // Check if it's a file (not a folder)
    // @ts-ignore - TFile type
    if (file.extension !== 'md') {
      throw new Error(`Not a markdown file: ${mapPath}`);
    }

    // Use the proper openCartographer function to activate Cartographer workmode
    const { openCartographer } = await import('../workmodes/cartographer');
    // @ts-ignore - TFile type
    await openCartographer(app, file);

    // Wait for the view to load
    await new Promise(resolve => setTimeout(resolve, 500));

    logger.debug('Map opened in Cartographer');
    return { status: 'opened', path: mapPath };
  });

  // Cartographer: List all layers
  interface LayerItem {
    index: number;
    id: string;
    label: string;
    visible: boolean;
    opacity: number;
  }

  server.registerCommand('cartographer-layer-list', async (app) => {
    logger.debug('Listing Cartographer layers...');

    const layerItems = document.querySelectorAll('.layer-control-item');
    const layers: LayerItem[] = [];

    layerItems.forEach((item, index) => {
      const checkbox = item.querySelector('input[type="checkbox"]') as HTMLInputElement;
      const slider = item.querySelector('input[type="range"]') as HTMLInputElement;
      const label = item.querySelector('.layer-label');

      if (checkbox && label) {
        layers.push({
          index,
          id: checkbox.dataset.layerId || `layer-${index}`,
          label: label.textContent?.trim() || 'Unknown',
          visible: checkbox.checked,
          opacity: slider ? parseInt(slider.value) : 100
        });
      }
    });

    logger.debug('Found layers:', layers.length);
    return { layers };
  });

  // Cartographer: Toggle layer visibility
  server.registerCommand('cartographer-layer-toggle', async (app, args) => {
    const [layerId, visibleStr] = args;
    if (!layerId) throw new Error('Layer ID required');

    const visible = visibleStr === 'true' || visibleStr === '1';
    logger.debug('Toggling layer:', layerId, 'visible:', visible);

    // Find the checkbox by data-layer-id
    const checkbox = document.querySelector(
      `.layer-control-item input[type="checkbox"][data-layer-id="${layerId}"]`
    ) as HTMLInputElement;

    if (!checkbox) {
      throw new Error(`Layer not found: ${layerId}`);
    }

    // Toggle the checkbox
    if (checkbox.checked !== visible) {
      checkbox.click();
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    logger.debug('Layer toggled:', layerId);
    return { status: 'toggled', layerId, visible };
  });

  // Cartographer: Set layer opacity
  server.registerCommand('cartographer-layer-opacity', async (app, args) => {
    const [layerId, opacityStr] = args;
    if (!layerId) throw new Error('Layer ID required');
    if (!opacityStr) throw new Error('Opacity value required (0-100)');

    const opacity = parseInt(opacityStr);
    if (isNaN(opacity) || opacity < 0 || opacity > 100) {
      throw new Error('Opacity must be a number between 0 and 100');
    }

    logger.debug('Setting layer opacity:', layerId, 'opacity:', opacity);

    // Find the slider by data-layer-id (look for parent item first)
    const item = document.querySelector(
      `.layer-control-item:has(input[data-layer-id="${layerId}"])`
    );

    if (!item) {
      throw new Error(`Layer not found: ${layerId}`);
    }

    const slider = item.querySelector('input[type="range"]') as HTMLInputElement;
    if (!slider) {
      throw new Error(`Opacity slider not found for layer: ${layerId}`);
    }

    // Set the slider value and trigger change event
    slider.value = opacity.toString();
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    slider.dispatchEvent(new Event('change', { bubbles: true }));

    await new Promise(resolve => setTimeout(resolve, 100));

    logger.debug('Layer opacity set:', layerId);
    return { status: 'updated', layerId, opacity };
  });
}
