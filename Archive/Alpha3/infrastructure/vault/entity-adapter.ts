/**
 * Infrastructure - Entity Vault Adapter
 * Implements EntityStoragePort for Obsidian Vault
 *
 * Parses Markdown files with YAML frontmatter containing smType: creature
 */

import type { Vault, TFile, TFolder } from 'obsidian';
import { toEntityId, type EntityId } from '@core/types/common';
import { CreatureDataSchema, type CreatureData } from '@core/schemas/creature';
import { isFolder, isFile } from './shared';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

/** Supported entity types */
export type EntityType = 'creature';

/** Summary info for entity lists (without full data) */
export interface EntitySummary {
  id: EntityId<'entity'>;
  smType: EntityType;
  name: string;
  filePath: string;
}

/** Full creature entity with data */
export interface CreatureEntity extends EntitySummary {
  smType: 'creature';
  data: CreatureData;
}

/** Union of all entity types */
export type Entity = CreatureEntity;

/**
 * Outbound Port for entity persistence
 * Implemented by this adapter
 */
export interface EntityStoragePort {
  scanEntities(): Promise<EntitySummary[]>;
  loadEntity(filePath: string): Promise<Entity | null>;
}

// ═══════════════════════════════════════════════════════════════
// Factory Function
// ═══════════════════════════════════════════════════════════════

/**
 * Create an EntityStoragePort implementation using Obsidian Vault
 */
export function createVaultEntityAdapter(
  vault: Vault,
  basePath = 'Presets'
): EntityStoragePort {
  const creaturesPath = `${basePath}/Creatures`;

  // ─────────────────────────────────────────────────────────────
  // YAML Parsing Helpers
  // ─────────────────────────────────────────────────────────────

  function parseFrontmatter(content: string): Record<string, unknown> | null {
    const trimmed = content.trim();

    if (!trimmed.startsWith('---')) {
      return null;
    }

    const endIndex = trimmed.indexOf('---', 3);
    if (endIndex === -1) {
      return null;
    }

    const yamlContent = trimmed.slice(3, endIndex).trim();

    try {
      return parseYaml(yamlContent);
    } catch (err) {
      console.warn('[EntityAdapter] Failed to parse YAML:', err);
      return null;
    }
  }

  function parseYaml(yaml: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const lines = yaml.split('\n');
    let currentKey: string | null = null;
    let currentArray: unknown[] | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      if (!trimmedLine || trimmedLine.startsWith('#')) {
        continue;
      }

      if (trimmedLine.startsWith('- ') && currentKey && currentArray) {
        currentArray.push(parseYamlValue(trimmedLine.slice(2).trim()));
        continue;
      }

      if (currentArray && currentKey) {
        result[currentKey] = currentArray;
        currentArray = null;
        currentKey = null;
      }

      const colonIndex = trimmedLine.indexOf(':');
      if (colonIndex === -1) continue;

      const key = trimmedLine.slice(0, colonIndex).trim();
      const value = trimmedLine.slice(colonIndex + 1).trim();

      if (value === '' || value === '|' || value === '>') {
        if (i + 1 < lines.length && lines[i + 1].trim().startsWith('-')) {
          currentKey = key;
          currentArray = [];
        }
        continue;
      }

      result[key] = parseYamlValue(value);
    }

    if (currentArray && currentKey) {
      result[currentKey] = currentArray;
    }

    return result;
  }

  function parseYamlValue(value: string): unknown {
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      return value.slice(1, -1);
    }

    if (value === 'true') return true;
    if (value === 'false') return false;
    if (value === 'null') return null;

    if (/^-?\d+(\.\d+)?$/.test(value)) {
      return parseFloat(value);
    }

    return value;
  }

  // ─────────────────────────────────────────────────────────────
  // ID Generation
  // ─────────────────────────────────────────────────────────────

  function filePathToId(filePath: string): EntityId<'entity'> {
    return toEntityId<'entity'>(hashString(filePath));
  }

  function hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }

  // ─────────────────────────────────────────────────────────────
  // Scanning
  // ─────────────────────────────────────────────────────────────

  async function scanFolderRecursive(
    folder: TFolder,
    summaries: EntitySummary[]
  ): Promise<void> {
    for (const child of folder.children) {
      if (isFolder(child)) {
        await scanFolderRecursive(child as TFolder, summaries);
      } else if (isFile(child) && child.path.endsWith('.md')) {
        const summary = await extractSummary(child as TFile);
        if (summary) {
          summaries.push(summary);
        }
      }
    }
  }

  async function extractSummary(file: TFile): Promise<EntitySummary | null> {
    try {
      const content = await vault.read(file);
      const frontmatter = parseFrontmatter(content);

      if (!frontmatter || frontmatter.smType !== 'creature') {
        return null;
      }

      if (!frontmatter.name) {
        console.warn(`[EntityAdapter] Missing name in ${file.path}`);
        return null;
      }

      return {
        id: filePathToId(file.path),
        smType: 'creature',
        name: frontmatter.name as string,
        filePath: file.path,
      };
    } catch {
      return null;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // EntityStoragePort Implementation
  // ─────────────────────────────────────────────────────────────

  async function scanEntities(): Promise<EntitySummary[]> {
    const summaries: EntitySummary[] = [];

    try {
      const folder = vault.getAbstractFileByPath(creaturesPath);
      if (!folder || !isFolder(folder)) {
        console.warn(
          `[EntityAdapter] Creatures folder not found: ${creaturesPath}`
        );
        return summaries;
      }

      await scanFolderRecursive(folder as TFolder, summaries);
    } catch (err) {
      console.warn('[EntityAdapter] Failed to scan entities:', err);
    }

    return summaries;
  }

  async function loadEntity(filePath: string): Promise<Entity | null> {
    try {
      const file = vault.getAbstractFileByPath(filePath);
      if (!file || !isFile(file)) {
        return null;
      }

      const content = await vault.read(file as TFile);
      const frontmatter = parseFrontmatter(content);

      if (!frontmatter || frontmatter.smType !== 'creature') {
        return null;
      }

      const validatedData = CreatureDataSchema.safeParse(frontmatter);
      if (!validatedData.success) {
        console.warn(
          `[EntityAdapter] Invalid creature data in ${filePath}:`,
          validatedData.error.format()
        );
        return null;
      }

      const entity: CreatureEntity = {
        id: filePathToId(filePath),
        smType: 'creature',
        name: validatedData.data.name,
        filePath,
        data: validatedData.data,
      };

      return entity;
    } catch (err) {
      console.warn(`[EntityAdapter] Failed to load entity ${filePath}:`, err);
      return null;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Return Port Implementation
  // ─────────────────────────────────────────────────────────────

  return {
    scanEntities,
    loadEntity,
  };
}
