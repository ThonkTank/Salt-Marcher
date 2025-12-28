# NPC-Lifecycle

> **Verantwortlichkeit:** Persistierung, Status-Uebergaenge und laufende NPC-Simulation
> **Schema:** [npc.md](../entities/npc.md)
>
> **Verwandte Dokumente:**
> - [NPC-Generation.md](../services/NPCs/NPC-Generation.md) - NPC automatisch generieren
> - [NPC-Matching.md](../services/NPCs/NPC-Matching.md) - Existierenden NPC finden

Wie werden NPCs nach ihrer Erstellung verwaltet und aktualisiert?

---

## Status-Uebergaenge

```
┌───────────────────┐
│      alive        │
└─────────┬─────────┘
          │
          ▼
    ┌───────────┐
    │   dead    │
    └───────────┘
```

**Vereinfacht:** Nur `alive` und `dead`. Komplexere Stati (`missing`, `imprisoned`, `traveling`) kann der GM in Notizen tracken.

---

## Persistierung

NPCs werden im EntityRegistry gespeichert:

**Speicherort:** `Vault/SaltMarcher/data/npc/{name}.json`

### Felder die aktualisiert werden

| Feld | Update-Trigger | Beschreibung |
|------|----------------|--------------|
| `lastEncounter` | Nach Encounter | Zeitpunkt der letzten Begegnung |
| `encounterCount` | Nach Encounter | Anzahl Begegnungen +1 |
| `lastKnownPosition` | Nach Encounter | Position der letzten Sichtung |
| `lastSeenAt` | Nach Encounter | Zeitpunkt der letzten Sichtung |
| `status` | Bei NPC-Tod | Wechsel von 'alive' zu 'dead' |

---

## Encounter-Nachbereitung

Nach jedem Encounter werden NPC-Daten aktualisiert:

```typescript
function updateNPCAfterEncounter(
  npc: NPC,
  encounter: EncounterInstance,
  outcome: EncounterOutcome
): void {
  // Tracking aktualisieren
  npc.lastEncounter = encounter.generatedAt;
  npc.encounterCount++;

  // Position-Tracking aktualisieren (fuer geografische NPC-Auswahl)
  npc.lastKnownPosition = encounter.context.position;
  npc.lastSeenAt = encounter.generatedAt;

  // Status aendern falls NPC getoetet wurde
  if (outcome.npcKilled?.includes(npc.id)) {
    npc.status = 'dead';
  }

  entityRegistry.save('npc', npc);

  // Journal-Entry wird separat erstellt (Almanac-Feature)
  // und kann mit diesem NPC verlinkt werden
}
```

---

## Tote NPCs

- NPCs mit `status: 'dead'` werden **nicht** fuer neue Encounters wiederverwendet
- Sie bleiben im EntityRegistry fuer:
  - Historische Referenzen (Journal-Entries)
  - Quest-Bezuege
  - GM-Notizen

---

## Geplante Erweiterungen

Die folgenden Features sind fuer spaetere Implementierung vorgesehen:

| Feature | Beschreibung |
|---------|--------------|
| **Stat-Overrides** | Vollstaendige Stat-Anpassungen fuer individuelle NPCs |
| **NPC-Routen** | Wandernde NPCs (Haendler, Patrouillen) mit definierten Routen |
| **NPC-Schedules** | Tagesablauf-basierte Location (Morgens im Laden, Abends in Taverne) |
| **homeLocation** | NPC hat Heimat-Tile mit Radius-Bonus fuer Erscheinen |
| **Faction-lose NPCs** | Einsiedler, Wanderer ohne Faction |
| **NPC-Agency** | NPCs bewegen sich zur Runtime selbststaendig |

---

## Siehe auch

- [NPC-Generation.md](../services/NPCs/NPC-Generation.md) - NPC-Generierung
- [NPC-Matching.md](../services/NPCs/NPC-Matching.md) - Existierenden NPC finden
- [npc.md](../entities/npc.md) - NPC-Schema Definition
- [Encounter.md](../services/encounter/Encounter.md) - Encounter-Pipeline

---

## Tasks

| # | Status | Domain | Layer | Beschreibung | Prio | MVP? | Deps | Spec | Imp. |
|--:|:------:|--------|-------|--------------|:----:|:----:|------|------|------|
