#!/usr/bin/env node
// Backup and restore system for vault data

import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEVKIT_ROOT = path.resolve(__dirname, '../..');
const PLUGIN_ROOT = path.dirname(DEVKIT_ROOT);
const VAULT_ROOT = path.resolve(PLUGIN_ROOT, '../../..');
const BACKUP_DIR = path.join(VAULT_ROOT, '.obsidian/plugins/salt-marcher/backups');

// Colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

export class BackupManager {
  constructor() {
    this.backupDir = BACKUP_DIR;
  }

  /**
   * Create a backup of vault data
   */
  async create(name, options = {}) {
    const {
      includePresets = true,
      includeEntities = true,
      compress = true
    } = options;

    // Generate backup ID
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupId = `${timestamp}_${name || 'manual'}`;
    const backupPath = path.join(this.backupDir, backupId);

    console.log(`${colors.blue}Creating backup: ${backupId}${colors.reset}`);

    // Create backup directory
    await fs.mkdir(backupPath, { recursive: true });

    const manifest = {
      id: backupId,
      name,
      created: new Date().toISOString(),
      files: []
    };

    try {
      // Backup Presets
      if (includePresets) {
        console.log(`${colors.dim}Backing up Presets...${colors.reset}`);
        const presetsPath = path.join(PLUGIN_ROOT, 'Presets');
        await this.copyDirectory(presetsPath, path.join(backupPath, 'Presets'));
        manifest.files.push('Presets/');
      }

      // Backup Entities
      if (includeEntities) {
        console.log(`${colors.dim}Backing up SaltMarcher entities...${colors.reset}`);
        const entitiesPath = path.join(VAULT_ROOT, 'SaltMarcher');

        try {
          await this.copyDirectory(entitiesPath, path.join(backupPath, 'SaltMarcher'));
          manifest.files.push('SaltMarcher/');
        } catch (err) {
          console.log(`${colors.yellow}No SaltMarcher entities found${colors.reset}`);
        }
      }

      // Backup configuration files
      console.log(`${colors.dim}Backing up configuration...${colors.reset}`);
      const configFiles = ['.devkitrc.json', '.claude/debug.json'];

      for (const file of configFiles) {
        const srcPath = path.join(PLUGIN_ROOT, file);
        try {
          await fs.copyFile(srcPath, path.join(backupPath, file.replace('/', '_')));
          manifest.files.push(file);
        } catch (err) {
          // File doesn't exist, skip
        }
      }

      // Save manifest
      await fs.writeFile(
        path.join(backupPath, 'manifest.json'),
        JSON.stringify(manifest, null, 2)
      );

      // Compress if requested
      if (compress) {
        console.log(`${colors.dim}Compressing backup...${colors.reset}`);
        await this.compressBackup(backupPath);
      }

      console.log(`${colors.green}✓ Backup created: ${backupId}${colors.reset}`);
      console.log(`${colors.dim}Location: ${backupPath}${colors.reset}`);

      return { success: true, id: backupId, path: backupPath };
    } catch (error) {
      console.log(`${colors.red}✗ Backup failed: ${error.message}${colors.reset}`);
      // Cleanup failed backup
      try {
        await fs.rm(backupPath, { recursive: true, force: true });
      } catch (e) {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  /**
   * List all backups
   */
  async list() {
    try {
      await fs.mkdir(this.backupDir, { recursive: true });
      const entries = await fs.readdir(this.backupDir);

      const backups = [];

      for (const entry of entries) {
        const backupPath = path.join(this.backupDir, entry);
        const stats = await fs.stat(backupPath);

        if (stats.isDirectory()) {
          // Read manifest
          try {
            const manifestPath = path.join(backupPath, 'manifest.json');
            const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));

            backups.push({
              id: entry,
              name: manifest.name,
              created: manifest.created,
              size: await this.getDirectorySize(backupPath),
              path: backupPath
            });
          } catch (err) {
            // No manifest, use directory info
            backups.push({
              id: entry,
              name: 'Unknown',
              created: stats.mtime.toISOString(),
              size: await this.getDirectorySize(backupPath),
              path: backupPath
            });
          }
        } else if (entry.endsWith('.tar.gz')) {
          // Compressed backup
          backups.push({
            id: entry.replace('.tar.gz', ''),
            name: 'Compressed',
            created: stats.mtime.toISOString(),
            size: stats.size,
            path: backupPath,
            compressed: true
          });
        }
      }

      // Sort by date (newest first)
      backups.sort((a, b) => new Date(b.created) - new Date(a.created));

      return backups;
    } catch (err) {
      return [];
    }
  }

  /**
   * Restore from backup
   */
  async restore(backupId, options = {}) {
    const { dryRun = false, force = false } = options;

    const backupPath = path.join(this.backupDir, backupId);

    // Check if backup exists
    try {
      await fs.access(backupPath);
    } catch (err) {
      throw new Error(`Backup not found: ${backupId}`);
    }

    console.log(`${colors.blue}${dryRun ? 'Previewing' : 'Restoring'} backup: ${backupId}${colors.reset}`);

    // Read manifest
    const manifestPath = path.join(backupPath, 'manifest.json');
    let manifest;
    try {
      manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));
    } catch (err) {
      throw new Error('Invalid backup: manifest.json not found');
    }

    console.log(`${colors.dim}Backup created: ${manifest.created}${colors.reset}`);
    console.log(`${colors.dim}Files: ${manifest.files.length}${colors.reset}\n`);

    if (dryRun) {
      console.log(`${colors.cyan}Would restore:${colors.reset}`);
      manifest.files.forEach(file => {
        console.log(`  ${colors.dim}${file}${colors.reset}`);
      });
      return { success: true, dryRun: true };
    }

    // Confirm restore
    if (!force) {
      console.log(`${colors.yellow}⚠ This will overwrite existing files!${colors.reset}`);
      console.log(`${colors.dim}Run with --force to skip this confirmation${colors.reset}`);
      return { success: false, message: 'Restore cancelled (use --force to proceed)' };
    }

    try {
      // Restore Presets
      if (manifest.files.includes('Presets/')) {
        console.log(`${colors.dim}Restoring Presets...${colors.reset}`);
        const srcPath = path.join(backupPath, 'Presets');
        const destPath = path.join(PLUGIN_ROOT, 'Presets');
        await this.copyDirectory(srcPath, destPath);
      }

      // Restore Entities
      if (manifest.files.includes('SaltMarcher/')) {
        console.log(`${colors.dim}Restoring SaltMarcher entities...${colors.reset}`);
        const srcPath = path.join(backupPath, 'SaltMarcher');
        const destPath = path.join(VAULT_ROOT, 'SaltMarcher');
        await this.copyDirectory(srcPath, destPath);
      }

      // Restore config files
      const configFiles = manifest.files.filter(f => !f.endsWith('/'));
      for (const file of configFiles) {
        const srcPath = path.join(backupPath, file.replace('/', '_'));
        const destPath = path.join(PLUGIN_ROOT, file);

        try {
          await fs.mkdir(path.dirname(destPath), { recursive: true });
          await fs.copyFile(srcPath, destPath);
        } catch (err) {
          console.log(`${colors.yellow}⚠ Could not restore ${file}${colors.reset}`);
        }
      }

      console.log(`${colors.green}✓ Backup restored successfully${colors.reset}`);
      return { success: true };
    } catch (error) {
      console.log(`${colors.red}✗ Restore failed: ${error.message}${colors.reset}`);
      throw error;
    }
  }

  /**
   * Delete a backup
   */
  async delete(backupId, options = {}) {
    const { force = false } = options;

    const backupPath = path.join(this.backupDir, backupId);

    // Check if backup exists
    try {
      await fs.access(backupPath);
    } catch (err) {
      throw new Error(`Backup not found: ${backupId}`);
    }

    if (!force) {
      console.log(`${colors.yellow}⚠ This will permanently delete the backup!${colors.reset}`);
      console.log(`${colors.dim}Run with --force to proceed${colors.reset}`);
      return { success: false };
    }

    console.log(`${colors.blue}Deleting backup: ${backupId}${colors.reset}`);

    await fs.rm(backupPath, { recursive: true, force: true });

    console.log(`${colors.green}✓ Backup deleted${colors.reset}`);
    return { success: true };
  }

  /**
   * Copy directory recursively
   */
  async copyDirectory(src, dest) {
    await fs.mkdir(dest, { recursive: true });

    const entries = await fs.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }

  /**
   * Get directory size
   */
  async getDirectorySize(dirPath) {
    let size = 0;

    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        size += await this.getDirectorySize(entryPath);
      } else {
        const stats = await fs.stat(entryPath);
        size += stats.size;
      }
    }

    return size;
  }

  /**
   * Compress backup
   */
  async compressBackup(backupPath) {
    const backupName = path.basename(backupPath);
    const archivePath = `${backupPath}.tar.gz`;

    try {
      await execAsync(`tar -czf "${archivePath}" -C "${this.backupDir}" "${backupName}"`);
      // Remove uncompressed directory
      await fs.rm(backupPath, { recursive: true, force: true });
      return archivePath;
    } catch (err) {
      console.log(`${colors.yellow}⚠ Compression failed: ${err.message}${colors.reset}`);
      return backupPath;
    }
  }

  /**
   * Format size for display
   */
  formatSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  /**
   * Display backup list
   */
  async displayList() {
    const backups = await this.list();

    if (backups.length === 0) {
      console.log(`${colors.yellow}No backups found${colors.reset}`);
      return;
    }

    console.log(`${colors.cyan}Available Backups:${colors.reset}\n`);

    backups.forEach((backup, i) => {
      console.log(`${colors.bright}${i + 1}. ${backup.id}${colors.reset}`);
      console.log(`   Name: ${backup.name}`);
      console.log(`   Created: ${new Date(backup.created).toLocaleString()}`);
      console.log(`   Size: ${this.formatSize(backup.size)}`);
      if (backup.compressed) {
        console.log(`   ${colors.dim}(compressed)${colors.reset}`);
      }
      console.log();
    });
  }
}
