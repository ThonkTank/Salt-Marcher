# Map Types Schema

Hex-Karten-Datentypen für Koordinaten und räumliche Berechnungen.

## Implementation

`src/core/schemas/map-types.ts`

## Interfaces

### TileCoord

Axiale Koordinaten für Hex-Grid.

```typescript
interface TileCoord {
  q: number;  // Column (axial)
  r: number;  // Row (axial)
}
```

## Functions

| Funktion | Beschreibung |
|----------|--------------|
| `coordToKey(coord)` | Serialisiert `{q, r}` zu `"q,r"` String |
| `keyToCoord(key)` | Deserialisiert `"q,r"` String zu `{q, r}` |

## Siehe auch

- `docs/core/geometry.md` - Tile-Dimensionen und Hex-Geometrie
