# Schema: FactionPresence

> **Produziert von:** [Cartographer](../application/Cartographer.md) (Praesenz-Vorberechnung)
> **Konsumiert von:** [Encounter](../services/encounter/Encounter.md), [Map-Feature](../features/Map-Feature.md) (Territory-Overlay)

## Felder

| Feld | Typ | Beschreibung | Validierung |
|------|-----|--------------|-------------|
| factionId | EntityId<'faction'> | Fraktions-Referenz | Required |
| strength | number | Effektive CR-Summe auf Tile | >= 0 |

## Invarianten

- `strength` ist Budget-basiert: Summe ueber alle Tiles = Faction-Gesamt-CR
- Wird auf `OverworldTile.factionPresence[]` gespeichert
- Nur `active` Factions werden bei Encounter-Generierung beruecksichtigt
- Tiles naeher am kontrollierten POI haben hoeheren `strength`-Wert

## Beispiel

```typescript
// Tile nahe am POI hat hoehere Praesenz
const tilePresence: FactionPresence = {
  factionId: 'user-bloodfang' as EntityId<'faction'>,
  strength: 2.01  // Von 5.75 Gesamt-CR
};

// Beispiel: Blutfang-Goblins (5.75 CR gesamt, 7 Tiles im Territorium)
// POI-Tile: strength = 2.01 (35%)
// Distanz 1: strength = 1.01 (17.5% pro Tile)
// Distanz 2: strength = 0.66 (11.5% pro Tile)
// Distanz 3: strength = 0.20 (3.5% pro Tile)
// Summe aller strength = 5.75 (exakt Gesamt-CR)
```
