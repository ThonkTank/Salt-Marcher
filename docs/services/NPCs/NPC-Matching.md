# NPC-Matching

> **Verantwortlichkeit:** Existierenden NPC finden
> **Input:** `creatureId`, `factionId?`, `position?`
> **Output:** `Option<NPC>`
> **Schema:** [npc.md](../../entities/npc.md)
>
> **Verwandte Dokumente:**
> - [NPC-Generation.md](NPC-Generation.md) - NPC automatisch generieren
> - [NPC-Lifecycle.md](../../features/NPC-Lifecycle.md) - Status-Updates nach Match

Wie werden existierende NPCs wiederverwendet?

**Design-Philosophie:** NPCs sind persistent. Wenn die Party einen Goblin der Blutfang-Fraktion trifft, koennte es derselbe Goblin sein, den sie letzte Woche getroffen haben. NPC-Matching ermoeglicht diese Kontinuitaet.

---

## Datenfluss

```
┌─────────────────────────────────────────────────────────────────────┐
│  DATENFLUSS: NPC-Matching                                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Aufrufer (Encounter, Quest, etc.)                                  │
│  └── findMatchingNPC(creatureId, factionId?, position?)             │
│      │                                                               │
│      ▼                                                               │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ NPC-MATCHING                                                    │  │
│  │                                                                 │  │
│  │ 1. Kandidaten filtern                                           │  │
│  │    └── EntityRegistry.query('npc', ...)                         │
│  │    └── creature.id + factionId + status='alive'                 │  │
│  │    │                                                            │  │
│  │ 2. Keine Kandidaten?                                            │  │
│  │    └── Return None                                              │  │
│  │    │                                                            │  │
│  │ 3. Ein Kandidat?                                                │  │
│  │    └── Return Some(npc)                                         │  │
│  │    │                                                            │  │
│  │ 4. Mehrere Kandidaten? → Priorisieren                           │  │
│  │    └── Geografisch naechster (falls position gegeben)           │  │
│  │    └── Laenger nicht gesehen (Fallback)                         │  │
│  │                                                                 │  │
│  └────────────────────────────────────────────────────────────────┘  │
│      │                                                               │
│      ▼                                                               │
│  Return: Option<NPC>                                                 │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## API

### findMatchingNPC()

```typescript
function findMatchingNPC(
  creatureId: EntityId<'creature'>,
  factionId?: EntityId<'faction'>,
  position?: HexCoordinate
): Option<NPC> {
  // 1. Kandidaten filtern
  const candidates = entityRegistry.query('npc', npc =>
    npc.creature.id === creatureId &&
    (factionId === undefined || npc.factionId === factionId) &&
    npc.status === 'alive'
  );

  if (candidates.length === 0) return None;
  if (candidates.length === 1) return Some(candidates[0]);

  // 2. Priorisieren bei mehreren Matches
  return Some(prioritizeCandidates(candidates, position));
}
```

---

## Match-Kriterien

| Kriterium | Beschreibung | Required |
|-----------|--------------|:--------:|
| `creature.id` | Gleicher Kreatur-Typ (z.B. goblin-warrior) | Ja |
| `factionId` | Gleiche Fraktion (z.B. blutfang-tribe) | Nein |
| `status` | Muss 'alive' sein (tote NPCs werden nicht wiederverwendet) | Ja |

### Faction-Matching

| factionId Parameter | Verhalten |
|---------------------|-----------|
| `undefined` | Alle NPCs mit passendem creatureId (fraktionsuebergreifend) |
| `EntityId<'faction'>` | Nur NPCs dieser Fraktion |
| `null` | Nur fraktionslose NPCs |

---

## Priorisierung

Bei mehreren passenden NPCs wird priorisiert:

```typescript
function prioritizeCandidates(
  candidates: NPC[],
  position?: HexCoordinate
): NPC {
  return candidates.sort((a, b) => {
    // Primaer: Geografisch naechster NPC (falls Position gegeben)
    if (position) {
      const distA = a.lastKnownPosition
        ? hexDistance(position, a.lastKnownPosition)
        : Infinity;
      const distB = b.lastKnownPosition
        ? hexDistance(position, b.lastKnownPosition)
        : Infinity;

      if (distA !== distB) return distA - distB;
    }

    // Sekundaer: Wer wurde laenger nicht gesehen?
    // GameDateTime: { day, month, year, hour }
    const dayDiff = a.lastEncounter.day - b.lastEncounter.day;
    if (dayDiff !== 0) return dayDiff;
    return a.lastEncounter.hour - b.lastEncounter.hour;
  })[0];
}
```

### Priorisierungs-Logik

| Prioritaet | Kriterium | Begruendung |
|:----------:|-----------|-------------|
| 1 | Geografische Naehe | NPCs in der Naehe sind wahrscheinlicher |
| 2 | Laenger nicht gesehen | Rotiert NPCs, verhindert "Stalker"-Effekt |

---

## Ergebnis-Verwendung

| Situation | Aktion |
|-----------|--------|
| `Some(npc)` | NPC wiederverwenden, Tracking aktualisieren |
| `None` | Neuen NPC generieren via [NPC-Generation.md](NPC-Generation.md) |

### Nach erfolgreichem Match

Der aufrufende Code sollte den NPC aktualisieren:

```typescript
function useMatchedNPC(npc: NPC, position: HexCoordinate, time: GameDateTime): void {
  npc.lastEncounter = time;
  npc.encounterCount++;
  npc.lastKnownPosition = position;
  npc.lastSeenAt = time;

  entityRegistry.save('npc', npc);
}
```

> Details zur Aktualisierung: [NPC-Lifecycle.md](../../features/NPC-Lifecycle.md)

---

## Consumer-Beispiele

### Encounter-System

```typescript
// In Encounter.md Step 4.3 (groupNPCs)
const existing = findMatchingNPC(
  leadCreature.id,
  group.factionId,
  context.position
);

if (existing.isSome()) {
  useMatchedNPC(existing.value, context.position, context.currentTime);
  return { npcId: existing.value.id, isNew: false };
}

// Kein Match → neuen NPC generieren
const npc = generateNPC(leadCreature, group.faction, { ... });
return { npcId: npc.id, isNew: true };
```

### Quest-System

```typescript
// Quest-Geber wiederfinden
const questGiver = findMatchingNPC(
  questGiverCreatureId,
  questGiverFactionId,
  questLocation
);
```

---

## Edge Cases

### Tote NPCs

NPCs mit `status: 'dead'` werden **nie** gematcht. Sie bleiben im EntityRegistry fuer:
- Historische Referenzen (Journal-Entries)
- Quest-Bezuege
- GM-Notizen

### Fraktionswechsel

Wenn ein NPC die Fraktion wechselt (GM-Entscheidung), wird er bei Queries fuer die alte Fraktion nicht mehr gefunden.

### Keine Position bekannt

NPCs ohne `lastKnownPosition` haben `Infinity` als Distanz und werden bei geografischer Priorisierung benachteiligt.

---

## Siehe auch

- [NPC-Generation.md](NPC-Generation.md) - NPC automatisch generieren
- [NPC-Lifecycle.md](../../features/NPC-Lifecycle.md) - Status-Uebergaenge
- [npc.md](../../entities/npc.md) - NPC-Schema

---

## Tasks

| # | Status | Domain | Layer | Beschreibung | Prio | MVP? | Deps | Spec | Imp. |
|--:|:------:|--------|-------|--------------|:----:|:----:|------|------|------|
