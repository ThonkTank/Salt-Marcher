# Schema: Landmark

> **Produziert von:** [Library](../views/Library.md) (CRUD), [Cartographer](../views/Cartographer.md)
> **Konsumiert von:**
> - [Map-Navigation](../features/Map-Navigation.md) – Sub-Map-Wechsel via linkedMapId
> - [Map-Feature](../features/Map-Feature.md) – Rendering, Visibility (height, glowsAtNight)
> - [Travel-System](../features/Travel.md) – Landmarks auf Party-Tile anzeigen
> - [Faction](faction.md) – controlledLandmarks fuer Territorium

Landmarks sind bemerkenswerte Orte auf der Overworld: Doerfer, Ruinen, Schreine, Hoehleneingaenge.

**Design-Philosophie:** Ein einfacher Typ fuer alle Overworld-Orte. Kann optional zu Sub-Maps fuehren.

---

## Felder

| Feld | Typ | Beschreibung | Validierung |
|------|-----|--------------|-------------|
| id | EntityId<'landmark'> | Eindeutige ID | Required |
| mapId | EntityId<'map'> | Overworld-Map | Required |
| position | HexCoordinate | Hex-Position | Required |
| name | string | Anzeigename | Required |
| icon | string | Icon fuer Map | Optional |
| visible | boolean | Fuer Spieler sichtbar? | Required |
| height | number | Hoehe fuer Visibility | Optional |
| glowsAtNight | boolean | Leuchtet bei Nacht | Optional |
| description | string | Beschreibung | Optional |
| gmNotes | string | GM-Notizen | Optional |
| linkedMapId | EntityId<'map'> | Sub-Map (Dungeon, Town) | Optional |
| spawnPosition | HexCoordinate | Spawn auf Sub-Map | Optional, nur mit linkedMapId |

---

## Invarianten

- `mapId` muss auf existierende Overworld-Map verweisen
- `linkedMapId` muss auf existierende Map verweisen (falls gesetzt)
- `spawnPosition` nur sinnvoll wenn `linkedMapId` gesetzt
- `height` wird fuer Visibility-Berechnung verwendet
- `glowsAtNight` ignoriert Nacht-Modifier im Visibility-System

---

## Beispiele

### Dorf (sicher, keine Sub-Map)

```typescript
const village: Landmark = {
  id: 'coastal-village',
  mapId: 'coastal-village-map',
  position: { q: 0, r: 0 },
  name: 'Kuestendorf',
  icon: 'home',
  visible: true,
  description: 'Ein kleines Fischerdorf an der Kueste.',
  gmNotes: 'Sicher. Taverne ist Treffpunkt fuer Geruechte.',
};
```

### Hoehleneingang (fuehrt zu Dungeon)

```typescript
const cave: Landmark = {
  id: 'goblin-cave',
  mapId: 'coastal-village-map',
  position: { q: -1, r: 3 },
  name: 'Goblin-Hoehle',
  icon: 'cave',
  visible: false,  // Versteckt bis entdeckt
  description: 'Ein schmaler Spalt im Fels.',
  linkedMapId: 'goblin-cave-dungeon',
  spawnPosition: { q: 0, r: 0 },
};
```

### Leuchtturm (sichtbar bei Nacht)

```typescript
const lighthouse: Landmark = {
  id: 'lighthouse-ruins',
  mapId: 'coastal-village-map',
  position: { q: -3, r: 1 },
  name: 'Leuchtturm-Ruine',
  icon: 'lighthouse',
  visible: true,
  height: 60,
  glowsAtNight: true,
  description: 'Ein halb eingestuerzter Leuchtturm.',
};
```
