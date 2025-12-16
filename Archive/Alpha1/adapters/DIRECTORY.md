# Adapters

**Zweck**: Vault I/O abstraction layer providing a unified interface for file system operations.

## Inhalt

| Element | Beschreibung |
|---------|--------------|
| index.ts | Barrel export for adapter types and interfaces |
| mock-vault-adapter.ts | Mock implementation for testing |
| obsidian-vault-adapter.ts | Obsidian Vault API implementation |
| vault-adapter.ts | Adapter interface and core types |
| storage/ | Storage abstraction layer (file operations) |

## Verbindungen

- **Verwendet von**: Features (repositories), Services, Workmodes
- **Abhängig von**: Obsidian API (`App`, `Vault`, `TFile`)

## Architektur-Prinzipien

Adapters bilden die **unterste I/O Schicht**:
- **Abstrahiert Vault API** - Repositories kommunizieren nur mit Adapters
- **Test-Freundlich** - Mock adapter für Unit tests
- **Type-Safe** - Strongly typed file operations
- **Error Handling** - Consistent error patterns

## Adapter Interface

```typescript
export interface VaultAdapter {
  // File reading
  read(path: string): Promise<string>;
  readBinary(path: string): Promise<ArrayBuffer>;

  // File writing
  write(path: string, content: string): Promise<void>;
  writeBinary(path: string, data: ArrayBuffer): Promise<void>;

  // File operations
  exists(path: string): Promise<boolean>;
  delete(path: string): Promise<void>;
  rename(oldPath: string, newPath: string): Promise<void>;

  // Directory operations
  list(dirPath: string): Promise<string[]>;
  createFolder(path: string): Promise<void>;

  // File metadata
  getFile(path: string): Promise<TFile | null>;
  getAllFiles(extension?: string): Promise<TFile[]>;
}
```

## Implementations

### Obsidian Vault Adapter
Production implementation using Obsidian's Vault API:
```typescript
import { ObsidianVaultAdapter } from '@adapters/obsidian-vault-adapter';

const adapter = new ObsidianVaultAdapter(app);
const content = await adapter.read('Maps/world.md');
```

### Mock Vault Adapter
Test implementation with in-memory storage:
```typescript
import { MockVaultAdapter } from '@adapters/mock-vault-adapter';

const adapter = new MockVaultAdapter();
adapter.mockFile('test.md', 'content');
const content = await adapter.read('test.md');
```

## Usage Pattern

**In Repositories:**
```typescript
// Repository takes adapter via dependency injection
export class MapRepository {
  constructor(private adapter: VaultAdapter) {}

  async loadMap(path: string): Promise<MapData> {
    const content = await this.adapter.read(path);
    return parseMapData(content);
  }

  async saveMap(path: string, data: MapData): Promise<void> {
    const content = serializeMapData(data);
    await this.adapter.write(path, content);
  }
}

// Usage in application
const adapter = new ObsidianVaultAdapter(app);
const repository = new MapRepository(adapter);
```

**Benefits:**
- Repository logic ist **testable** (mock adapter)
- Repository ist **unabhängig** von Obsidian API
- Vault API changes isoliert in Adapter

## Path Conventions

Alle Pfade sind **forward-slash relative paths**:
- ✅ `"Maps/world.md"`
- ✅ `"Creatures/goblin.md"`
- ❌ `"/Maps/world.md"` (no leading slash)
- ❌ `"Maps\\world.md"` (no backslashes)

## Error Handling

Adapters werfen standard JavaScript Errors:
```typescript
try {
  const content = await adapter.read('missing.md');
} catch (error) {
  if (error instanceof Error) {
    logger.error('Failed to read file', error);
  }
}
```

Common error cases:
- File not found
- Permission denied
- Invalid path
- Write conflicts

## Testing

Test files: `devkit/testing/unit/adapters/`

Adapter tests fokussieren auf:
- CRUD operations correctness
- Error handling paths
- Path normalization
- Binary file operations

## Import Rules

```typescript
// Import adapter interface
import type { VaultAdapter } from '@adapters';

// Import implementations
import { ObsidianVaultAdapter } from '@adapters/obsidian-vault-adapter';
import { MockVaultAdapter } from '@adapters/mock-vault-adapter';
```

## Future Considerations

Potential extensions:
- Caching layer in adapter
- Transaction support
- Batch operations
- File watching/subscriptions
- Cloud storage adapters
