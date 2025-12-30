# NPCs Service

> **Verantwortlichkeit:** NPC-Management fuer Encounters, Quests und POIs
> **Schema:** [npc.md](../../entities/npc.md)
>
> **Untermodule:**
> - [NPC-Matching.md](NPC-Matching.md) - Existierenden NPC finden
> - [NPC-Generation.md](NPC-Generation.md) - NPC automatisch generieren
> - [Culture-Resolution.md](Culture-Resolution.md) - Kultur-Aufloesung fuer NPC-Generierung

Der NPC-Service verwaltet das Matching und die Generierung von NPCs. Matching prueft ob ein existierender NPC wiederverwendet werden kann. Generation erzeugt neue NPCs mit Namen, Persoenlichkeit und Hintergrund.

---

## Ueberblick

```
NPC-Service
├── NPC-Matching     → Existierenden NPC finden
├── NPC-Generation   → Neuen NPC erzeugen
└── Culture-Resolution → Kultur-Kette aufloesen
```

---

## Datenfluss

```
Aufrufer (encounterNPCs, Quest, Shop, POI)
│
├── findMatchingNPC(creatureId, factionId?, position?)
│   └── Gibt Option<NPC> zurueck
│
└── generateNPC(creature, faction?, options?)
    └── Gibt NPC zurueck
```

---

## Consumer

| Consumer | Nutzung |
|----------|---------|
| encounterNPCs.ts | Match oder Generate fuer ausgewaehlte Kreaturen |
| Quest-System | NPCs fuer Quest-Objectives |
| Shop-System | Ladenbesitzer-NPCs |
| POI-System | Ortsgebundene NPCs |

---

## Tasks

| # | Status | Domain | Layer | Beschreibung | Prio | MVP? | Deps | Spec | Imp. |
|--:|:------:|--------|-------|--------------|:----:|:----:|------|------|------|
| 28 | ⬜ | NPCs | services | NPC-Matching: factionId undefined als fraktionsuebergreifend behandeln | mittel | Nein | - | NPC-Matching.md#Faction-Matching | - |
| 36 | findExistingNPC: Basis-Matching (creature.id + factionId + status) | mittel | Nein | - | mittel | Nein | - | NPC-Matching.md#Match-Kriterien | - |
| 37 | NPC-Priorisierung: Distanz (primaer) + lastEncounter (sekundaer) | mittel | Nein | - | mittel | Nein | - | NPC-Matching.md#Priorisierung | - |
| 48 | generateNPC: Delegation an npcGenerator-Service | mittel | Nein | - | mittel | Nein | - | NPC-Generation.md#API | - |
| 53 | ⬜ | NPCs | services | Culture-Resolution: Forbidden-Listen implementieren | mittel | Nein | - | Culture-Resolution.md#Forbidden-Listen | - |
| 54 | ⬜ | NPCs | services | Culture-Resolution: Faction-Ketten-Traversierung via parentId | mittel | Nein | - | Culture-Resolution.md#buildFactionChain() | - |
| 55 | ⬜ | NPCs | services | Quirk-Filterung: compatibleTags aus Creature pruefen | mittel | Nein | - | NPC-Generation.md#Quirk-Generierung | - |
| 56 | ⬜ | NPCs | services | PersonalityBonus: Multiplikatoren auf Goals anwenden | mittel | Nein | - | NPC-Generation.md#PersonalGoal-Pool-Hierarchie | - |

---

## Siehe auch

- [NPC-Lifecycle.md](../../features/NPC-Lifecycle.md) - Status-Updates nach Match/Generation
- [Encounter.md](../encounter/encounter.md) - Encounter-Pipeline (nutzt NPC-Service)
