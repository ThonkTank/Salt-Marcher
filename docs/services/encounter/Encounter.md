# Encounter-System

> **Modulare Dokumentation:**
> - [Initiation](Initiation.md) - Step 1: Trigger, Context-Erstellung, Feature-Aggregation, Hazard-Schema
> - [Population](Population.md) - Steps 2-3: Tile-Eligibility, Templates, Multi-Gruppen
> - [Flavour](Flavour.md) - Step 4: NPCs, Activity, Goals, Loot, Perception
>   - [NPC-Generation](../NPCs/NPC-Generation.md) - Sub-Dokument: NPC-Generierung
>   - [NPC-Matching](../NPCs/NPC-Matching.md) - Sub-Dokument: Existierenden NPC finden
> - [Difficulty](Difficulty.md) - Step 5: Kampfsimulation, Win%/TPK-Klassifizierung
> - [Adjustments](Adjustments.md) - Step 6: Machbarkeits-Anpassung
> - [Publishing](Publishing.md) - Step 7: Output-Events, Schemas, Konsumenten

Unified Entry-Point fuer Encounter-Generierung und Ablauf.

---

## Design-Philosophie

### Welt-Unabhaengigkeit

Die Spielwelt existiert **unabhaengig von der Party**. Kreaturen werden basierend auf Tile-Eligibility ausgewaehlt - nicht nach Party-Level gefiltert. Ein Drache kann erscheinen, auch wenn die Party Level 3 ist.

### Difficulty durch Kampfsimulation

**Ziel-Difficulty wird gewuerfelt, dann Encounter angepasst.** Population erstellt party-unabhaengige Encounters. Flavour fuegt Activity, Loot und Perception hinzu. Difficulty simuliert den Kampf mit Probability Mass Functions (PMF) und klassifiziert basierend auf Siegwahrscheinlichkeit und TPK-Risiko. Adjustments passt das Encounter an die gewuerfelte Difficulty an.

### Machbarkeit durch Umstaende

Schwierige Encounters werden durch **Umstaende** (Environment, Distance, Activity, Disposition) an die Party-Faehigkeiten angepasst - nicht durch Aenderung der Kreatur-Stats.

---

## 7-Step Generation Pipeline

```
+-----------------------------------------------------------------------------+
|  1. TRIGGER                                                                  |
|     Externes System loest Encounter aus (Travel, Quest, Manual)             |
|     -> Initiation.md                                                         |
+-----------------------------------------------------------------------------+
|  2. SEED-KREATUR-AUSWAHL                                                     |
|     Terrain + Tageszeit -> Filter                                           |
|     Fraktion + Raritaet + Wetter -> Gewichtete Zufallsauswahl               |
|     -> Population.md#tile-eligibility                                        |
+-----------------------------------------------------------------------------+
|  3. STANDARD-ENCOUNTER ERSTELLEN                                             |
|     Seed-Kreatur -> Template-Matching -> Gruppengroessen bestimmen          |
|     -> Population.md#template-system                                         |
+-----------------------------------------------------------------------------+
|  4. FLAVOUR HINZUFUEGEN                                                      |
|     Activity + Goal waehlen, Lead-NPC instanziieren, Loot, Perception       |
|     -> Flavour.md                                                            |
+-----------------------------------------------------------------------------+
|  5. DIFFICULTY BERECHNEN                                                     |
|     PMF-basierte Kampfsimulation -> Win% + TPK-Risk -> Klassifizierung      |
|     -> Difficulty.md                                                         |
+-----------------------------------------------------------------------------+
|  6. MACHBARKEITS-ANPASSUNG                                                   |
|     6.0: Ziel-Difficulty wuerfeln (Terrain-Threat)                          |
|     6.1: Beste Option waehlen bis Ziel erreicht                             |
|     -> Adjustments.md                                                        |
+-----------------------------------------------------------------------------+
|  7. PUBLIZIERUNG                                                             |
|     encounter:generated Event (sticky)                                       |
|     -> Publishing.md                                                         |
+-----------------------------------------------------------------------------+
```

---

## Workflow-Kurzuebersicht

### Step 1: Initiation → [Initiation.md](Initiation.md)
Externes System loest Encounter aus, Context wird aufgebaut.

| Sub-Step | Beschreibung | Sektion |
|----------|--------------|---------|
| 1.1 Trigger | Event empfangen (travel, location, quest, manual, time) | [Trigger-Typen](Initiation.md#trigger-typen) |
| 1.2 Context | Tile, Time, Weather, Party aus State holen | [Context-Erstellung](Initiation.md#context-erstellung) |
| 1.3 Features | Terrain + Weather + Indoor Features aggregieren | [Feature-Aggregation](Initiation.md#feature-aggregation) |

**Output:** `EncounterContext`

---

### Step 2: Seed-Auswahl → [Population.md](Population.md)
Eine Kreatur als "Centerpiece" des Encounters bestimmen.

| Sub-Step | Beschreibung | Sektion |
|----------|--------------|---------|
| 2.1 Filter | Terrain + Tageszeit filtern (Hard Requirements) | [Tile-Eligibility](Population.md#step-21-tile-eligibility) |
| 2.2 Gewichtung | Faction + Raritaet + Wetter gewichten (Soft Factors) | [Gewichtung](Population.md#gewichtung-soft-factors) |
| 2.3 Auswahl | Gewichtete Zufallsauswahl der Seed-Kreatur | [Seed-Kreatur-Auswahl](Population.md#step-22-seed-kreatur-auswahl) |

**Output:** `Creature` (Seed)

---

### Step 3: Population → [Population.md](Population.md)
Encounter mit Kreaturen befuellen.

| Sub-Step | Beschreibung | Sektion |
|----------|--------------|---------|
| 3.1 Multi-Group | Zufallsentscheidung ob 2 Gruppen (~17%) | [Multi-Group-Encounters](Population.md#multi-group-encounters) |
| 3.2 Template | Faction- oder generisches Template waehlen | [Template-Matching](Population.md#step-32a-single-group-template-matching) |
| 3.3 Slots | Template-Rollen mit Kreaturen befuellen | [Slot-Befuellung](Population.md#step-33-slot-befuellung) |
| 3.4 Finalisierung | Gruppen mit NarrativeRole zusammenfuehren | [Gruppen-Finalisierung](Population.md#step-34-gruppen-finalisierung) |

**Output:** `EncounterDraft`

---

### Step 4: Flavour → [Flavour.md](Flavour.md)
RP-Details pro Gruppe hinzufuegen.

| Sub-Step | Beschreibung | Sektion |
|----------|--------------|---------|
| 4.1 Activity | Was macht die Gruppe gerade? (Pool → Filter → Auswahl) | [Activity-Generierung](Flavour.md#step-41-activity-generierung) |
| 4.2 Goal | Ziel aus Activity + NarrativeRole ableiten | [Goal-Ableitung](Flavour.md#step-42-goal-ableitung) |
| 4.3 NPCs | Lead-NPC (1/Gruppe, persistiert) + Highlight-NPCs (max 3 global) | [NPC-Instanziierung](Flavour.md#step-43-npc-instanziierung) |
| 4.4 Loot | Aus Creature.defaultLoot wuerfeln, Kreaturen zuweisen | [Loot-Generierung](Flavour.md#step-44-loot-generierung) |
| 4.5 Perception | initialDistance aus Activity + Terrain + Weather berechnen | [Perception-Berechnung](Flavour.md#step-45-perception-berechnung) |

**Output:** `FlavouredEncounter`

---

### Step 5: Difficulty → [Difficulty.md](Difficulty.md)
Kampfsimulation und Difficulty-Klassifizierung.

| Sub-Step | Beschreibung | Sektion |
|----------|--------------|---------|
| 5.0 Setup | Grid, Positionen, Resource Budget | [Setup](Difficulty.md#setup) |
| 5.1 Simulation | Runden-weise PMF-Berechnung | [Simulation](Difficulty.md#simulation) |
| 5.2 Outcome | Siegwahrscheinlichkeit, TPK-Risk | [Outcome](Difficulty.md#outcome) |
| 5.3 Klassifizierung | Win% + TPK → Difficulty | [Klassifizierung](Difficulty.md#klassifizierung) |

**Output:** `SimulationResult`

---

### Step 6: Adjustments → [Adjustments.md](Adjustments.md)
Ziel-Difficulty wuerfeln und Encounter anpassen.

| Sub-Step | Beschreibung | Sektion |
|----------|--------------|---------|
| 6.0 Ziel | Ziel-Difficulty wuerfeln (Terrain-Threat) | [Ziel-Difficulty](Adjustments.md#step-60-ziel-difficulty-wuerfeln) |
| 6.1 Optionen | Verfuegbare Anpassungen sammeln (Distance, Disposition, Environment, Activity) | [Optionen sammeln](Adjustments.md#optionen-sammeln) |
| 6.2 Algorithmus | Beste Option waehlen, die Win% am naechsten zum Ziel bringt | [Anpassungs-Algorithmus](Adjustments.md#anpassungs-algorithmus) |
| 6.3 Multi-Group | Bei Multi-Group: Save-Logik fuer Ally-Staerke | [Save-Logik](Adjustments.md#save-logik) |

**Output:** `BalancedEncounter`

---

### Step 7: Publishing → [Publishing.md](Publishing.md)
Encounter publizieren und GM-Entscheidung ermoeglichen.

| Sub-Step | Beschreibung | Sektion |
|----------|--------------|---------|
| 7.1 Instance | EncounterInstance mit ID, State, Timestamps erstellen | [EncounterInstance](Publishing.md#encounterinstance) |
| 7.2 Event | `encounter:generated` (sticky) publizieren | [Lifecycle-Events](Publishing.md#lifecycle-events) |
| 7.3 Preview | GM sieht Preview → Start / Dismiss / Regenerate | [Konsumenten](Publishing.md#konsumenten) |

**Output:** `EncounterInstance` + Event

---

## Detail-Dokumentation

Die vollstaendige Dokumentation jedes Steps findet sich in den verlinkten Subdokumenten:

| Step | Dokument | Kerninhalt |
|:----:|----------|------------|
| 2-3 | [Population.md](Population.md) | Tile-Eligibility, Seed-Auswahl, Templates, Multi-Group, Slot-Befuellung |
| 4 | [Flavour.md](Flavour.md) | Activity, Goal, NPCs, Loot, Perception (Sweet-Spot/Pain-Point) |
| 5 | [Difficulty.md](Difficulty.md) | PMF-Simulation, Disposition, Gruppen-Relationen, Klassifizierung |
| 6 | [Adjustments.md](Adjustments.md) | Anpassungs-Algorithmus, Save-Logik, Multi-Group als Anpassung |
| 7 | [Publishing.md](Publishing.md) | EncounterInstance, Lifecycle-Events, Konsumenten, Attrition |

---

## Prioritaet

| Komponente | MVP | Post-MVP |
|------------|:---:|:--------:|
| 7-Step Pipeline | X | |
| XP-Modifikatoren (Environment, Distance, Disposition, Activity) | X | |
| XP-Modifier: GroupRelations (Multi-Group) | X | |
| XP-Modifier: Loot (magische Items) | X | |
| Ziel-Difficulty wuerfeln (Terrain-Threat) | X | |
| Machbarkeits-Anpassung | X | |
| Tile-Eligibility (Filter + Gewichtung) | X | |
| Faction-Encounter-Templates | X | |
| NPC-Instanziierung + Persistierung | X | |
| NPC-Position-Tracking (lastKnownPosition) | X | |
| Activity-Entity-Typ (in Library) | X | |
| Feature-Entity-Typ (in Library) | X | |
| Combat-Role Distance Sweet-Spots | X | |
| Terrain-Features mit Role-Modifiers | X | |
| Hazard-Definitionen | | X |
| Pfad-basierte Creature-Pools | | X |

**Neue Entity-Typen:**
- `activity` (#18) - Kreatur-Activities mit Properties (awareness, mobility, focus)
- `feature` (#19) - Terrain/Environment-Features mit Modifiern

→ Entity-Registry: [EntityRegistry.md](../../architecture/EntityRegistry.md)

---

*Siehe auch: [NPC-Generation](../NPCs/NPC-Generation.md) | [Creature](../../data/creature.md) | [Combat-System](../Combat-System.md) | [Travel-System](../Travel-System.md)*


## Tasks

| # | Status | Domain | Layer | Beschreibung | Prio | MVP? | Deps | Spec | Imp. |
|--:|:------:|--------|-------|--------------|:----:|:----:|------|------|------|
