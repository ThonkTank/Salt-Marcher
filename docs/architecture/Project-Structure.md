# Projektstruktur

> **Lies auch:** [Development-Roadmap.md](Development-Roadmap.md)
> **Wird benoetigt von:** Neue Dateien anlegen

Dieses Dokument definiert die Zielstruktur des `src/`-Verzeichnisses.

---

## Layer-Architektur

```
Application Layer (SessionRunner, Views, UI)
        ↓
Feature Layer (State + Business Logic + StoragePorts)
        ↓
Infrastructure Layer (Vault-Adapter, Rendering)

Core: Schemas, Types, Events, Utils (quer durch alle Layer)
```

**Abhängigkeitsregel:** Obere Layer dürfen untere Layer direkt abfragen. State-Änderungen propagieren nach oben via Events. Keine Zyklen erlaubt.

---

## Verzeichnisstruktur

```
src/
├── core/               # Gemeinsame Grundlagen
│   ├── events/         # EventBus + Event-Definitionen
│   ├── schemas/        # Zod Schemas
│   ├── types/          # TypeScript-Typen (Result, Option, EntityId, etc.)
│   └── utils/          # Pure functions (hex-math, time-math, etc.)
│
├── features/           # Feature Layer
│   ├── travel/         # Travel-Feature (State Machine, Orchestrator)
│   ├── weather/        # Weather-Feature
│   ├── encounter/      # Encounter-Feature
│   └── .../            # Weitere Features
│
├── infrastructure/     # Infrastructure Layer
│   └── vault/          # Obsidian Vault Adapter
│       ├── shared.ts   # Gemeinsame Vault-Utilities
│       └── *-adapter.ts
│
├── application/        # Application Layer
│   ├── session-runner/ # Haupt-Spielansicht
│   └── shared/         # Gemeinsame UI-Komponenten
│
└── main.ts             # Plugin Entry Point
```

### Presets-Verzeichnis (Plugin-Bundled Data)

Standarddaten die mit dem Plugin gebundelt werden:

```
presets/
├── creatures/          # Creature-Templates
│   ├── goblin.json
│   └── skeleton.json
├── terrains/           # Terrain-Definitionen
│   ├── forest.json
│   └── desert.json
├── items/              # Standard-Items
│   └── longsword.json
└── index.ts            # Re-exports alle Presets
```

**Build-Prozess:** JSON-Import zur Build-Zeit via esbuild. Details: [Infrastructure.md](Infrastructure.md#presetport-plugin-bundled-data)

---

## Layer-Details

| Layer | Pfad | Dokumentation |
|-------|------|---------------|
| Core | `src/core/` | [Core.md](Core.md) |
| Features | `src/features/` | [Features.md](Features.md) |
| Infrastructure | `src/infrastructure/` | [Infrastructure.md](Infrastructure.md) |
| Application | `src/application/` | [Application.md](Application.md) |

---

## Path Aliases

Definiert in `tsconfig.json`:

```typescript
@core/*    → src/core/*
@shared/*  → src/application/shared/*
@/*        → src/*
```

**Beispiel:**

```typescript
import { Result, ok, err } from '@core/types/result';
import { MapSchema } from '@core/schemas/map';
import { TravelOrchestrator } from '@/features/travel';
```

---

