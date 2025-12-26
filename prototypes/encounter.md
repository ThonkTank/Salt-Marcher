# Encounter Pipeline CLI Prototyp

CLI-Prototyp zum Testen der 7-Step Encounter-Generierungs-Pipeline.

---

## Installation & Start

```bash
# Interaktives REPL
npx tsx prototype/cli.ts

# Batch-Modus (fuer automatisierte Tests)
npx tsx prototype/cli.ts --batch "cmd1" "cmd2" "cmd3"
```

---

## Batch-Modus

Der Batch-Modus ermoeglicht nicht-interaktives Testen der Pipeline:

```bash
# Vollstaendiger Pipeline-Test
npx tsx prototype/cli.ts --batch \
  "initiate --terrain forest --time dusk" \
  "populate" \
  "state"

# Mit spezifischer Seed-Kreatur
npx tsx prototype/cli.ts --batch \
  "initiate --terrain forest --time dusk" \
  "populate --seed goblin --verbose"

# Mehrere Terrains testen
for terrain in forest mountain swamp; do
  npx tsx prototype/cli.ts --batch \
    "initiate --terrain $terrain --time midday" \
    "populate" \
    "state"
done
```

**Vorteile:**
- Keine readline-Interaktion noetig
- Skript-kompatibel
- Einfache Integration in Testskripte

---

## Verfuegbare Befehle

### Pipeline-Befehle

| Befehl | Beschreibung | Flags |
|--------|--------------|-------|
| `initiate` | Step 1: EncounterContext erstellen | `--terrain <id>`, `--time <segment>`, `--trigger <type>` |
| `populate` | Steps 2-3: Seed + Template auswaehlen | `--seed <creature-id>`, `--verbose` |
| `flavour` | Step 4: NPCs, Activity, Loot | (nicht implementiert) |
| `difficulty` | Step 5: Schwierigkeit berechnen | (nicht implementiert) |
| `adjust` | Step 6: An Ziel-Difficulty anpassen | `--target <difficulty>` (nicht implementiert) |
| `generate` | Vollstaendige Pipeline | (nicht implementiert) |

### Utility-Befehle

| Befehl | Beschreibung |
|--------|--------------|
| `state` | Aktuellen Pipeline-State anzeigen |
| `clear` | Pipeline-State zuruecksetzen |
| `inspect <target>` | Presets anzeigen (creatures, terrains, templates, factions, party) |
| `set --json\|--text` | Output-Modus wechseln |
| `help` | Hilfe anzeigen |
| `exit` | REPL beenden |

---

## Pipeline-State

Der CLI-Prototyp verwaltet einen Pipeline-State mit folgenden Stufen:

```
┌─────────────┬─────────────────────────────────────────────────────┐
│ Stufe       │ Beschreibung                                        │
├─────────────┼─────────────────────────────────────────────────────┤
│ context     │ EncounterContext (Terrain, Time, Party, Features)   │
│ draft       │ EncounterDraft (Seed, Template, Groups)             │
│ flavoured   │ FlavouredEncounter (NPCs, Activity, Loot)           │
│ difficulty  │ SimulationResult (Win%, TPK-Risk)                   │
│ balanced    │ BalancedEncounter (Anpassungen angewendet)          │
└─────────────┴─────────────────────────────────────────────────────┘
```

Jeder Schritt baut auf dem vorherigen auf. Aenderungen in frueheren Schritten loeschen nachfolgende Stufen automatisch.

---

## Beispiel-Session

### Interaktiv

```
$ npx tsx prototype/cli.ts
Loading presets...
Loaded: 29 creatures, 8 terrains, 6 templates, 8 factions

============================================================
  Encounter Pipeline REPL
  Tippe "help" fuer verfuegbare Befehle
============================================================

encounter> initiate --terrain forest --time dusk

=== EncounterContext Created ===

  Terrain:     Forest (forest)
  Time:        dusk
  Trigger:     manual
  Party Size:  4 (avg level 5)

encounter> populate

=== EncounterDraft Created ===

  Seed:        Goblin (CR 0.25)
  Template:    Kriegs-Trupp (goblin-warband)
  Source:      Faction
  Multi-Group: No

  Creatures:
    12x Goblin (CR 0.25)
    1x Hobgoblin (CR 0.5)
    1x Goblin-Boss (CR 1)

encounter> exit
```

### Batch

```bash
$ npx tsx prototype/cli.ts --batch "initiate --terrain forest --time dusk" "populate" "state"
Loading presets...
Loaded: 29 creatures, 8 terrains, 6 templates, 8 factions

> initiate --terrain forest --time dusk

=== EncounterContext Created ===
...

> populate

=== EncounterDraft Created ===
...

> state

=== Pipeline State ===
  Context:       SET
  Draft:         SET
  Flavoured:     -
  Difficulty:    -
  Balanced:      -
...
```

---

## Architektur

```
prototype/
├── cli.ts                 # REPL + Batch-Modus Entry Point
├── types/
│   └── encounter.ts       # Alle TypeScript-Interfaces
├── loaders/
│   ├── preset-loader.ts   # JSON-Preset-Loading
│   └── index.ts
├── pipeline/
│   ├── initiation.ts      # Step 1 Core-Logik
│   ├── population.ts      # Steps 2-3 Core-Logik
│   └── index.ts
├── commands/
│   ├── initiate.ts        # initiate Command Handler
│   ├── populate.ts        # populate Command Handler
│   └── index.ts
└── output/
    ├── text-formatter.ts  # Text-Output
    ├── json-formatter.ts  # JSON-Output
    └── index.ts
```

---

## Presets

Die CLI laedt Presets aus dem `presets/`-Verzeichnis:

| Preset | Pfad | Anzahl |
|--------|------|--------|
| Creatures | `presets/creatures/base-creatures.json` | 29 |
| Terrains | `presets/terrain/bundled-terrains.json` | 8 |
| Templates | `presets/encounter-templates/bundled-templates.json` | 6 |
| Factions | `presets/factions/base-factions.json` | 8 |
| Party | `presets/party/test-party.json` | 4 |

---

## Implementierungsstand

| Step | Status | Befehl |
|------|:------:|--------|
| 1. Initiation | ✅ | `initiate` |
| 2-3. Population | ✅ | `populate` |
| 4. Flavour | ⬜ | `flavour` |
| 5. Difficulty | ⬜ | `difficulty` |
| 6. Adjustments | ⬜ | `adjust` |
| 7. Publishing | ⬜ | `publish` |
| Full Pipeline | ⬜ | `generate` |
