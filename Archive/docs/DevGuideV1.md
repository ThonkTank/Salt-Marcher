# CLAUDE.md

Diese Datei bietet Orientierung für Claude Code bei der Arbeit mit diesem Repository.

---

## 1. Quick Reference

### Development Commands

```bash
npm run dev          # Entwicklungs-Build mit Watch-Modus (esbuild)
npm run build        # Produktions-Build
npm run typecheck    # Nur Type-Checking (tsc --noEmit)
npm test             # Tests im Watch-Modus (vitest)
npx vitest run       # Alle Tests einmalig ausführen
npx vitest run <file>  # Einzelne Testdatei ausführen
```

### Path Aliases

| Alias | Pfad |
|-------|------|
| `@core/*` | `src/core/*` |
| `@shared/*` | `src/application/shared/*` |
| `@/*` | `src/*` |

---

## 2. Projektübersicht

SaltMarcher ist ein Obsidian-Plugin für D&D Campaign Management.

**Implementiert:**
- **Cartographer:** Hex-Map-Editor (Brush-Tools, Undo/Redo, Terrain-Painting)
- **SessionRunner:** Map-Display, Travel-System, Calendar/Encounter-Panels
- **Domains:** Geography, Time, Entity
- **Orchestration:** Travel (Route-Planung), Encounter (Random Encounters)

**Geplant:** Audio, Economy, Environment, Combat, Quest Domains

---

## 3. Architektur-Überblick

### Layer-Diagramm

```
┌─────────────────────────────────────────────────────┐
│  Application        UI, ViewModels, Panels          │
└───────────────────────────┬─────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────┐
│  Orchestration      Cross-domain Workflows          │
└───────────────────────────┬─────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────┐
│  Domain             Pure Business Logic, Ports      │
└───────────────────────────↑─────────────────────────┘
                            │
┌─────────────────────────────────────────────────────┐
│  Infrastructure     Adapter-Implementierungen       │
└─────────────────────────────────────────────────────┘

         ↑ Core (Types, Schemas, Events) wird von allen verwendet
```

**Dependency-Richtung:**
- Application → Orchestration → Domain ← Infrastructure
- Domain definiert Ports, Infrastructure implementiert sie
- Core hat keine Abhängigkeiten, wird von allen importiert

### Domain Dependency Hierarchy

```
Keine Deps:    Time │ Entity │ Geography
1 Dep:         Audio │ Economy
2+ Deps:       Environment │ Combat │ Quest
```

---

## 4. Core Layer (`src/core/`)

Gemeinsame Grundlagen für alle anderen Layer: Typen, Schemas, Events.

### Verzeichnis-Struktur

```
src/core/
├── events/     # Event Bus + Event-Definitionen
├── schemas/    # Zod Schemas für alle Entities
├── types/      # Gemeinsame TypeScript-Typen
└── index.ts
```

**Wann gehört etwas in Core?**
- Wird von 2+ Layern verwendet
- Hat keine Abhängigkeiten zu Domain/Orchestration/Application

### Typen & Schemas

**Result/Option Types**

Verwende `Result<T, AppError>` für Operationen die fehlschlagen können:

```typescript
function loadMap(id: string): Result<Map, AppError> {
  if (!exists) return err({ code: 'MAP_NOT_FOUND', message: '...' });
  return ok(map);
}

// AppError: { code: string, message: string, details?: unknown }
```

Verwende `Option<T>` für optionale Werte (statt `null`/`undefined`):

```typescript
function findTile(coord: Coord): Option<Tile> {
  return fromNullable(tiles.get(coordToKey(coord)));
}
```

Helpers: `ok()`, `err()`, `isOk()`, `unwrap()`, `unwrapOr()`, `mapResult()`, `some()`, `none()`, `isSome()`, `fromNullable()`, `getOrElse()`

**Zod Schemas & Branded Types**

Regeln für neue Schemas:
1. Schema in `schemas/` definieren
2. Type aus Schema inferieren: `type X = z.infer<typeof XSchema>`
3. Für IDs `entityIdSchema('typename')` verwenden
4. Built-in Registries nutzen (z.B. `TERRAIN_REGISTRY`)

Regeln für Branded Types:
- IDs: `EntityId<'map'>`, `EntityId<'creature'>` etc.
- Timestamps: `Timestamp` (nicht `number`)
- Neue Entities von `BaseEntity<T>` oder `TrackedEntity<T>` ableiten

Helpers: `createEntityId()`, `toEntityId()`, `now()`, `toTimestamp()`

---

## 5. Domain Layer (`src/domains/`)

Isolierte Geschäftslogik ohne Abhängigkeiten zu Infrastructure oder UI.

### Verzeichnis-Struktur

```
src/domains/<name>/
├── ports.ts      # ServicePort (inbound) + StoragePort (outbound)
├── service.ts    # createXxxService() Factory
└── index.ts      # Public API
```

### Hexagonal Architecture (Ports)

**Komponenten**

| Komponente | Datei | Verantwortung |
|------------|-------|---------------|
| Inbound Port | `ports.ts` | Interface das die Domain anbietet |
| Outbound Port | `ports.ts` | Interface das die Domain benötigt |
| Service | `service.ts` | Geschäftslogik, implementiert Inbound Port |

**Regeln**

- Domain importiert **niemals** aus `infrastructure/`, `application/`, `orchestration/`
- Domain definiert nur Ports (Interfaces), keine Implementierungen für externe Systeme
- Alle I/O-Operationen über Outbound Ports abstrahieren
- Return Types: `Result<T, AppError>` für fehlbare Operationen

**Datenfluss**

```
Aufrufer → ServicePort → Service → StoragePort → [wird von Infrastructure implementiert]
```

### Checkliste: Neue Domain

- [ ] `ports.ts`: ServicePort + StoragePort Interfaces definieren
- [ ] `service.ts`: `createXxxService(storage: StoragePort)` Factory
- [ ] `index.ts`: Ports und Service-Factory exportieren
- [ ] Keine Adapter im Domain-Ordner!

---

## 6. Infrastructure Layer (`src/infrastructure/`)

Implementiert Domain-Ports für konkrete externe Systeme (Vault, APIs, etc.).

### Verzeichnis-Struktur

```
src/infrastructure/
├── vault/                    # Alle Vault-Adapter
│   ├── shared.ts             # Gemeinsame Vault-Utilities
│   ├── geography-adapter.ts
│   ├── time-adapter.ts
│   └── entity-adapter.ts
└── api/                      # Falls später externe APIs
    └── ...
```

### Adapter Pattern

**Komponenten**

| Komponente | Verantwortung |
|------------|---------------|
| Adapter | Implementiert Domain StoragePort |
| `shared.ts` | Wiederverwendbare Logik pro Technologie |

**Regeln**

- Adapter gruppiert nach Technologie (vault, api, etc.)
- Adapter importieren Domain-Ports und implementieren sie
- Gemeinsame Logik in `shared.ts` der jeweiligen Technologie
- Benennung: `<domain>-adapter.ts`

**Datenfluss**

```
Service → StoragePort → Adapter → Obsidian Vault / External API
```

### Checkliste: Neuer Adapter

- [ ] Domain-StoragePort importieren
- [ ] Adapter in passender Technologie-Gruppe erstellen (`vault/`, `api/`, etc.)
- [ ] Adapter-Klasse/Factory die StoragePort implementiert
- [ ] Gemeinsame Logik nach `shared.ts` extrahieren
- [ ] In `main.ts` Adapter instanziieren und an Service übergeben

---

## 7. Orchestration Layer (`src/orchestration/`)

Koordiniert mehrere Domains für komplexe Workflows via State Machines.

### Verzeichnis-Struktur

```
src/orchestration/<name>/
├── ports.ts           # OrchestratorPort Interface
├── orchestrator.ts    # State Machine + EventBus Integration
├── types.ts           # State, Config, Event-Payloads, Listener
├── <name>-*.ts        # Optional: Utility-Module
└── index.ts           # Public API
```

**Utility-Module** für komplexe Berechnungslogik:
- `route-calculator.ts` - Pathfinding, Distanzberechnung
- `encounter-generator.ts` - Difficulty-basierte Generierung

### State Machines

**Komponenten**

| Komponente | Datei | Verantwortung |
|------------|-------|---------------|
| OrchestratorPort | `ports.ts` | Interface für Orchestrator-Operationen |
| State Machine | `orchestrator.ts` | Status-Transitions, Event-Handling |
| State/Config/Payloads | `types.ts` | Alle Type-Definitionen |

**types.ts Struktur**

```typescript
// 1. Status-Enum
type TravelStatus = 'idle' | 'planning' | 'traveling' | 'paused' | 'arrived';

// 2. State-Type
interface TravelState {
  status: TravelStatus;
  route: Route | null;
  progress: TravelProgress | null;
  partyPosition: HexCoordinate;
}

// 3. Config mit Default
interface TravelConfig { /* ... */ }
const DEFAULT_TRAVEL_CONFIG: TravelConfig = { /* ... */ };

// 4. Event-Payloads
interface TravelStartedPayload { routeId: string; from: HexCoordinate; /* ... */ }

// 5. State-Listener
type TravelStateListener = (state: TravelState) => void;
```

**State-Transitions (Beispiele)**

```
Travel:    idle → planning → traveling ↔ paused → arrived → idle
Encounter: idle ↔ active
```

**Port-Interface Standard-Methoden**

```typescript
interface OrchestratorPort {
  // State Access
  getState(): Readonly<State>;
  subscribe(listener: StateListener): () => void;

  // Lifecycle
  initialize(): Promise<void>;
  dispose(): void;

  // Domain-spezifische Methoden mit Result<T, AppError>
}
```

**Regeln**

- **Queries an Domains:** Direkte Port-Calls
- **Commands an Domains:** Direkte Port-Calls (Domain publiziert selbst Events)
- **Cross-Orchestrator:** NUR via Events, KEINE `*-requested` Commands
- Return Types: `Result<T, AppError>` für fehlbare Operationen
- State-Änderungen publizieren `*:state-changed` Events
- Orchestratoren haben **keine direkten Referenzen** zueinander

**Orchestrator-Hierarchie**

```
Primary Orchestrators (starten Workflows):
  └── TravelOrchestrator

Reactive Orchestrators (reagieren auf Domain-Events):
  ├── EncounterOrchestrator (→ travel:moved)
  ├── AudioOrchestrator (→ mood/location changes)
  └── WeatherOrchestrator (→ time:changed)
```

**Strikt unidirektional:** Primary initiiert Workflows. Reactive reagiert auf Domain-Events (z.B. `time:changed`, `position:changed`), sendet aber NIEMALS `*-requested` Events an andere Orchestratoren.

Beispiel: EncounterOrchestrator sendet `encounter:resolved`, TravelOrchestrator reagiert darauf mit Resume - nicht umgekehrt via `travel:resume-requested`.

**Datenfluss**

```
ViewModel
    │ publish('*-requested')
    ▼
Orchestrator
    │ ┌─ Lesen: Direkte Domain-Port-Calls
    │ └─ Schreiben: Domain-Port-Calls + Event publish
    ▼
Domain Services
    │
    ▼ Domain-Events (z.B. 'travel:moved')
Reactive Orchestrators
    │ reagieren, keine Commands
    ▼
    publish('*:state-changed')
    │
    ▼
ViewModel (subscribed)
```

**Lifecycle**

- Orchestratoren werden in `main.ts` erstellt und beim Plugin-Unload disposed
- ViewModels subscriben/unsubscriben sich auf Orchestrator-Events
- `dispose()` räumt alle EventBus-Subscriptions auf

**Subscription-Regel:** Alle EventBus-Subscriptions in `initialize()`, NIE im Constructor.

### State Ownership

**Regeln:**
- **Domain Services** besitzen persistenten, fundamentalen State (Map-Daten, Zeit, Entities)
- **Orchestratoren** besitzen transienten, workflow-spezifischen State (Routen, Progress, aktive Encounters)
- Jeder State hat **genau einen Owner** (Single Source of Truth)
- Andere Komponenten erhalten State via Events, speichern aber keine Kopien

**Persistenz:**
- Domain State: Wird im Vault persistiert
- Orchestrator State: Lebt nur während der Session

### Checkliste: Neuer Orchestrator

- [ ] `types.ts`: Status-Enum definieren
- [ ] `types.ts`: State-Type mit Status-Enum
- [ ] `types.ts`: Config-Type + `DEFAULT_*_CONFIG`
- [ ] `types.ts`: Event-Payloads für alle Events
- [ ] `types.ts`: StateListener-Type
- [ ] `ports.ts`: OrchestratorPort mit `getState()`, `subscribe()`, `initialize()`, `dispose()`
- [ ] `ports.ts`: Domain-spezifische Methoden mit `Result<T, AppError>`
- [ ] `orchestrator.ts`: `createXxxOrchestrator(deps)` Factory
- [ ] `orchestrator.ts`: State Machine mit expliziten Transitions
- [ ] Events in `@core/events/domain-events.ts` definieren
- [ ] In `main.ts` registrieren und Lifecycle managen
- [ ] Entscheiden: Primary oder Reactive Orchestrator?
- [ ] Optional: Utility-Modul für komplexe Logik
- [ ] `orchestrator.ts`: Subscriptions in `initialize()`, nicht im Constructor
- [ ] Reactive: Reagiert auf Domain-Events, sendet keine `*-requested` Commands

---

## 8. Application Layer (`src/application/`)

UI-Komponenten und deren State-Management via MVVM Pattern.

### Verzeichnis-Struktur

```
src/application/<name>/
├── view.ts           # Obsidian ItemView Container
├── viewmodel.ts      # State Management + Koordination
├── types.ts          # State types, RenderHints
├── panels/           # UI-Bereiche (sprechen NUR mit ViewModel)
├── services/         # Algorithmen ohne State (optional)
└── utils/            # ToolView-spezifische Utilities (optional)
```

### MVVM Pattern

Jeder ToolView hat **eine** View und **ein** ViewModel (1:1 Beziehung).

```
┌─────────────────────────────────────────────────────────────────┐
│  VIEW (view.ts = Container für Panels)                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Panels                                                  │   │
│  │  └── Nutzen @shared/ Components direkt                  │   │
│  │  └── State/Callbacks vom ViewModel                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  ViewModel (State + Koordination)                        │   │
│  │  └── Orchestrator vorhanden? → EventBus                 │   │
│  │  └── Kein Orchestrator? → Direkte Domain-Calls          │   │
│  │  └── Algorithmen → services/                            │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

**Verantwortlichkeiten**

| Komponente | Darf | Darf NICHT |
|------------|------|------------|
| **Panels** | Rendern, @shared/ nutzen, lokaler UI-State | Direkte Service/Orchestrator Calls |
| **ViewModel** | State, Koordination, EventBus, Domain-Calls | DOM Manipulation, Algorithmen |
| **services/** | Algorithmen (Brush, Pathfinding) | State Management |

**Regeln**

- Panels sprechen **ausschließlich** mit dem ViewModel
- ViewModel → Orchestrator: **Immer via EventBus**
- ViewModel → Domain (ohne Orchestrator): **Direkte Calls** erlaubt
- Algorithmen ohne State gehören in `services/`
- @shared/ Components sind stateless (Props + Callbacks)

**Datenfluss**

```
User → Panel → ViewModel ─┬─→ EventBus → Orchestrator (wenn vorhanden)
                          └─→ Domain-Service direkt (wenn kein Orchestrator)

Panel.update(context) ← ViewModel.getPanelContext() ← State Change
```

### Shared Components (`@shared/`)

Wiederverwendbare, stateless UI-Komponenten.

```
src/application/shared/
├── map/              # Hex-Map Rendering
├── form/             # Form Controls (Select, Slider, Button)
├── layout/           # Layout Helpers
├── types/            # Gemeinsame Types
└── view/             # BaseToolView Lifecycle
```

**Regel:** Komponente in 2+ ToolViews verwendet → nach `@shared/` extrahieren.

### Checkliste: Neues ViewModel

- [ ] 1:1 Beziehung zu View
- [ ] Orchestrator vorhanden? → EventBus für Commands
- [ ] Kein Orchestrator? → Direkte Domain-Calls erlaubt
- [ ] Algorithmen → in `services/` auslagern
- [ ] State-Updates via `*:state-changed` Events empfangen
- [ ] `dispose()` für EventBus-Subscriptions
- [ ] RenderHints für optimiertes Re-Rendering

### Render Hints

ViewModel emittiert `RenderHint` für optimiertes Panel-Rendering:

| Hint | Bedeutung |
|------|-----------|
| `'full'` | Alles neu rendern |
| `'tiles'` | Nur Kacheln |
| `'camera'` | Nur Viewport |
| `'ui'` | Nur UI-Elemente |
| `'selection'` | Nur Selektion |
| `'brush'` | Nur Brush-Preview |

### View Factory Pattern

ToolViews registrieren sich via Factory in `main.ts`:

```typescript
const factory = createCartographerViewFactory(geographyService, eventBus);
this.registerView(VIEW_TYPE_CARTOGRAPHER, factory);
```

**Regel:** Factory kapselt alle Dependencies, View erhält sie via Constructor.

---

## 9. Event Bus (Kommunikation)

Zentraler Kommunikationskanal via `@core/events/event-bus.ts`.

### Event-Kategorien

| Kategorie | Namenskonvention | Sender | Empfänger |
|-----------|------------------|--------|-----------|
| **Command** | `*-requested` | ViewModel | Orchestrator |
| **Domain** | `*:changed`, `*:started` | Domain/Orchestrator | Reactive Orchestrators |
| **State-Sync** | `*:state-changed` | Orchestrator | ViewModel |
| **Failure** | `*-failed` | Orchestrator | ViewModel |

### Kommunikationsregeln

- **ViewModel → Orchestrator:** `*-requested` Events
- **Orchestrator → ViewModel:** `*:state-changed` Events
- **Domain → Orchestrator:** `*:changed` Events (z.B. `time:changed`)
- **Orchestrator ↔ Orchestrator:** NUR Domain-Events, KEINE `*-requested`

### Type-Safe Events

```typescript
import { EventTypes, createEvent } from '@core/events';

// Event publizieren
eventBus.publish(
  createEvent(EventTypes.TRAVEL_START_REQUESTED, { routeId }, 'viewmodel')
);

// Event subscriben
const unsub = eventBus.subscribe(EventTypes.TRAVEL_STATE_CHANGED, (event) => {
  // event.payload ist typisiert
});

// Cleanup in dispose()
unsub();
```

### Neues Event definieren

1. Event-Type in `@core/events/domain-events.ts` hinzufügen
2. Payload-Interface definieren
3. EventTypes Konstante hinzufügen

---

## 10. Konventionen

### DRY-Regeln

| Verwendung in | Extrahieren nach |
|---------------|------------------|
| 2+ ToolViews | `@shared/` |
| 2+ Orchestratoren | `orchestration/shared/` |
| 2+ Domains | `domains/shared/` |
| Mehrere Layer | `@core/` |

### Naming Conventions

**Service Factories**

```typescript
// ✓ Factory-Funktion exportieren
export function createGeographyService(storage: MapStoragePort): GeographyServicePort

// ✗ Klasse direkt exportieren
export class GeographyService
```

**Index Exports**

Jeder `index.ts` re-exportiert das public API:

```typescript
// domain/index.ts
export { createXxxService } from './service';
export type { XxxServicePort, XxxStoragePort } from './ports';
export type { XxxState, XxxConfig } from './types';
```

**Regel:** Nur exportieren was extern gebraucht wird.

---

## 11. Entwicklung

### Plugin Entry Point (`main.ts`)

`src/main.ts` initialisiert das Plugin in folgender Reihenfolge:

1. Infrastructure Adapter instanziieren (Vault-Adapter)
2. Domain Services mit Adaptern erstellen
3. Orchestration Layer mit Domain-Dependencies
4. ToolView Registrierung via Factory-Funktionen
5. Ribbon Icons und Command Palette Einträge

### Debugging

Konfigurierbares Debug-Logging via `.claude/debug.json`:

```bash
cp .claude/debug.json.example .claude/debug.json
# Plugin neu laden: Settings → Community Plugins → Salt Marcher → Reload
# Logs prüfen: tail -f CONSOLE_LOG.txt
```

Details siehe `.claude/DEBUG.md`

### Testing

```bash
npm test                      # Watch-Modus
npx vitest run               # Alle Tests einmalig
npx vitest run <pattern>     # Tests nach Pattern filtern
```

**Hinweis:** Der aktuelle `src/`-Ordner hat noch keine Tests. Legacy-Tests in `Alpha1/` dienen als Referenz.

---

## 12. Referenz

### Archivierte Verzeichnisse

| Verzeichnis | Beschreibung |
|-------------|--------------|
| `Alpha1/`, `Alpha2/` | Archivierte Vorversionen (nicht bearbeiten) |
| `ArchitectureGoals.md` | Vision und Roadmap für geplante Features |

**Wichtig:** Neuer Code gehört ausschließlich in `src/`
