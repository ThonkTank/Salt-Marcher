# Error-Handling

> **Lies auch:** [Conventions](Conventions.md), [Core.md](Core.md), [EventBus.md](EventBus.md)
> **Wird benoetigt von:** Alle Implementierungen

Cross-Feature Fehlerbehandlung, Error-Propagation und Logging.

---

## Uebersicht

SaltMarcher verwendet typisierte Fehlerbehandlung mit `Result`-Typen. Fehler werden nicht geworfen, sondern als Werte zurueckgegeben.

```
┌─────────────────────────────────────────────────────────────────┐
│  Layer-spezifische Fehlerbehandlung                             │
├─────────────────────────────────────────────────────────────────┤
│  Application   │ UI-Feedback, User-Notifications                │
│  ──────────────┼───────────────────────────────────────────────  │
│  Features      │ Result<T, FeatureError>, Domain-Validation     │
│  ──────────────┼───────────────────────────────────────────────  │
│  Infrastructure│ Result<T, IOError>, Vault-Operationen          │
│  ──────────────┼───────────────────────────────────────────────  │
│  Core          │ Validierungs-Fehler (Zod), Type-Guards         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Result-Typ

Alle fehlbaren Operationen geben `Result<T, E>` zurueck:

```typescript
// In @core/types/result.ts
type Result<T, E> = Ok<T> | Err<E>;

interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

interface Err<E> {
  readonly ok: false;
  readonly error: E;
}

// Helper-Funktionen
function ok<T>(value: T): Ok<T>;
function err<E>(error: E): Err<E>;
function isOk<T, E>(result: Result<T, E>): result is Ok<T>;
function isErr<T, E>(result: Result<T, E>): result is Err<E>;
```

### Verwendung

```typescript
// Feature-Funktion
function loadMap(mapId: EntityId<'map'>): Result<Map, MapError> {
  const data = storage.read(mapId);
  if (!data.ok) {
    return err({ code: 'MAP_NOT_FOUND', mapId });
  }

  const parsed = mapSchema.safeParse(data.value);
  if (!parsed.success) {
    return err({ code: 'INVALID_MAP_DATA', zodError: parsed.error });
  }

  return ok(parsed.data);
}

// Aufrufer
const result = loadMap('map-123');
if (!result.ok) {
  handleError(result.error);
  return;
}
const map = result.value;
```

---

## Error-Kategorien

### Domain-Errors (Features)

Fachliche Fehler innerhalb eines Features:

```typescript
type MapError =
  | { code: 'MAP_NOT_FOUND'; mapId: string }
  | { code: 'INVALID_MAP_DATA'; zodError: ZodError }
  | { code: 'MAP_LOCKED'; reason: string };

type TravelError =
  | { code: 'NO_ROUTE'; from: HexCoordinate; to: HexCoordinate }
  | { code: 'INVALID_TRANSPORT'; transport: string }
  | { code: 'TRAVEL_IN_PROGRESS' };

type EncounterError =
  | { code: 'NPC_DEAD'; npcId: string; npcName: string }
  | { code: 'NO_CREATURES_AVAILABLE' }
  | { code: 'BUDGET_EXCEEDED'; budget: number; actual: number };
```

### IO-Errors (Infrastructure)

Technische Fehler bei Vault-Operationen:

```typescript
type IOError =
  | { code: 'FILE_NOT_FOUND'; path: string }
  | { code: 'PARSE_ERROR'; path: string; message: string }
  | { code: 'WRITE_FAILED'; path: string; reason: string }
  | { code: 'PERMISSION_DENIED'; path: string };
```

### Validation-Errors (Core)

Schema-Validierungsfehler:

```typescript
type ValidationError = {
  code: 'VALIDATION_FAILED';
  schemaName: string;
  issues: ZodIssue[];
};
```

---

## Error-Propagation

### Innerhalb eines Layers

Fehler werden direkt weitergegeben:

```typescript
// Feature-interne Propagation
function processMap(mapId: string): Result<ProcessedMap, MapError> {
  const loadResult = loadMap(mapId);
  if (!loadResult.ok) return loadResult;  // Direkte Weitergabe

  const validated = validateMap(loadResult.value);
  if (!validated.ok) return validated;

  return ok(transform(validated.value));
}
```

### Zwischen Layers

Fehler werden an Layer-Grenzen transformiert:

```typescript
// Infrastructure → Feature
function mapAdapter(vault: VaultAdapter): MapStoragePort {
  return {
    read(mapId: string): Result<MapData, MapError> {
      const ioResult = vault.readJson(mapId);

      if (!ioResult.ok) {
        // IO-Error → Domain-Error transformieren
        if (ioResult.error.code === 'FILE_NOT_FOUND') {
          return err({ code: 'MAP_NOT_FOUND', mapId });
        }
        if (ioResult.error.code === 'PARSE_ERROR') {
          return err({ code: 'INVALID_MAP_DATA', zodError: parseZodError(ioResult.error) });
        }
        // Unbekannter IO-Error → generischer Fehler
        return err({ code: 'MAP_LOAD_FAILED', details: ioResult.error.message });
      }

      return ok(ioResult.value);
    }
  };
}
```

### Cross-Feature via EventBus

Fehler bei Event-Handling werden via Failed-Events kommuniziert:

```typescript
// Feature publiziert Fehler als Event
eventBus.subscribe('map:load-requested', (event) => {
  const result = loadMap(event.payload.mapId);

  if (result.ok) {
    eventBus.publish('map:loaded', { map: result.value });
  } else {
    eventBus.publish('map:load-failed', {
      mapId: event.payload.mapId,
      error: result.error
    });
  }
});

// ViewModel reagiert auf Fehler-Event
eventBus.subscribe('map:load-failed', (event) => {
  showNotification({
    type: 'error',
    message: formatMapError(event.payload.error)
  });
});
```

---

## Event-Fehlerbehandlung

### Failed-Event Pattern

Fuer jede `*-requested` Operation gibt es ein `*-failed` Event:

| Request-Event | Success-Event | Failed-Event |
|---------------|---------------|--------------|
| `map:load-requested` | `map:loaded` | `map:load-failed` |
| `travel:start-requested` | `travel:started` | `travel:failed` |
| `encounter:generate-requested` | `encounter:generated` | `encounter:generation-failed` |

### Failed-Event Schema

```typescript
interface FailedEvent<E> {
  requestId?: string;        // Korrelation mit Request
  error: E;                  // Typisierter Fehler
  recoverable: boolean;      // Kann User retry?
  userMessage?: string;      // Optionale User-facing Nachricht
}
```

---

## User-Feedback

### Notification-Service

Fehler werden dem User via Notification-Service angezeigt:

```typescript
interface NotificationService {
  show(notification: Notification): void;
}

interface Notification {
  type: 'info' | 'warning' | 'error';
  title: string;
  message: string;
  duration?: number;         // Auto-dismiss (ms)
  actions?: NotificationAction[];
}

// Verwendung
function formatMapError(error: MapError): Notification {
  switch (error.code) {
    case 'MAP_NOT_FOUND':
      return {
        type: 'error',
        title: 'Map nicht gefunden',
        message: `Die Map "${error.mapId}" existiert nicht.`
      };
    case 'INVALID_MAP_DATA':
      return {
        type: 'error',
        title: 'Ungueltige Map-Daten',
        message: 'Die Map-Datei ist beschaedigt oder im falschen Format.'
      };
    default:
      return {
        type: 'error',
        title: 'Fehler beim Laden',
        message: 'Ein unbekannter Fehler ist aufgetreten.'
      };
  }
}
```

### Error-Kategorisierung fuer User

| Fehler-Typ | User-Nachricht | Aktion |
|------------|----------------|--------|
| Nicht gefunden | "X existiert nicht" | Auswahl aendern |
| Ungueltige Daten | "Datei beschaedigt" | Support kontaktieren |
| In Verwendung | "X ist gerade aktiv" | Warten oder abbrechen |
| Keine Berechtigung | "Keine Schreibrechte" | Obsidian-Einstellungen pruefen |

---

## Logging

### Log-Levels

```typescript
enum LogLevel {
  DEBUG = 0,   // Entwicklung, Detail-Infos
  INFO = 1,    // Normale Operationen
  WARN = 2,    // Potentielle Probleme
  ERROR = 3    // Fehler, die behandelt wurden
}
```

### Structured Logging

```typescript
interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  module: string;          // 'map-feature', 'travel-feature'
  message: string;
  context?: Record<string, unknown>;
  error?: unknown;
}

// Verwendung
logger.error('Map laden fehlgeschlagen', {
  module: 'map-feature',
  context: { mapId: 'map-123' },
  error: result.error
});
```

### Wann loggen?

| Situation | Level | Beispiel |
|-----------|-------|----------|
| Feature-Operation gestartet | DEBUG | "Loading map: map-123" |
| Wichtige State-Aenderung | INFO | "Travel started to (5,3)" |
| Unerwarteter aber behandelter Zustand | WARN | "NPC not found, generating new" |
| Fehler der an User geht | ERROR | "Map file corrupted" |

---

## Recovery-Strategien

### Automatische Recovery

Bestimmte Fehler koennen automatisch behoben werden:

```typescript
function loadMapWithRecovery(mapId: string): Result<Map, MapError> {
  const result = loadMap(mapId);

  if (!result.ok && result.error.code === 'INVALID_MAP_DATA') {
    // Versuch: Backup laden
    const backupResult = loadMapBackup(mapId);
    if (backupResult.ok) {
      logger.warn('Map aus Backup wiederhergestellt', { mapId });
      return backupResult;
    }
  }

  return result;
}
```

### User-gesteuerte Recovery

Bei nicht-automatisch behebbaren Fehlern:

```typescript
// ViewModel bietet Optionen an
function handleEncounterError(error: EncounterError): void {
  switch (error.code) {
    case 'NPC_DEAD':
      showNotification({
        type: 'warning',
        title: 'NPC nicht verfuegbar',
        message: `${error.npcName} ist tot.`,
        actions: [
          { label: 'Anderen NPC waehlen', action: () => openNPCSelector() },
          { label: 'Encounter abbrechen', action: () => cancelEncounter() }
        ]
      });
      break;
    // ...
  }
}
```

---

## Best Practices

### Do

- Immer `Result<T, E>` fuer fehlbare Operationen
- Typisierte Error-Codes statt generische Strings
- Fehler an Layer-Grenzen transformieren
- User-facing Nachrichten von technischen Details trennen
- Logging fuer Debugging, aber nicht fuer User-Feedback

### Don't

- `throw` in Feature/Infrastructure Code
- Generische `Error`-Objekte
- Fehler verschlucken ohne Logging
- Technische Details an User zeigen
- IO-Errors direkt an Application-Layer durchreichen

---

## Prioritaet

| Komponente | MVP | Post-MVP | Notiz |
|------------|:---:|:--------:|-------|
| Result-Typ | ✓ | | Bereits in @core |
| Typisierte Feature-Errors | ✓ | | Pro Feature |
| Failed-Event Pattern | ✓ | | Fuer alle Workflows |
| Notification-Service | ✓ | | User-Feedback |
| Structured Logging | | mittel | Debug-Modus |
| Automatische Recovery | | niedrig | Backups, Retries |

---


## Tasks

| # | Status | Domain | Layer | Beschreibung | Prio | MVP? | Deps | Spec | Imp. |
|--:|:------:|--------|-------|--------------|:----:|:----:|------|------|------|
