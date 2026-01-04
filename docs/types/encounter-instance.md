# Schema: EncounterInstance

> **Produziert von:** [Encounter-Service](../services/encounter/Encounter.md) (Pipeline-Output)
> **Konsumiert von:** [sessionState](../orchestration/sessionState.md), [EncounterWorkflow](../orchestration/EncounterWorkflow.md)

Runtime-Repraeesntation eines generierten Encounters. Nicht persistiert - existiert nur waehrend der Session.

---

## Felder

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `id` | `EntityId<'encounter'>` | Eindeutige ID |
| `groups` | `EncounterGroup[]` | Kreatur-Gruppen im Encounter |
| `alliances` | `Record<string, string[]>` | Gruppen-Allianzen (groupId → verbuendete groupIds) |
| `npcs` | `string[]` | NPC-IDs (1-3 NPCs pro Encounter) |
| `loot` | `GeneratedLoot` | Generiertes Loot |
| `perception` | `EncounterPerception` | Wahrnehmungs-Distanzen |
| `difficulty` | `DifficultyClassification` | Schwierigkeits-Einstufung |
| `context` | `EncounterContextSnapshot` | Snapshot des Generierungs-Kontexts |
| `description` | `string` | GM-taugliche Beschreibung |

---

## Alliances

Allianzen bestimmen welche Gruppen im Encounter verbuendet sind:

```typescript
alliances: Record<string, string[]>

// Beispiel:
{
  'party': ['group-uuid-1'],           // Party verbuendet mit Wachen
  'group-uuid-1': ['party'],            // Wachen verbuendet mit Party
  'group-uuid-2': ['group-uuid-3'],     // Banditen verbuendet mit Schmugglern
  'group-uuid-3': ['group-uuid-2'],     // Schmuggler verbuendet mit Banditen
}
```

**Allianz-Regeln (Prioritaet):**

| # | Bedingung | Effekt |
|:-:|-----------|--------|
| 1 | `disposition === 'allied'` | Gruppe verbuendet mit Party |
| 2 | Gleiche `factionId` | Gruppen untereinander verbuendet |
| 3 | Faction-Reputation >+60 | Deren Gruppen verbuendet |
| 4 | Alle anderen | Feinde (nicht verbuendet) |

Berechnet von: [groupActivity.calculateAlliances()](../services/encounter/groupActivity.md#calculatealliances)

Konsumiert von: [difficulty.simulatePMF()](../services/encounter/difficulty.md) via [combatResolver](../services/combatSimulator/combatResolver.md)

---

## EncounterGroup

```typescript
interface EncounterGroup {
  creatures: CreatureInstance[];
  leadNPC: NPC | null;
  activity: Activity;
  goal: GroupGoal;
  disposition: Disposition;
  narrativeRole: NarrativeRole;
}
```

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `creatures` | `CreatureInstance[]` | Kreaturen in dieser Gruppe |
| `leadNPC` | `NPC \| null` | Optionaler benannter Anfuehrer |
| `activity` | `Activity` | Was die Gruppe gerade tut |
| `goal` | `GroupGoal` | Narratives Ziel der Gruppe |
| `disposition` | `Disposition` | Haltung gegenueber der Party |
| `narrativeRole` | `NarrativeRole` | Rolle im Encounter (threat, ally, etc.) |

---

## DifficultyClassification

```typescript
interface DifficultyClassification {
  label: 'trivial' | 'easy' | 'moderate' | 'hard' | 'deadly';
  winProbability: number;
  tpkRisk: number;
  adjustments: Adjustment[];
}
```

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `label` | `EncounterDifficulty` | Schwierigkeitsstufe |
| `winProbability` | `number` | Party-Siegwahrscheinlichkeit (0.0-1.0) |
| `tpkRisk` | `number` | TPK-Risiko (0.0-1.0) |
| `adjustments` | `Adjustment[]` | Angewandte Balance-Anpassungen |

---

## EncounterPerception

```typescript
interface EncounterPerception {
  partyDetectsEncounter: number;   // Distance in feet
  encounterDetectsParty: number;   // Distance in feet
  isSurprise: boolean;
}
```

---

## GeneratedLoot

```typescript
interface GeneratedLoot {
  items: SelectedItem[];
  totalValue: number;
}
```

---

## Verwandte Schemas

- [creature.md](creature.md) - CreatureDefinition (Template)
- [npc.md](npc.md) - NPC (persistente benannte Instanz)
- [faction.md](faction.md) - Faction (Gruppenzugehoerigkeit)

---

## Lifecycle

```
1. Encounter-Service generiert EncounterInstance
2. sessionState speichert in state.encounter.current
3. GM interagiert (preview → active → resolving)
4. Nach Resolution wird EncounterInstance verworfen
```

EncounterInstance wird **nicht persistiert**. Bei Plugin-Reload geht ein aktiver Encounter verloren.

---

*Siehe auch: [Encounter-Pipeline](../services/encounter/Encounter.md) | [EncounterWorkflow](../orchestration/EncounterWorkflow.md)*
