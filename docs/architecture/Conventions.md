# Conventions

> **Lies auch:** [Features.md](Features.md), [Core.md](Core.md)
> **Wird benoetigt von:** Alle Implementierungen

Allgemeine Konventionen für die SaltMarcher-Entwicklung.

---

## DRY-Regeln

| Verwendung in | Extrahieren nach |
|---------------|------------------|
| 2+ ToolViews | `@shared/` |
| 2+ Features | `features/shared/` |
| Mehrere Layer | `@core/` |

---

## Naming Conventions

### Feature Factories

```typescript
// ✓ Factory-Funktion exportieren
export function createMapOrchestrator(storage: MapStoragePort, eventBus: EventBus): MapFeaturePort

// ✗ Klasse direkt exportieren
export class MapOrchestrator
```

### Index Exports

```typescript
// feature/index.ts - nur public API exportieren
export { createXxxOrchestrator } from './orchestrator';
export type { XxxFeaturePort, XxxStoragePort } from './types';
export type { XxxState, XxxConfig } from './types';
```

### Datei-Benennung

| Typ | Pattern | Beispiel |
|-----|---------|----------|
| Feature Orchestrator | `orchestrator.ts` | `map/orchestrator.ts` |
| Feature Types | `types.ts` | `map/types.ts` |
| Feature Utils | `<name>-utils.ts` | `map/map-utils.ts` |
| Adapter | `<feature>-adapter.ts` | `map-adapter.ts` |

### Event-Typen

Event-Namen folgen einem konsistenten Pattern basierend auf ihrer Kategorie:

| Kategorie | Pattern | Beispiele |
|-----------|---------|-----------|
| **Command** | `namespace:verb-noun-requested` | `map:load-requested`, `travel:start-requested`, `encounter:generate-requested` |
| **Domain** | `namespace:past-participle` | `map:loaded`, `combat:started`, `encounter:generated`, `travel:completed` |
| **State-Sync** | `namespace:state-changed` | `travel:state-changed`, `party:state-changed`, `map:state-changed` |
| **Failure** | `namespace:action-failed` | `map:load-failed`, `encounter:generate-failed`, `travel:failed` |

**Begründung der unterschiedlichen Patterns:**
- **Commands** verwenden Bindestriche (`start-requested`) da sie oft aus mehreren Wörtern bestehen und die `-requested` Endung betonen
- **Domain Events** verwenden Past Participle ohne Bindestriche für Kürze (`started`, `loaded`, `generated`)
- Diese Unterscheidung macht Events auf einen Blick unterscheidbar

```typescript
// Beispiele
'travel:start-requested'  // Command (User will starten)
'travel:started'          // Domain (Travel wurde gestartet)
'travel:state-changed'    // State-Sync (UI-Update)
'travel:failed'           // Failure (Etwas ging schief)
```

---

## CRUD vs Workflow Regel

Entscheidungsbaum für ViewModel → Feature Kommunikation:

```
1. Hat die Operation eine State-Machine?     → JA → WORKFLOW (EventBus)
2. Kann die Operation andere Features beeinflussen?  → JA → WORKFLOW (EventBus)
3. Ist die Operation synchron und atomar?    → JA → CRUD (Direkter Feature-Call)
```

**Formale Definition:**

| Typ | Beschreibung |
|-----|--------------|
| **CRUD** | Isolierte, synchrone, atomare Operationen ohne State-Machine und ohne Auswirkungen auf andere Features |
| **Workflow** | Operationen mit State-Machine ODER Cross-Feature Side-Effects ODER asynchronem Multi-Step-Ablauf |

**Beispiele:**

| Operation | Typ | Grund |
|-----------|-----|-------|
| Terrain malen | CRUD | Isoliert, synchron |
| Entity bearbeiten | CRUD | Isoliert, synchron |
| Entity löschen | Workflow | Kann Referenzen in anderen Entities invalidieren |
| Map laden | Workflow | Invalidiert Travel-State, triggert Weather-Neuberechnung |
| Zeit setzen | Workflow | Beeinflusst Weather, Travel-ETAs |
| Travel starten | Workflow | State-Machine + Cross-Feature |

**Details:** [Application.md](Application.md#viewmodel--feature-kommunikation)

---

## Async-Kommunikation

### Event-Modus Entscheidung

| Frage | Wenn Ja |
|-------|---------|
| Muss der Aufrufer auf ein Ergebnis warten? | `eventBus.request()` |
| Ist es eine Notification/State-Sync? | `eventBus.publish()` |

### Beispiele

```typescript
// Fire-and-forget: UI-Update nach State-Änderung
eventBus.publish(createEvent('travel:state-changed', { status: 'traveling' }));

// Request/Response: Travel wartet auf Encounter
const result = await eventBus.request(
  createEvent('encounter:generate-requested', { position, terrainId }),
  'encounter:generated',
  5000  // Timeout in ms
);
```

**Details:** [EventBus.md#async-patterns](EventBus.md#async-patterns)

---

## Persistence Format

**Standard:** Reines JSON für alle Daten.

```
Vault/SaltMarcher/<entity-type>/<entity-id>.json
```

**Regeln:**
- Dateinamen in kebab-case
- Schema-Validierung via Zod bei jedem Laden
- Keine Markdown-Frontmatter, keine YAML

**Details:** [Infrastructure.md](Infrastructure.md#persistence-format)

---

## Error Handling

### Result Pattern

```typescript
// Immer Result<T, AppError> für fehlbare Operationen
function doSomething(): Result<Data, AppError> {
  if (error) {
    return err({
      code: 'SPECIFIC_ERROR_CODE',
      message: 'Human-readable message',
      details: { /* optional context */ }
    });
  }
  return ok(data);
}
```

### Error Codes

| Kategorie | Pattern | Beispiele |
|-----------|---------|-----------|
| Not Found | `*_NOT_FOUND` | `MAP_NOT_FOUND`, `ENTITY_NOT_FOUND` |
| Invalid | `INVALID_*` | `INVALID_COORDINATE`, `INVALID_STATE` |
| Failed | `*_FAILED` | `SAVE_FAILED`, `PARSE_FAILED` |
| Conflict | `*_CONFLICT` | `VERSION_CONFLICT`, `STATE_CONFLICT` |

### Error Propagation

```typescript
// Fehler weiterleiten
function processMap(id: MapId): Result<ProcessedMap, AppError> {
  const mapResult = this.getMap(id);
  if (!isOk(mapResult)) {
    return mapResult; // Fehler durchreichen
  }

  const map = unwrap(mapResult);
  // ... verarbeiten
}

// Fehler transformieren
function loadAndProcess(id: MapId): Result<ProcessedMap, AppError> {
  const mapResult = this.getMap(id);
  if (!isOk(mapResult)) {
    return err({
      code: 'PROCESSING_FAILED',
      message: 'Could not process map',
      details: { originalError: unwrapErr(mapResult) }
    });
  }
  // ...
}
```

### Error-Recovery-Strategie

**Prinzip:** Graceful Degradation mit User-Notification.

| Fehler-Typ | Strategie |
|------------|-----------|
| Feature-Init schlaegt fehl | Feature disabled, Warnung an User, andere Features laufen weiter |
| StoragePort-Write fehlschlaegt | Retry 1x, dann Error-Notification, In-Memory-State bleibt |
| StoragePort-Read fehlschlaegt | Fallback auf Default-Werte oder leeren State |
| Event-Handler crashed | Error loggen, andere Handler laufen weiter |
| Zod-Validierung schlaegt fehl | Save abgelehnt, Error-Notification mit Details |

**Generelle Prinzipien:**
1. **Graceful Degradation** - Ein Fehler crasht nicht das ganze Plugin
2. **User-Notification** - Fehler werden dem User gezeigt (nicht still verschluckt)
3. **State-Konsistenz** - Bei Write-Fehler bleibt In-Memory-State erhalten
4. **Logging** - Alle Fehler werden geloggt fuer Debugging

**Beispiel-Implementierung:**

```typescript
// Features geben Result zurueck, Caller entscheidet ueber Handling
const result = entityRegistry.save('npc', npc);
if (result.isErr()) {
  if (result.error instanceof ValidationError) {
    notificationService.error(`NPC ungueltig: ${result.error.message}`);
  } else {
    notificationService.error(`NPC konnte nicht gespeichert werden`);
  }
  // State bleibt unveraendert, Operation fehlgeschlagen
}

// Feature-Init mit Graceful Degradation
async function initializeFeatures() {
  for (const feature of features) {
    try {
      await feature.initialize();
    } catch (e) {
      console.error(`Feature ${feature.name} failed to initialize:`, e);
      notificationService.warn(`Feature "${feature.name}" ist deaktiviert`);
      // Andere Features laufen weiter
    }
  }
}

// Erweiterte Notifications mit Title/Duration: show() API nutzen
notificationService.show({
  type: 'error',
  title: 'NPC nicht verfuegbar',
  message: `${npcName} ist bereits tot.`,
  duration: 10000  // Optional: 10s statt Default
});
```

> **Hinweis:** Fuer einfache Meldungen reichen `info()`, `warn()`, `error()`. Fuer Notifications mit separatem Title oder custom Duration: `show()` verwenden. → Details: [Error-Handling.md#notification-service](Error-Handling.md#notification-service)

---

## Plugin Entry Point (`main.ts`)

### Initialisierungs-Reihenfolge

```typescript
class SaltMarcherPlugin extends Plugin {
  async onload() {
    // 1. EventBus erstellen
    const eventBus = createEventBus();

    // 2. Infrastructure Adapter instanziieren
    const mapAdapter = createVaultMapAdapter(this.app.vault);
    const timeAdapter = createVaultTimeAdapter(this.app.vault);

    // 3. Features mit Adaptern erstellen
    const mapFeature = createMapOrchestrator(mapAdapter, eventBus);
    const timeFeature = createTimeOrchestrator(timeAdapter, eventBus);
    const travelFeature = createTravelOrchestrator({
      eventBus,
      mapFeature,
      timeFeature
    });

    // 4. Context Aggregators initialisieren
    const moodContext = createMoodContextAggregator({ eventBus, /* ... */ });

    // 5. Features initialisieren
    await mapFeature.initialize();
    await timeFeature.initialize();
    await travelFeature.initialize();
    moodContext.initialize();

    // 6. ToolView Registrierung via Factory-Funktionen
    const cartographerFactory = createCartographerViewFactory(mapFeature, eventBus);
    this.registerView(VIEW_TYPE_CARTOGRAPHER, cartographerFactory);

    // 7. Ribbon Icons und Command Palette Einträge
    this.addRibbonIcon('map', 'Open Cartographer', () => {
      this.activateView(VIEW_TYPE_CARTOGRAPHER);
    });
  }

  async onunload() {
    // Cleanup in umgekehrter Reihenfolge
    // Resumable State speichern wenn aktiviert
    // Features disposen
  }
}
```

---

## State Listeners Pattern

```typescript
// ViewModel subscriben
const unsubscribe = viewModel.subscribe((state) => {
  this.render(state);
});

// Cleanup
onClose() {
  unsubscribe();
}
```

---

## Import-Reihenfolge

```typescript
// 1. External packages
import { Plugin, WorkspaceLeaf } from 'obsidian';
import { z } from 'zod';

// 2. Core imports
import { Result, ok, err } from '@core/types/result';
import { EventTypes } from '@core/events';
import { hexDistance } from '@core/utils/hex-math';

// 3. Feature imports
import { MapFeaturePort } from '@/features/map';
import { TravelFeaturePort } from '@/features/travel';

// 4. Application imports (relative)
import { CartographerState } from './types';
import { BrushService } from './services/brush';
```

---

## TypeScript Conventions

### Readonly State

```typescript
// State als Readonly zurückgeben
getState(): Readonly<TravelState> {
  return this.state;
}
```

### Strict Null Checks

```typescript
// Option statt null/undefined
function findTile(coord: Coord): Option<Tile>

// Nicht
function findTile(coord: Coord): Tile | null | undefined
```

### Branded Types

```typescript
// Für IDs immer Branded Types
type MapId = EntityId<'map'>;

// Nicht
type MapId = string;
```

---

