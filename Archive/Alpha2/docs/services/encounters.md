#### Encounter Generation

```typescript
function getEncounterCandidates(tile: TileCoord, timeOfDay: "day" | "night"): Population[] {
  // Finde alle Populationen deren Territory dieses Tile enthält
  const present = map.populations.filter(p => p.territory.includes(tile));

  // Filtere nach Activity (Pflanzen: activity = "always")
  const active = present.filter(p => {
    const creature = getCreature(p.creatureId);
    return isActiveAt(creature.activity, timeOfDay);
  });

  // Pflanzen nur wenn isEncounterable (magische Kräuter etc.)
  const encounterable = active.filter(p => {
    const creature = getCreature(p.creatureId);
    return !creature.tags.includes('plant') || creature.isEncounterable;
  });

  // Sortiere nach Courage (mutigere Creatures erscheinen eher)
  // Pflanzen haben courage = 0, erscheinen also nur wenn nichts anderes da ist
  return encounterable.sort((a, b) =>
    getCreature(b.creatureId).courage - getCreature(a.creatureId).courage
  );
}
```
