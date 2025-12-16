/**
 * Adapters Module
 *
 * Purpose: Export vault adapters for dependency injection
 * Location: src/adapters/index.ts
 *
 * Available Adapters:
 * - ObsidianVaultAdapter: Production implementation using Obsidian Vault API
 * - MockVaultAdapter: In-memory implementation for testing
 *
 * Usage:
 * ```typescript
 * // Production (Obsidian)
 * import { ObsidianVaultAdapter } from "@/adapters";
 * const vault = new ObsidianVaultAdapter(app.vault, app.metadataCache);
 *
 * // Testing
 * import { MockVaultAdapter } from "@/adapters";
 * const vault = new MockVaultAdapter();
 * ```
 */

export type { VaultAdapter } from "./vault-adapter";
export { VaultAdapterError } from "./vault-adapter";
export { ObsidianVaultAdapter } from "./obsidian-vault-adapter";
export { MockVaultAdapter } from "./mock-vault-adapter";

// Frontmatter parsing
export { parseFrontmatter, serializeFrontmatter } from "./frontmatter-parser";
export type { ParsedFrontmatter } from "./frontmatter-parser";
