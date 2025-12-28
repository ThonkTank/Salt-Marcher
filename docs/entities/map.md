# Schema: Map

> **Produziert von:** [Cartographer](../views/Cartographer.md), [Library](../views/Library.md)
> **Konsumiert von:** [Map-Feature](../features/Map-Feature.md) (Laden/Speichern), [Travel](../features/Travel-System.md) (Terrain-Faktoren), [Weather](../services/Weather.md) (Map-globales Wetter)

## Felder

| Feld | Typ | Beschreibung | Validierung |
|------|-----|--------------|-------------|
| id | EntityId<'map'> | Eindeutige Map-ID | Required |
| name | string | Anzeigename | Required, non-empty |
| type | MapType | Art der Map | Required |
| defaultSpawnPoint | Coordinate? | Spawn-Position ohne Link-Tile | Optional |
| description | string? | Beschreibung | Optional |
| gmNotes | string? | GM-Notizen | Optional |

## Sub-Schemas

### MapType

| Wert | Koordinaten | Primaerer Use-Case |
|------|-------------|-------------------|
| `overworld` | Hex (axial) | Overland Travel |
| `town` | Strassen | Stadt-Exploration |
| `dungeon` | Grid (5ft) | Dungeon Crawl |

## Invarianten

- Maps sind Container fuer ortsgebundene Daten (Tiles, POIs, Overlays)
- Typ bestimmt Koordinaten-System und verfuegbare Features
- `overworld` ist der primaere Map-Typ fuer Travel-Feature

## Beispiel

```typescript
const forestMap: Map = {
  id: 'map:emerald-forest' as EntityId<'map'>,
  name: 'Emerald Forest',
  type: 'overworld',
  defaultSpawnPoint: { q: 0, r: 0 },
  description: 'Ein dichter Wald voller Geheimnisse'
};
```
