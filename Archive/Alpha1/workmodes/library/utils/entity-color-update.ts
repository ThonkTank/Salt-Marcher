// src/workmodes/library/utils/entity-color-update.ts
// Utilities for updating entity colors (regions/factions) from Area Brush Tool

import type { App, TFile } from "obsidian";
import { configurableLogger } from '@services/logging/configurable-logger';
const logger = configurableLogger.forModule('library-entity-color');

/**
 * Reads frontmatter from a vault file
 */
async function readFrontmatter(app: App, file: TFile): Promise<Record<string, unknown>> {
  const content = await app.vault.read(file);
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};

  try {
    const yaml = match[1];
    // Simple YAML parsing (use proper parser in production)
    const fm: Record<string, unknown> = {};
    const lines = yaml.split("\n");
    for (const line of lines) {
      const colonIdx = line.indexOf(":");
      if (colonIdx === -1) continue;
      const key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim();

      // Remove quotes if present
      if (value.startsWith('"') && value.endsWith('"')) {
        fm[key] = value.slice(1, -1);
      } else if (value.startsWith("'") && value.endsWith("'")) {
        fm[key] = value.slice(1, -1);
      } else {
        fm[key] = value;
      }
    }
    return fm;
  } catch (err) {
    logger.error("Failed to parse frontmatter", err);
    return {};
  }
}

/**
 * Writes frontmatter to a vault file
 */
async function writeFrontmatter(
  app: App,
  file: TFile,
  frontmatter: Record<string, unknown>,
  body: string
): Promise<void> {
  const fmLines = Object.entries(frontmatter).map(([key, value]) => {
    if (typeof value === "string") {
      // Escape quotes in string values
      const escaped = value.replace(/"/g, '\\"');
      return `${key}: "${escaped}"`;
    }
    return `${key}: ${String(value)}`;
  });

  const newContent = `---\n${fmLines.join("\n")}\n---\n${body}`;
  await app.vault.modify(file, newContent);
}

/**
 * Extracts markdown body from file content (everything after frontmatter)
 */
function extractBody(content: string): string {
  const match = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
  return match ? match[1] : content;
}

/**
 * Updates a region's color in its vault file
 */
export async function updateRegionColor(
  app: App,
  regionName: string,
  color: string
): Promise<boolean> {
  try {
    logger.info(`Updating region color: ${regionName} → ${color}`);

    // Find region file
    const regionPath = `SaltMarcher/Regions/${regionName}.md`;
    const file = app.vault.getAbstractFileByPath(regionPath);

    if (!file || !(file instanceof app.vault.adapter.constructor)) {
      logger.warn(`Region file not found: ${regionPath}`);
      return false;
    }

    // Read current content
    const content = await app.vault.read(file as TFile);
    const frontmatter = await readFrontmatter(app, file as TFile);
    const body = extractBody(content);

    // Update color
    frontmatter.color = color;

    // Write back
    await writeFrontmatter(app, file as TFile, frontmatter, body);
    logger.info(`Region color updated successfully`);
    return true;
  } catch (err) {
    logger.error(`Failed to update region color`, err);
    return false;
  }
}

/**
 * Updates a faction's color in its vault file
 */
export async function updateFactionColor(
  app: App,
  factionName: string,
  color: string
): Promise<boolean> {
  try {
    logger.info(`Updating faction color: ${factionName} → ${color}`);

    // Find faction file
    const factionPath = `SaltMarcher/Factions/${factionName}.md`;
    const file = app.vault.getAbstractFileByPath(factionPath);

    if (!file || !(file instanceof app.vault.adapter.constructor)) {
      logger.warn(`Faction file not found: ${factionPath}`);
      return false;
    }

    // Read current content
    const content = await app.vault.read(file as TFile);
    const frontmatter = await readFrontmatter(app, file as TFile);
    const body = extractBody(content);

    // Update color
    frontmatter.color = color;

    // Write back
    await writeFrontmatter(app, file as TFile, frontmatter, body);
    logger.info(`Faction color updated successfully`);
    return true;
  } catch (err) {
    logger.error(`Failed to update faction color`, err);
    return false;
  }
}

/**
 * Loads a region's color from its vault file
 */
export async function loadRegionColor(
  app: App,
  regionName: string
): Promise<string | null> {
  try {
    const regionPath = `SaltMarcher/Regions/${regionName}.md`;
    const file = app.vault.getAbstractFileByPath(regionPath);

    if (!file || !(file instanceof app.vault.adapter.constructor)) {
      return null;
    }

    const frontmatter = await readFrontmatter(app, file as TFile);
    const color = frontmatter.color;

    if (typeof color === "string" && /^#[0-9a-fA-F]{6}$/.test(color)) {
      return color;
    }

    return "#2196f3"; // Default region color
  } catch (err) {
    logger.error(`Failed to load region color`, err);
    return "#2196f3";
  }
}

/**
 * Loads a faction's color from its vault file
 */
export async function loadFactionColor(
  app: App,
  factionName: string
): Promise<string | null> {
  try {
    const factionPath = `SaltMarcher/Factions/${factionName}.md`;
    const file = app.vault.getAbstractFileByPath(factionPath);

    if (!file || !(file instanceof app.vault.adapter.constructor)) {
      return null;
    }

    const frontmatter = await readFrontmatter(app, file as TFile);
    const color = frontmatter.color;

    if (typeof color === "string" && /^#[0-9a-fA-F]{6}$/.test(color)) {
      return color;
    }

    return "#f44336"; // Default faction color
  } catch (err) {
    logger.error(`Failed to load faction color`, err);
    return "#f44336";
  }
}
