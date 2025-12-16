# Factions Feature

Vereinfachtes Factions-System für Territory-Management und Calendar-Integration.

## Inhalt

| Element | Beschreibung |
|---------|--------------|
| `index.ts` | Public API Exports |
| `faction-integration.ts` | Map/Calendar sync, daily simulation |
| `faction-serializer.ts` | YAML zu Markdown conversion |
| `faction-territory.ts` | Territory claims & conflict resolution |
| `simulation-types.ts` | SimulationTick, FactionSimulationResult types |
| `types.ts` | Re-export wrapper |

## Verbindungen

**Verwendet von:**
- Almanac (`runDailyFactionSimulation` hook)
- Cartographer (`syncFactionTerritoriesForMap`)

**Abhängig von:**
- `@services/domain` (FactionData, FactionMember types)

## Public API

```typescript
// Territory sync - beim Map-Load aufrufen
syncFactionTerritoriesForMap(app: App, mapFile: TFile): Promise<void>
syncFactionTerritoriesToAllMaps(app: App): Promise<void>

// Daily simulation - vom Almanac-Hook aufgerufen
runDailyFactionSimulation(app: App, elapsedDays: number, currentDate: string): Promise<SimulationEvent[]>

// Territory queries
calculateFactionTerritoryClaims(factions: readonly FactionData[]): FactionOverlayAssignment[]
getFactionMembersAtHex(app: App, mapFile: TFile, coord: { q: number; r: number }): Promise<FactionMember[]>
getAllFactionCamps(app: App): Promise<Array<{ faction: string; coords: { q: number; r: number } }>>
```

## Architektur

```
Almanac                    Cartographer
    |                           |
    v                           v
runDailyFactionSimulation  syncFactionTerritoriesForMap
    |                           |
    v                           v
faction-integration.ts ------> faction-territory.ts
    |                               |
    v                               v
FactionData (YAML)          FactionOverlayAssignment
```

## Simulation

Die tägliche Simulation ist bewusst einfach gehalten:
- Gathering-Members produzieren 10 Food/Tag
- Guards verbrauchen 2 Food/Tag
- Crafters produzieren 5 Equipment/Tag, verbrauchen 3 Gold/Tag

## Testing

Test files: `devkit/testing/unit/features/factions/`
- `faction-integration.test.ts` - Integration tests
- `calendar-integration.test.ts` - Almanac hook tests
