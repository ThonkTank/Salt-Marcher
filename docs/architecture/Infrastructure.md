# Infrastructure Layer

> **Lies auch:** [Core](Core.md), [Features](Features.md)
> **Wird benoetigt von:** Vault, Rendering

Implementiert Feature-StoragePorts für konkrete externe Systeme.

**Pfad:** `src/infrastructure/`

---

## Persistence Format

**Entscheidung:** Reines JSON für alle Daten.

### Vault-Struktur

```
Vault/
└── SaltMarcher/
    ├── data/                       # EntityRegistry-verwaltete Entities
    │   ├── creature/               # CreatureDefinitions (Templates)
    │   │   └── goblin-warrior.json
    │   ├── character/              # Player Characters
    │   │   └── player-1.json
    │   ├── npc/                    # Benannte persistente NPCs
    │   │   └── gundren-rockseeker.json
    │   ├── faction/
    │   │   └── zhentarim.json
    │   ├── item/
    │   │   └── longsword.json
    │   ├── calendar/               # Kalender-Definitionen
    │   │   └── gregorian.json
    │   ├── quest/
    │   │   └── lost-mines.json
    │   ├── poi/                    # Points of Interest
    │   │   └── phandalin-entrance.json
    │   ├── map/                    # Map-Definitionen
    │   │   └── sword-coast.json
    │   ├── track/                  # Audio-Tracks mit Mood-Tags
    │   │   └── tavern-theme.json
    │   ├── journal/                # Automatische Log-Eintraege
    │   │   └── entry-001.json
    │   └── worldevent/             # Geplante Kalender-Events
    │       └── midwinter-festival.json
    ├── maps/                       # Feature-spezifische Map-Daten
    │   └── sword-coast/
    │       └── tiles.json
    ├── parties/                    # PartyStoragePort
    │   └── heroes-of-phandalin.json
    └── audio/                      # Audio-Dateien
        ├── music/
        │   └── tavern-theme.mp3
        └── ambience/
            └── rain.mp3
```

**Regeln:**
- `data/` = EntityRegistry-verwaltete Entities (ein JSON pro Entity)
- Feature-spezifische Daten in eigenen Verzeichnissen (`maps/`, `parties/`)
- Dateinamen entsprechen der Entity-ID (kebab-case)
- Schema-Validierung via Zod bei jedem Laden
- Keine Markdown-Frontmatter, reines JSON

→ **Entity-Typen:** Siehe [EntityRegistry.md](EntityRegistry.md) fuer vollstaendige Liste

### File-Watcher Integration

> **MVP-Scope:** Kein File-Watcher für MVP. Bei Plugin-Reload werden Daten frisch geladen. File-Watcher ist Komplexität die später hinzugefügt werden kann.

**Post-MVP:** Vault-Dateien können extern geändert werden (Obsidian-Editor, Git-Sync, andere Tools). Der File-Watcher stellt sicher, dass Caches konsistent bleiben.

**Watched Paths:**

| Pfad | Verarbeitung |
|------|--------------|
| `SaltMarcher/data/{entityType}/*.json` | EntityRegistry Cache invalidieren |
| `SaltMarcher/maps/{mapId}/tiles.json` | Map-Tile-Cache invalidieren |

**Implementation:**

```typescript
// In main.ts beim Plugin-Start
this.registerEvent(
  this.app.vault.on('modify', (file: TFile) => {
    if (file.path.startsWith(this.settings.basePath + '/data/')) {
      entityRegistry.invalidateFromPath(file.path);
    }
  })
);

this.registerEvent(
  this.app.vault.on('delete', (file: TFile) => {
    if (file.path.startsWith(this.settings.basePath + '/data/')) {
      entityRegistry.invalidateFromPath(file.path);
    }
  })
);
```

**Verhalten:**

| Event | Reaktion |
|-------|----------|
| File modified | Cache-Entry invalidieren (lazy reload) |
| File deleted | Cache-Entry entfernen |
| File created | Nichts (wird bei naechstem Zugriff geladen) |

→ **Caching Details:** Siehe [EntityRegistry.md](EntityRegistry.md#caching-strategy)

---

## State-Persistenz

### Kategorien

| Kategorie | Beschreibung | Persistenz | Plugin-Reload |
|-----------|--------------|------------|---------------|
| **Persistent** | User-Daten, Entities, Maps | Vault (JSON) | Wiederhergestellt |
| **Session** | UI-State, Brush-Selection, Zoom | Memory | Reset zu Defaults |
| **Resumable** | Aktive Workflows (optional) | Plugin-Data | Optional wiederhergestellt |

### Persistent State

**Speicherort:** Vault (`SaltMarcher/`)

| Daten | StoragePort | Timing |
|-------|-------------|--------|
| Entities (Creatures, Items, NPCs, ...) | EntityRegistry | Sofort bei `save()` |
| Map-Tiles und Map-Daten | MapStoragePort | Sofort bei Aenderung |
| Party-Position und Members | PartyStoragePort | Sofort bei Aenderung |
| Aktuelle Zeit | TimeStoragePort | Sofort bei Aenderung |

**Strategie:** Pessimistic Save-First

```typescript
async updateEntity(id, changes): Promise<Result<void, AppError>> {
  // 1. Erst speichern
  const saveResult = await this.storage.save(id, { ...existing, ...changes });
  if (!isOk(saveResult)) {
    return saveResult;  // State bleibt unveraendert bei Fehler
  }

  // 2. Dann State aendern
  this.state = { ...this.state, entity: { ...existing, ...changes } };

  // 3. UI informieren
  this.eventBus.publish({ type: 'entity:saved', ... });
  return ok(undefined);
}
```

### Session State (nicht persistiert)

| Daten | Feature | Reload-Verhalten |
|-------|---------|------------------|
| Combat-Instanzen | Combat | Reset zu `idle` |
| Aktive Encounter | Encounter | Reset zu `idle` |
| UI-Zoom/Pan | ViewModel | Reset zu Defaults |
| Brush-Selection | Cartographer | Reset zu Defaults |
| Audio-Playback | Audio | Neustart mit Context |

### Resumable State (optional)

**Speicherort:** Plugin-Data (`.obsidian/plugins/salt-marcher/data.json`)

Fuer wichtige Workflows die bei Plugin-Reload nicht verloren gehen sollen:

```typescript
interface ResumableFeature {
  serialize(): ResumableState | null;
  restore(state: ResumableState): boolean;
  readonly resumeEnabled: boolean;
}
```

### Resumable State Schema

Alle Resumable States folgen einem einheitlichen Envelope-Format:

```typescript
interface ResumableStateEnvelope<T> {
  version: number;        // Schema-Version pro Feature (fuer Migration)
  savedAt: number;        // Unix-Timestamp
  featureName: string;    // z.B. "travel", "combat"
  data: T;                // Feature-spezifischer State
}

// Beispiel: Travel-Feature
interface TravelResumableState {
  routeInProgress: HexCoordinate[];
  currentTileIndex: number;
  partyId: string;
}

// Gespeichert als:
{
  version: 1,
  savedAt: 1702745600000,
  featureName: "travel",
  data: {
    routeInProgress: [...],
    currentTileIndex: 3,
    partyId: "party-123"
  }
}
```

**Migration-Strategie (MVP):**
- Bei Version-Mismatch: State verwerfen, Feature startet fresh
- Console-Warning fuer Debugging: `"Resumable state version mismatch for travel: expected 2, got 1. Starting fresh."`
- Keine automatische Migration im MVP

| Feature | Resumable | Prioritaet |
|---------|-----------|------------|
| Travel-Progress | Ja | Mittel |
| Combat-Snapshot | Optional | Niedrig |
| Quest-Progress | Ja (via EntityRegistry) | - |

### Fehlerbehandlung

| Fehler | Strategie |
|--------|-----------|
| Save fehlgeschlagen | State bleibt unveraendert, Error-Notification |
| Load fehlgeschlagen | Fallback auf Default, Warning-Notification |
| Korrupte JSON | Skip mit Warning, nicht gesamtes Feature blockieren |
| Schema-Validierung fehlgeschlagen | Entity nicht laden, Warning an User |

→ **Details:** Siehe [Features.md](Features.md#state-ownership--persistence) und [Error-Handling.md](Error-Handling.md)

---

## Verzeichnis-Struktur

```
src/infrastructure/
├── vault/                    # Alle Vault-Adapter
│   ├── shared.ts             # Gemeinsame Vault-Utilities (JSON parse/serialize)
│   ├── map-adapter.ts
│   ├── time-adapter.ts
│   ├── entity-adapter.ts     # Generischer Adapter für EntityRegistry
│   └── preset-adapter.ts     # Plugin-bundled Presets
└── api/                      # Falls später externe APIs
    └── ...
```

---

## Adapter-Pattern

### Regeln

- Adapter **nur** in `src/infrastructure/`, **niemals** in `src/features/`
- Adapter gruppiert nach Technologie (vault, api, etc.)
- Adapter importieren Feature-StoragePorts und implementieren sie
- Gemeinsame Logik in `shared.ts` der jeweiligen Technologie
- Benennung: `<feature>-adapter.ts`

### Datenfluss

```
Feature → StoragePort → Adapter → Obsidian Vault / External API
```

### Beispiel

```typescript
// infrastructure/vault/map-adapter.ts
import { MapStoragePort } from '@/features/map/types';
import { MapDataSchema } from '@core/schemas/map';

export function createVaultMapAdapter(vault: Vault, basePath: string): MapStoragePort {
  const mapsPath = `${basePath}/maps`;

  return {
    async load(id: MapId): Promise<Result<MapData, AppError>> {
      const filePath = `${mapsPath}/${id}.json`;
      const file = vault.getAbstractFileByPath(filePath);
      if (!file) return err({ code: 'MAP_NOT_FOUND', message: `Map not found: ${id}` });

      const content = await vault.read(file);
      const parseResult = MapDataSchema.safeParse(JSON.parse(content));
      if (!parseResult.success) {
        return err({ code: 'PARSE_FAILED', message: 'Invalid map data', details: parseResult.error });
      }
      return ok(parseResult.data);
    },

    async save(id: MapId, data: MapData): Promise<Result<void, AppError>> {
      const filePath = `${mapsPath}/${id}.json`;
      const content = JSON.stringify(data, null, 2);
      await vault.adapter.write(filePath, content);
      return ok(undefined);
    }
  };
}
```

---

## PresetPort (Plugin-Bundled Data)

Presets sind Plugin-bundled JSON-Dateien für Standarddaten (Creatures, Items, Spells, etc.).

### Build-Prozess

**Entscheidung:** JSON-Import zur Build-Zeit via esbuild

```typescript
// presets/index.ts - Re-exports alle Presets
import goblin from './creatures/goblin.json';
import skeleton from './creatures/skeleton.json';
import forest from './terrains/forest.json';
// ...

export const bundledPresets: BundledPresets = {
  creature: { goblin, skeleton },
  terrain: { forest },
  // ...
};
```

**Struktur im Projekt:**

```
presets/
├── creatures/
│   ├── goblin.json
│   └── skeleton.json
├── terrains/
│   ├── forest.json
│   └── desert.json
├── items/
│   └── longsword.json
└── index.ts          # Re-exports alle Presets
```

**Vorteile:**
- JSON bleibt editierbar (kein Build für Änderungen an Presets nötig)
- esbuild bundled automatisch (keine zusätzliche Konfiguration)
- Type-Safety via Zod-Validierung beim Laden
- Später erweiterbar auf Hybrid (Vault überschreibt Bundled)

### Phase 1: Nur Plugin-Bundled

```typescript
// infrastructure/vault/preset-adapter.ts
interface PresetPort {
  // Lädt aus Plugin-Bundle (readonly)
  get<T extends EntityType>(type: T, id: string): Option<Entity<T>>;
  list<T extends EntityType>(type: T): Entity<T>[];
  search<T extends EntityType>(type: T, query: string): Entity<T>[];
}

export function createPresetAdapter(bundledPresets: BundledPresets): PresetPort {
  return {
    get(type, id) {
      const presets = bundledPresets[type];
      return presets?.[id] ? some(presets[id]) : none;
    },

    list(type) {
      const presets = bundledPresets[type];
      return presets ? Object.values(presets) : [];
    },

    search(type, query) {
      return this.list(type).filter(e => e.name.toLowerCase().includes(query.toLowerCase()));
    }
  };
}
```

### Phase 2: Hybrid (Später)

```typescript
// Resolution: Vault überschreibt Bundled
interface HybridPresetPort extends PresetPort {
  // Vault-Version hat Priorität über Bundled
  getSource<T extends EntityType>(type: T, id: string): 'bundled' | 'vault' | 'none';

  // Export für User-Anpassung
  exportToVault<T extends EntityType>(type: T, id: string): Result<void, AppError>;
}
```

**Vorbereitung für Hybrid:**
- PresetPort als Interface (nicht konkrete Implementation)
- Bundled-Presets in separatem Verzeichnis (`plugin/presets/`)
- ID-basierte Resolution (nicht Pfad-basiert)

---

## Testing

### Pattern: Integration-Tests mit MockVault

```typescript
describe('VaultMapAdapter', () => {
  const basePath = 'SaltMarcher';

  it('should parse JSON map file correctly', async () => {
    // Arrange: Mock Vault mit Testdaten
    const vault = createMockVault({
      'SaltMarcher/maps/test-map.json': JSON.stringify(testMapData)
    });
    const adapter = createVaultMapAdapter(vault, basePath);

    // Act
    const result = await adapter.load('test-map' as MapId);

    // Assert
    expect(isOk(result)).toBe(true);
    expect(unwrap(result).name).toBe('Test Map');
  });

  it('should return error for missing file', async () => {
    const vault = createMockVault({});
    const adapter = createVaultMapAdapter(vault, basePath);

    const result = await adapter.load('non-existent' as MapId);

    expect(isOk(result)).toBe(false);
    expect(unwrapErr(result).code).toBe('MAP_NOT_FOUND');
  });

  it('should return error for invalid JSON', async () => {
    const vault = createMockVault({
      'SaltMarcher/maps/invalid.json': '{ invalid json }'
    });
    const adapter = createVaultMapAdapter(vault, basePath);

    const result = await adapter.load('invalid' as MapId);

    expect(isOk(result)).toBe(false);
    expect(unwrapErr(result).code).toBe('PARSE_FAILED');
  });
});
```

### Test-Utilities

- `createMockVault(files)` - Mock Vault mit vordefinierten Dateien
- Fixtures in `devkit/testing/fixtures/`

---

## Checkliste: Neuer Adapter

- [ ] Feature-StoragePort importieren
- [ ] Adapter in passender Technologie-Gruppe erstellen (`vault/`, `api/`, etc.)
- [ ] Adapter-Factory die StoragePort implementiert
- [ ] Gemeinsame Logik nach `shared.ts` extrahieren
- [ ] In `main.ts` Adapter instanziieren und an Feature übergeben
- [ ] Integration-Tests mit MockVault/MockAPI

---


## Tasks

| # | Status | Domain | Layer | Beschreibung | Prio | MVP? | Deps | Spec | Imp. |
|--:|:------:|--------|-------|--------------|:----:|:----:|------|------|------|
