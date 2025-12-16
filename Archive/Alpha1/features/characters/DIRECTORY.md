# Characters Feature

## Purpose

Character data repository for accessing PC/NPC information across workmodes.

## Architecture Layer

**Features** - Shared systems layer (mid-level)

## Public API

```typescript
// Import from: src/features/characters
import { CharacterRepository, type CharacterData } from "src/features/characters";
```

## Dependencies

- **Obsidian API** - `App`, `TFile` for vault access
- **Adapters** - Vault file reading/parsing

## Usage Example

```typescript
import { CharacterRepository } from "src/features/characters";

const repo = new CharacterRepository(app);

// Load all characters
const characters = await repo.loadAll();

// Find specific character
const gandalf = characters.find(c => c.name === "Gandalf");
```

## Internal Structure

- `character-repository.ts` - Data access and caching
- `index.ts` - Barrel exports
