# Encounter-System

> **Modulare Dokumentation:**
> - [Initiation](Initiation.md) - Step 1: Trigger, Context-Erstellung, Feature-Aggregation, Hazard-Schema
> - [Population](Population.md) - Steps 2-3: Tile-Eligibility, Templates, Multi-Gruppen
> - [Flavour](Flavour.md) - Step 4: NPCs, Activity, Goals, Loot, Perception
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
| 1 | [Initiation.md](Initiation.md) | Trigger-Typen, Context-Erstellung, Feature-Aggregation, Hazard-Schema |
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

*Siehe auch: [NPC-System](../../domain/NPC-System.md) | [Creature](../../domain/Creature.md) | [Combat-System](../Combat-System.md) | [Travel-System](../Travel-System.md)*


## Tasks

| # | Status | Domain | Layer | Beschreibung | Prio | MVP? | Deps | Spec | Imp. |
|--:|:------:|--------|-------|--------------|:----:|:----:|------|------|------|
| 3258 | ✅ | Encounter | prototype | CLI REPL-Framework mit readline implementieren Konformität hergestellt: - PipelineState verwendet jetzt getypte Interfaces statt unknown - Import aus prototype/types/encounter.ts statt lokaler Definition Verhalten jetzt: - context: EncounterContext - draft: EncounterDraft - flavoured: FlavouredEncounter - difficulty: DifficultyResult - balanced: BalancedEncounter | hoch | Nein | - | prototypes/encounter.md | prototype/cli.ts: - parseCommand() - Befehl/Args/Flags parsen - executeCommand() - Command-Dispatch - COMMANDS Record - Befehlshandler - main() - REPL-Loop mit readline - PipelineState Import aus types/encounter.ts (typisiert) prototype/types/encounter.ts: - PipelineState Interface (unverändert, bereits korrekt typisiert) - Alle Pipeline-Output-Typen verwendet |
| 3259 | ✅ | Encounter | prototype | Preset-Loader für creatures, terrains, templates, factions, parties Deliverables: - [x] loadCreatures() lädt 29 Kreaturen - [x] loadTerrains() lädt 8 Terrains - [x] loadTemplates() lädt 6 Templates - [x] loadFactions() lädt 8 Fraktionen - [x] loadParty() erstellt PartySnapshot mit 4 Charakteren - [x] loadAllPresets() gibt vollständiges PresetCollection zurück - [x] inspect Befehl im CLI funktioniert DoD: - [x] TypeScript kompiliert ohne Fehler - [x] CLI zeigt Presets korrekt an | hoch | Nein | - | prototypes/encounter.md | prototype/loaders/preset-loader.ts: - loadCreatures() - 29 Kreaturen aus base-creatures.json - loadTerrains() - 8 Terrains aus base-terrains.json - loadTemplates() - 6 Templates aus bundled-templates.json - loadFactions() - 8 Fraktionen aus base-factions.json - loadParty() - PartySnapshot mit 4 Charakteren - loadAllPresets() - Vollständige PresetCollection - createLookup() - Map-basierter Lookup-Helper - createPresetLookups() - Alle Lookups gebündelt prototype/loaders/index.ts: - Re-Export aller Funktionen und Typen prototype/cli.ts: - inspect Befehl erweitert (creatures, terrains, templates, factions, party) |
| 3261 | ✅ | Encounter | prototype | Pipeline-Typen (EncounterContext, EncounterDraft, FlavouredEncounter, etc.) Umgesetzt: - Alle 5 Pipeline-Output-Typen (EncounterContext, EncounterDraft, FlavouredEncounter, DifficultyResult, BalancedEncounter) - Hilfstypen (TimeSegment, CreatureSize, CreatureDisposition, DifficultyLevel, NarrativeRole) - Entity-Typen fuer Prototyp (Terrain, Creature, WeatherState, PartySnapshot, Feature, Faction) - Template-Typen (EncounterTemplate, TemplateSlot) - Group-Typen (CreatureGroup, FlavouredGroup, Activity, Goal, LootItem, GeneratedNpc) - PipelineState Interface (typisiert statt unknown) Keine Abweichungen von Spec. | hoch | Nein | - | prototypes/encounter.md | prototype/types/encounter.ts: - Pipeline-Output-Typen (EncounterContext, EncounterDraft, FlavouredEncounter, DifficultyResult, BalancedEncounter) - Entity-Typen (Terrain, Creature, WeatherState, PartySnapshot, Feature, Faction) - Template-Typen (EncounterTemplate, TemplateSlot) - Group-Typen (CreatureGroup, FlavouredGroup, Activity, Goal) - PipelineState Interface prototype/types/index.ts: - Re-Export aller Typen |
| 3262 | ✅ | Encounter | prototype | Step 1: Initiation - Context aus CLI-Args erstellen Deliverables: - [x] createContext() Funktion in pipeline/initiation.ts - [x] handleInitiate() Command Handler in commands/initiate.ts - [x] CLI-Integration mit PresetLookups - [x] Validierung für Terrain, TimeSegment, Trigger DoD: - [x] npx tsx prototype/cli.ts startet ohne Fehler - [x] initiate --terrain forest --time midday erstellt EncounterContext - [x] state zeigt den Context korrekt an - [x] Fehler bei ungültigem Terrain/Time werden angezeigt - [x] TypeScript kompiliert ohne Fehler | mittel | Nein | #3258, #3259, #3261 | prototypes/encounter.md, features/encounter/Initiation.md | prototype/pipeline/initiation.ts: - createContext(options, lookups) - Erstellt EncounterContext - isValidTimeSegment(), isValidTrigger() - Validierung - getAvailableTimeSegments(), getAvailableTriggers() - Hilfstext prototype/commands/initiate.ts: - handleInitiate(args, flags, state, lookups) - CLI Handler - Validiert --terrain und --time Flags - Speichert context in PipelineState prototype/cli.ts: - PresetLookups beim Start laden - initiate Handler integriert prototype/pipeline/index.ts, prototype/commands/index.ts: - Re-Exports |
| 3263 | 🔒 | Encounter | prototype | Steps 2-3: Population - Tile-Eligibility, Seed-Auswahl, Template-Matching, Slot-Befüllung. NICHT KONFORM: Template-Matching nutzt compatibleTags statt Design-Role-Kapazitätsprüfung. Neue Spec: Templates haben slots mit designRole (Pflicht), Auswahl prüft ob Faction genug Kreaturen jeder Rolle hat. | mittel | Nein | #3262 | prototypes/encounter.md, features/encounter/Population.md | prototype/pipeline/population.ts, prototype/commands/populate.ts |
| 3264 | 🔶 | Encounter | prototype | Konformität hergestellt: - NarrativeRole: primary/ally/rival/bystander → threat/victim/neutral/ally - Activity-Pool: buildActivityPool() nutzt jetzt GENERIC + Creature.activities + Faction.activities - Goal-Ableitung: deriveGoal() prüft Faction.activityGoals vor DEFAULT_GOALS_BY_ROLE Verhalten jetzt: - NarrativeRole entspricht Spec (Flavour.md:214-218) - Activity-Pool-Hierarchie implementiert (Flavour.md:117-123) - Faction-spezifische Goal-Mappings funktionieren (Flavour.md:199-211) | mittel | Nein | #3263 | prototypes/encounter.md, features/encounter/Flavour.md | prototype/types/encounter.ts: - NarrativeRole: 'threat' / 'victim' / 'neutral' / 'ally' - Creature.activities?: WeightedActivityRef[] - FactionCulture.activityGoals?: Record<string, string> prototype/pipeline/flavour.ts: - DEFAULT_GOALS_BY_ROLE angepasst für neue Rollen - buildActivityPool(creatures, faction, lookups) mit 3-stufiger Hierarchie - deriveGoal(activity, role, faction) mit activityGoals-Prüfung - selectActivity() und flavourGroup() Signaturen angepasst prototype/pipeline/population.ts: - narrativeRole: 'primary' → 'threat' |
| 3265 | ✅ | Encounter | prototype | Step 5 (vereinfacht): CR-basierte Difficulty-Berechnung. Deliverables: (1) CR_TO_XP Mapping (CR 0-30), (2) XP_THRESHOLDS (Level 1-20), (3) Gruppen-Multiplikatoren (1-15+), (4) calculateXPReward(), (5) calculateAdjustedXP(), (6) classifyDifficulty(), (7) estimateWinProbability(), (8) estimateTPKRisk(), (9) handleDifficulty() CLI Command | mittel | Nein | #3264 | prototypes/encounter.md, features/encounter/Difficulty.md | prototype/pipeline/difficulty.ts: CR_TO_XP, XP_THRESHOLDS, getGroupMultiplier(), calculateBaseXP(), calculatePartyThresholds(), classifyByThreshold(), estimateWinProbability(), estimateTPKRisk(), calculateDifficulty() / prototype/commands/difficulty.ts: handleDifficulty() / prototype/cli.ts: difficulty Command integriert |
| 3266 | 🔒 | Encounter | prototype | Step 6: Adjustments - Ziel-Difficulty + Best-Option-Algorithmus. Deliverables: (1) rollTargetDifficulty() Terrain-Threat Normalverteilung, (2) getTargetWinProbability() Difficulty→Win%, (3) adjustForFeasibility() iterativer Algorithmus, (4) collectAdjustmentOptions() mit Distance/Disposition/Environment/Activity-Optionen, (5) AdjustmentOption Interface, (6) BalancedEncounter Output-Schema. Implementiert: Alle Deliverables umgesetzt, adjust CLI-Command funktioniert. | mittel | Nein | #3265 | prototypes/encounter.md, features/encounter/Adjustments.md | prototype/pipeline/adjustments.ts, prototype/commands/adjust.ts |
| 3267 | ⛔ | Encounter | prototype | generate-Befehl: Vollständige Pipeline mit einem Aufruf | mittel | Nein | #3266 | prototypes/encounter.md | prototype/commands/generate.ts |
| 3268 | ⬜ | Encounter | prototype | Step 5 (vollständig): PMF-Kampfsimulation. Deliverables: 5.1.a calculateMovement() Vektor-Bewegung, 5.1.b selectAction() EV-gewichtet, 5.1.c parseDiceNotation()/convolveDie() PMF, 5.1.d applyConditionLayers(), 5.1.e applyDamageToHP() HP-Konvolution, 5.2 calculatePartyWinProbability()/calculateTPKRisk(), 5.3 classifyDifficulty()/calculateFinalDifficulty() | mittel | Nein | #3265 | prototypes/encounter.md, features/encounter/Difficulty.md | prototype/pipeline/difficulty.ts |
| 3269 | ⛔ | Encounter | prototype | Multi-Group-Support: Dual-Group, NarrativeRole, Dual-Hostile, GroupRelations. Deliverables: Step 3.1 Multi-Group-Entscheidung (~17% Chance), Step 3.2b Zweite Gruppe (Seed aus Pool, Template, Slots), NarrativeRole (Seed=threat, Zweite=threat/neutral/ally), Dual-Hostile (beide threat, Drei-Wege-Konflikt), GroupRelations Baseline | mittel | neutral | #3266 | docs/prototypes/encounter.md, features/encounter/Population.md, features/encounter/Difficulty.md#gruppen-relationen-calculaterelations | prototype/pipeline/population.ts, prototype/pipeline/difficulty.ts | #3266 | prototypes/encounter.md, features/encounter/Population.md | prototype/pipeline/population.ts, prototype/pipeline/adjustments.ts |
| 3270 | ✅ | Encounter | prototype | Loot-System: Tag-Matching + Budget + Hoard + Multi-Group + Quest-Budget. Deliverables: (1) Tag-Matching: Item.lootTags ↔ Creature.lootTags, (2) Budget-Berechnung: encounterBudget (10-50%), Soft-Cap, Schulden-Handling, (3) DefaultLoot + Tag-Loot Orchestrierung, (4) Hoard-Wahrscheinlichkeit: Boss=70%, Camp=40%, Patrol=10%, Passing=0%, (5) Multi-Gruppen-Loot: Pro Gruppe separat, budgetShare, (6) Quest-Budget-Reduktion: Wenn Quest-Reward definiert | mittel | Nein | #3264 | prototypes/encounter.md, features/Loot-Feature.md | prototype/types/encounter.ts: Item, DefaultLootEntry, GeneratedLoot, LootBudgetState, SelectedItem, EncounterType Interfaces prototype/loaders/preset-loader.ts: loadItems(), PresetLookups.items prototype/pipeline/flavour.ts: generateGroupLoot(), generateTagBasedLoot(), maybeGenerateHoard(), calculateEncounterBudget() prototype/commands/flavour.ts: --budget Flag prototype/output/text-formatter.ts: Loot-Anzeige mit Items und totalValue presets/creatures/base-creatures.json: defaultLoot für goblin, goblin-boss, hobgoblin, bugbear, wolf |
| 3271 | ✅ | Encounter | prototype | Feature-Modifier-Schema: FeatureModifier, CreatureProperty für Difficulty-Berechnung Deliverables: - [x] CreatureProperty Type mit 16 Werten (Movement, Senses, Design Roles) - [x] FeatureModifier Interface (target + value) - [x] Feature.modifiers als FeatureModifier[] (optional) - [x] Feature.description als optional DoD: - [x] TypeScript kompiliert ohne Fehler | mittel | Nein | #3261 | features/encounter/Initiation.md | prototype/types/encounter.ts: Feature.modifiers erweitern auf FeatureModifier[], CreatureProperty Type hinzufügen |
| 3272 | ✅ | Encounter | prototype | Hazard-Schema: HazardDefinition, HazardTrigger, HazardEffect, SaveRequirement, AttackRequirement | niedrig | Nein | #3271 | features/encounter/Initiation.md | prototype/types/encounter.ts: Feature.hazard hinzufügen, HazardDefinition, HazardTrigger, HazardEffect, SaveRequirement, AttackRequirement Types |
| 3282 | ⛔ | Encounter | prototype | Step 6 Erweiterung: Creature-Slot-Anpassungen. Deliverables: (1) CreatureSlotOption Interface (add/remove/swap), (2) collectCreatureSlotOptions() Anzahl/Swap/Cross-Group, (3) getAlternativeCreatures() Companion-Pool+designRole, (4) generateCrossGroupOptions() Multi-Group-Verschiebung | mittel | Nein | #3266, #3269 | features/encounter/Adjustments.md#creature-slot-anpassungen | prototype/pipeline/adjustments.ts |
| 3283 | ⛔ | Encounter | prototype | Step 6 Erweiterung: Ally-Staerke-Berechnung. Deliverables: (1) AllyStrengthResult Interface, (2) calculateAllyStrengthModifier() CR-zu-Level Ratio, (3) calculateAverageGroupCR(), (4) getEffectivePartyStrength() angepasste Thresholds | mittel | Nein | #3266, #3269 | features/encounter/Adjustments.md#ally-staerke-formel | prototype/pipeline/adjustments.ts |
| 3284 | ⛔ | Encounter | prototype | Daily-XP-Budget-Tracking. Deliverables: (1) DailyXPTracker Interface, (2) calculateDailyBudget() 6-8 Medium/Tag, (3) Budget-Reset bei Long Rest | mittel | Nein | #3266 | features/encounter/Adjustments.md#daily-xp-budget-tracking | prototype/pipeline/adjustments.ts |
| 3285 | ✅ | Encounter | prototype | Output-Formatter (JSON + formatierter Text) Umgesetzt: - json-formatter.ts: formatJson(), formatContextJson(), formatDraftJson(), formatFlavouredJson(), formatDifficultyJson(), formatBalancedJson(), formatStateJson() - text-formatter.ts: formatContextText(), formatDraftText(), formatFlavouredText(), formatDifficultyText(), formatBalancedText(), formatStateText() mit lesbarerer Ausgabe - index.ts: Re-Exports, createFormatter(mode) Factory, Formatter Interface - cli.ts: replConfig State, set --json/--text Befehl, state Befehl nutzt Formatter Keine Abweichungen von Spec. | mittel | Nein | #3261 | docs/prototypes/encounter.md | prototype/output/json-formatter.ts, prototype/output/text-formatter.ts, prototype/output/index.ts, prototype/cli.ts |