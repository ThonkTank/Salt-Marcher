# CLAUDE.md

Guidance for Claude Code when working with this repository.

**Update when**: Adding workmodes, changing build commands, refactoring architecture, modifying key patterns.

## Project Overview

Salt Marcher is an Obsidian plugin for D&D 5e campaign management with hex-based cartography, entity libraries (creatures/spells/items), and session tools. Data stored as Markdown with YAML frontmatter.

## 🎯 Quick Start - Do This First

```bash
# 1. Run tests to understand current state
npm run test:all

# 2. Explore available tools
./devkit/core/cli/devkit              # Interactive REPL - discover commands

# 3. When debugging: Read CONSOLE_LOG.txt (NOT terminal output!)
tail -200 CONSOLE_LOG.txt             # Last 200 log lines
grep -i "error" CONSOLE_LOG.txt       # Find errors
```

**Essential Reading:**
- [devkit/README.md](devkit/README.md) - DevKit command reference & workflows ⭐
- [docs/TESTING.md](docs/TESTING.md) - Testing guide

## 🔧 Common Workflows

### Debugging Issues
```bash
./devkit workflow run fix-bug        # Automated debugging workflow
# OR manually:
./devkit debug enable --all          # Enable logging
./devkit reload                      # Reload plugin
# Reproduce issue, then:
tail -500 CONSOLE_LOG.txt            # Read logs
```

### Development
```bash
npm run build                        # Build plugin
./devkit reload watch                # Hot reload - auto-reload on changes ⭐
./devkit ui open creature aboleth    # Open entity editor
```

### Testing
```bash
npm run test:all                     # All tests (run before committing!) ⭐
./devkit test watch                  # Auto-run tests on file changes
./devkit workflow run test-entity    # End-to-end entity testing
```

### Validation
```bash
./devkit doctor                      # System health check ⭐
./devkit data validate creatures     # Validate preset schemas
./devkit validate                    # UI validation
```

**Full command reference**: [devkit/README.md](devkit/README.md)

## 📁 Architecture - Where Things Live

### Directory Structure
```
src/
├── workmodes/          # Self-contained applications (cartographer, library, session-runner)
├── features/
│   ├── data-manager/   # Generic CRUD (modal/browse/fields/storage)
│   └── maps/           # Hex rendering, terrain management
└── app/                # Plugin bootstrap (main.ts, ipc-server.ts, plugin-logger.ts)

Presets/                # Bundled preset data
├── lib/                # Registry, loaders, preset-data.ts (generated)
└── {EntityType}/       # Preset markdown files (Creatures/, Spells/, etc.)

devkit/                 # Development tools
├── core/cli/           # DevKit CLI (devkit.mjs)
├── testing/            # Unit & integration tests
└── docs/               # DevKit documentation
```

### Key Concepts

**CreateSpec Pattern** - Declarative entity definitions
- **Goal**: Single source of truth for entity structure (fields, storage, UI)
- **Where**: `src/workmodes/library/{entity}/create-spec.ts`
- **Auto-generates**: Browse view, actions, handlers from spec

**Registries** - Central entity metadata
- Entity specs: `src/workmodes/library/registry.ts`
- Preset metadata: `Presets/lib/entity-registry.ts`
- Plugin presets: `Presets/lib/plugin-presets.ts`

**Build Process**
- **Goal**: Bundle presets into plugin binary
- **Flow**: `generate-preset-data.mjs` → `Presets/lib/preset-data.ts` → `main.js`
- **Trigger**: Runs automatically on `npm run build`

**Library Data Flow**
- **Goal**: Transform WotC reference documents into usable preset data
- **Flow**: `/References` (WotC SRD) → Parser → `/Presets` (machine-readable data) → Vault (on plugin load)
- **Result**: Users have full access to modify library data in their vault

## 🛠️ Common Tasks

### Add New Entity Type
**Goal**: Extend library with new entity category (e.g., "Traps")

1. **Create spec**: `src/workmodes/library/{entity}/create-spec.ts`
2. **Create serializer**: `src/workmodes/library/{entity}/serializer.ts`
3. **Register**: Add to `src/workmodes/library/registry.ts`
4. **Add presets**: Update `Presets/lib/entity-registry.ts` and `plugin-presets.ts`
5. **Create folder**: `Presets/{EntityType}/`

**Or use**: `./devkit generate entity` (automated)

### Modify Entity Fields
**Goal**: Add/remove/change fields in entity editor

**Where**: `src/workmodes/library/{entity}/create-spec.ts` - `fields` array
**Auto-updates**: Browse view, modal, storage, validation

### Debug Field Behavior
**Goal**: Understand why a field isn't working correctly

```bash
./devkit debug field-state fieldId       # Inspect specific field
./devkit debug dump-fields creature      # Dump all fields
# Then read CONSOLE_LOG.txt for detailed logs
```

## 🧪 Testing Philosophy

**Goal**: Ensure changes don't break existing functionality

**Key Principle**: ALWAYS run tests before AND after changes

```bash
# Before changes: Understand current behavior
npm run test:all

# Make changes...

# After changes: Verify correctness
npm run test:all
```

**Test Types:**
- **Unit**: Fast, isolated (`npm test`)
- **Integration**: UI, IPC, data flow (`npm run test:integration`)
- **Contract**: CreateSpec validation (`npm run test:contracts`)

**When to update golden files**: Only when changes are INTENTIONAL
```bash
npm run golden:update
```

## 🐛 Debugging

**PRIMARY RESOURCE**: `CONSOLE_LOG.txt` in plugin root
- Contains ALL plugin logs (not just recent ones)
- Directly readable (no IPC required)
- Full stack traces and context
- Timestamps for timing issues

**NOT the terminal output** - DevKit CLI shows limited subset

```bash
# Good: Read CONSOLE_LOG.txt
tail -200 CONSOLE_LOG.txt
grep "\[init:" CONSOLE_LOG.txt

# Less useful: Terminal output (limited)
./devkit logs 200
```

**Enable detailed logging**:
```bash
./devkit debug enable --all          # Enable all categories
./devkit debug enable --field fieldId # Enable specific field
```

## 📚 Documentation Map

**For Quick Tasks** (what to do):
- [devkit/README.md](devkit/README.md) - DevKit command cheat sheet

**For Understanding Systems** (how things work):
- [docs/storage-formats.md](docs/storage-formats.md) - Entity storage & CreateSpec
- [docs/PRESETS.md](docs/PRESETS.md) - Preset bundling/import system
- [docs/TESTING.md](docs/TESTING.md) - Testing guide
- [docs/audio-system.md](docs/audio-system.md) - Audio/playlist system architecture (Phase 6)
- [docs/random-encounters.md](docs/random-encounters.md) - Random encounter generation & CR balancing (Phase 7)
- [docs/faction-system.md](docs/faction-system.md) - Faction entities, AI, locations, influence (Phase 8-9.1)
- [docs/PHASE_9_1_UI_INTEGRATION.md](docs/PHASE_9_1_UI_INTEGRATION.md) - Cartographer UI architecture (detailed)
- [docs/PHASE_9_1_QUICK_REFERENCE.md](docs/PHASE_9_1_QUICK_REFERENCE.md) - File locations & patterns (quick ref)
- [docs/weather-system.md](docs/weather-system.md) - Weather generation, climate templates, integration (Phase 10)
- [docs/TAGS.md](docs/TAGS.md) - Tag vocabularies across all entity types

**For DevKit Features** (available tools):
- [devkit/README.md](devkit/README.md) - Complete CLI reference & features

**For Troubleshooting**:
- [devkit/README.md](devkit/README.md) - DevKit troubleshooting section
- CONSOLE_LOG.txt - Live debugging logs

## 🎯 Development Principles

**Before changing code:**
1. Understand the system fully (read relevant code & docs)
2. Run tests to establish baseline behavior
3. Consider `./devkit backup create` for risky changes

**While working:**
- DRY: Don't Repeat Yourself - adapt existing code instead of duplicating
- Simple > Clever: Easier maintenance saves debugging time
- Use `./devkit test watch` for instant feedback
- Read CONSOLE_LOG.txt when debugging

**Before committing:**
- Run `npm run test:all` to verify all tests pass
- Validate UI if fields changed: `./devkit validate`
- Update docs if architecture changed
- Consider `./devkit hooks install` for automatic validation

**Documentation guidelines:**
- Focus on GOAL and LOCATION, not implementation details
- Keep file headers descriptive (purpose, not just filename)
- Update relevant docs with every change

## 🔑 Key Technical Patterns

- **Context Objects**: Dependency injection via function parameters
- **Repository Pattern**: Data access through repository functions
- **Lifecycle Handles**: Services return cleanup functions
- **Type-Safe Frontmatter**: `smType` field identifies entity types

## ⚠️ Important Constraints

**Technical:**
- Use Obsidian Vault API (not Node.js `fs`)
- Use `plugin-logger.ts` (logs to CONSOLE_LOG.txt, not console)
- German UI strings (historical) - managed via `translator.ts`
- Forward slashes `/` for paths (Obsidian normalizes automatically)
- Never bypass IPC for Obsidian interactions (use DevKit commands)
- CONSOLE_LOG.txt is the primary debugging resource (not terminal output)

**Code Quality:**
- DRY: Don't Repeat Yourself - halte dich immer daran
- Je simpler der Code, desto einfacher die Wartung
- Arbeite immer mit sauberen, langfristigen Lösungen statt schnellen hacks
- Wann immer möglich, adaptiere/generalisiere vorhandenen Code statt neuen zu schreiben
- Bevor du ein System änderst, stelle erst sicher dass du es vollständig verstehst
- **Development Philosophy**: Wir sind mitten im Development. Es gibt keine bestehenden User und nichts ist in Stein gemeißelt. Wir brauchen keine backwards compatibility, weil alles einfach direkt kompatibel gemacht werden kann. Statt conversions oder workarounds zu basteln kannst du einfach die grundstruktur anpassen.

**Documentation & Testing:**
- Nutze DevKit tools um Änderungen zu testen
- Halte relevante Dokumentation immer aktuell, bei allen Änderungen
- Stelle sicher, dass jedes Skript eine deskriptive Überschrift und kurze Zusammenfassung im Dateikopf hat
- Bei komplexeren Skripten, füge Zwischenüberschriften ein
- Dokumentation soll ZIEL und ORT zeigen, nicht nur beschreiben was passiert

**Problem Solving:**
- Wenn dir Probleme auffallen (fehlende Dokumentation, nicht funktionierende Befehle, bugs, smelly code etc.):
  - Behebe es sofort, wenn das Problem klein ist
  - Oder erstelle dir eine ToDo für später (nicht im Projekt, in der Konsole)
- Suche stets nach Möglichkeiten das Plugin in Architektur, Code und Wartbarkeit zu verbessern
- Versuche stets deine dev tools zu verbessern

Ziele:
- Salt Marcher soll Spielleitungen eine zentrale Oberfläche geben, in der Weltreise, Begegnungen und Stimmung nahtlos ineinander greifen und jede Aktion sofort spürbares Feedback liefert.
- **Cartographer**
  Wenn ich den Cartographer öffne, sehe ich eine farbcodierte Hexkarte: jede Kachel repräsentiert Terrain und Region, und ihre Informationen liegen in eigenen Markdown-Dateien, bleiben aber bei Interaktionen im Editor. Über den Modus-Schalter wähle ich zwischen Pinsel und Inspector: Der Pinsel erlaubt mir, per Brush mehrere Hexes zu bearbeiten, während der Inspector in der Seitenleiste die Tile-Daten anzeigt, ohne Dateien aufzurufen.  
  Im Pinselmodus wähle ich im Dropdown eine Region aus der Library, passe Radius und Brush-Einstellungen an und sehe beim Streichen sofortige Farbupdates; ein „Manage…“-Button führt direkt zur Regionsverwaltung. Der Inspector zeigt mir bei einem Klick auf ein Hex die aktuell hinterlegte Region, Terrain-Details und Notizen in einem Panel, sodass ich alles im Blick habe, ohne den Editor zu verlassen.  
  Als Erweiterungen plane ich Ortsmarker (Städte, Landmarken), sichtbare Fraktions-Einflussgebiete mit einstellbaren Begegnungschancen, und Overlays für Flüsse, Klippen, Höhenlinien sowie eine höhenbasierte Fog-of-War-Vorschau. Zusätzlich soll sich das Wetter pro Region anpassen lassen, damit unterschiedliche Zonen verschiedene Arten von Wetter haben, welches die Reisen im Session runner beeinflusst.
- **Library**  
  Die Library öffnet als zentrales Archiv mit Tabs für Kreaturen, Zauber, Items, Equipment, Terrains, Regionen und Kalender. Titelzeile, Sucheingabe und die einheitlichen Karten geben mir sofort einen Überblick, während ich per Tabs zwischen den Entitäten wechsle und in jedem Modus denselben Workflow vorfinde.  
  Über der Liste sitzen Filter- und Sortierleisten: ich kombiniere Attribute wie CR, Schule, Terrainfarbe oder Encounter-Odds, wechsle Sortierungen (Name, Seltenheit, Level etc.) und lasse mir so exakt die Datensätze anzeigen, die ich gerade brauche. Jede Karte bietet klar platzierte Aktionen für `Open`, `Edit` und `Delete`, und beim Bearbeiten führen geführte Formulare alle Felder durch und speichern direkt in strukturierte Markdown-Dateien.  
  Funktional gilt die Library als vollständig; künftige Arbeiten konzentrieren sich auf zusätzliche Tabs, verfeinerte Speicherformate, weiter ausgebaute Formulare sowie eine Zusatzoption „Speichern als“, die neben dem bestehenden Speichern-Button zur Verfügung stehen soll.
- **Session Runner**  
  Heute bietet der Session Runner einen Reise-Workflow: ich lade eine Cartographer-Karte, setze Wegpunkte, lasse Bewegungstempo und Routenverlauf berechnen und sehe in der Seitenleiste Fortschritt, Uhrzeit, Reiseereignisse und das aktuell simulierte Wetter, das automatisch aus den Hex-Daten aktualisiert wird. Direkt daneben hält eine kompakte Kalenderübersicht Datum, Tageszeit, aktuelle Wetterlage, astronomische Ereignisse und die nächsten anstehenden Events bereit, damit ich keine Vorbereitungslücke übersehe. Die Oberfläche bleibt bewusst reduziert, damit ich während der Sitzung schnell zwischen Karte, Route und Notizen wechseln kann.  
  Als nächstes soll der Session Runner direkt auf Cartographer-Daten zugreifen und Random Encounters aus Fraktionen, Einflussgebieten, Terrain, Wetter und markierten Orten generieren. Die Ergebnisse landen in einem Seitenfenster, das Monster-Statblocks, Initiative-Reihenfolge, Loot-Vorschläge, NPC-Profile und relevante Terrain-Features für die Battlemap bündelt, damit ich den Encounter ohne Umwege leiten kann.  
  Der Encounter-View übernimmt dabei mehr als nur importierte Zufallsbegegnungen: Ich kann Begegnungen ad hoc komponieren, indem ich aus Fraktionslisten, den auf dem aktuellen Hex präsenten NPCs (benannt wie unbenannt) sowie allen übrigen Statblöcken der Library auswähle. Während ich Gegner oder Verbündete hinzufüge, zeigt mir der Calculator live, wie fordernd das Setup im Vergleich zum Gruppenlevel ist, und ein Klick startet die Begegnung sofort im Arbeitsbereich.  
  Ergänzend plane ich einen Playlist-Manager mit minimaler Steuerfläche: Ambience und Musik stammen aus kuratierten Playlists, die automatisch nach Terrain, Wetter, Tageszeit, Ort, Fraktion und Situation gewählt werden, während ich jederzeit per Schnellzugriff pausieren, Skippen oder auf alternative Stimmungen wechseln kann.
- **Kalender**  
  Der Kalender hält Datum und Uhrzeit kampagnenweit synchron, verwaltet einmalige wie wiederkehrende Ereignisse und sorgt dafür, dass vorbereitete Trigger – von Festen über Fraktionsziele bis zu saisonalen Effekten – automatisch zur richtigen Zeit ausrollen. Im Almanac steuere ich alles zentral, entscheide welche Änderungen Karte, Library oder Session Runner erreichen und habe gleichzeitig im Session Runner eine kompakte Übersicht, die den aktuellen Status nur anzeigt (Details siehe Session Runner).  
  Der Almanac bringt dafür spezialisierte Ansichten mit: Monats-, Wochen- und Timeline-Modus bieten unterschiedliche Blickwinkel auf dieselben Ereignisse, während Editoren für Fraktionsziele, wiederkehrende Rituale, Mondphasen sowie andere astronomische oder saisonale Zyklen inklusive Vorlagen und Automatisierung bereitstehen. Ein Postfach sammelt neue, noch ungelesene Ereignisse nach Wichtigkeit sortiert, sodass ich nichts übersehe. Wenn der Kalender fortschreitet, aktualisiert er Wetter und Status auf dem aktiven Hex, stößt hinterlegte Notizen oder Encounter-Hooks an und hält so alle Workmodes im Gleichschritt.
- **Fraktionen**
  Fraktionen reichen von kleinen Wolfsrudeln über verschworene Kulte bis hin zu Königreichen – jede Fraktion besitzt Mitglieder (Statblocks aus der Library), deren verfügbare Anzahl im Hintergrund bilanziert wird, sodass irgendwann der letzte Goblinkrieger gefallen ist. Ziele, Werte und Kultur steuern ihre Entscheidungen: Eine einfache KI setzt Pläne um, passt Strategien an und erschafft neue Plot-Hooks, ohne dass der GM dauernd eingreifen muss. Auf der Karte errichten Fraktionen Camps oder andere POIs, die Einflusszonen ausbreiten. Der gesamte Mitgliederbestand – ob namenlose Trupps, benannte NPCs oder Unterfraktionen – wird positionsgenau verfolgt, sodass jederzeit klar ist, wie viele Einheiten ein Lager hält, welche Expedition unterwegs ist und wer als Verstärkung bereitsteht. Innerhalb dieser Orte besetzen Mitglieder Jobs: Sie schmieden Ausrüstung, sammeln Ressourcen, trainieren Milizen oder beschwören Verstärkung – sofern passende Gebäude aufgebaut und gewartet werden. Beziehungen zwischen Fraktionen entscheiden, ob Konflikte eskalieren oder Handelspreise purzeln (Angebot vs. Nachfrage), und Expeditionen ziehen über die Karte, wo die Gruppe ihnen begegnen, sie aushorchen oder ausrauben kann. All diese Simulationen laufen kontinuierlich im Hintergrund, damit die Welt lebendig bleibt: Gebiete wechseln die Hand, Lager entstehen, Geschichten reifen. Der GM erhält kompakte Zusammenfassungen in Karte, Session Runner und Kalender; wichtige Ereignisse wandern ausschließlich in den Kalender, damit Vorbereitung und Dramaturgie Schritt halten.
  - **Unterfraktionen**  
    Unterfraktionen verhalten sich wie eigenständige Fraktionen, sind aber organisatorisch einer Oberfraktion zugeordnet. Sie erben Ressourcen, Kultur und Einfluss, setzen zusätzliche Ziele und können sich stilistisch klar unterscheiden – etwa ein fanatischer Inquisitionszweig innerhalb eines Königreichs. Ihr Mitgliederbestand wird ebenfalls positionsgenau verfolgt, einschließlich der Frage, wie viele Einheiten in welchem Lager stationiert sind oder welche Expeditionen unterwegs sind; eigene Lager, Gebäude und Missionen sind möglich, sofern Mittel bereitstehen.
  - **NPCs**  
    Benannte Fraktionsmitglieder werden getrennt von anonymen Trupps verwaltet. Namen, Beschreibungen und Merkmale entstehen aus Listen für Spezies, Kultur und Fraktionsprägung, wodurch jeder NPC sofort Profil bekommt. Sie können Jobs übernehmen oder Expeditionen leiten, wobei Rollenerwartungen respektiert werden – ein König delegiert Logistik, statt im Dorf Mist zu schaufeln. Ihr Aufenthaltsort wird genauso protokolliert wie der der übrigen Mitglieder, damit klar bleibt, wer gerade vor Ort, auf Mission oder als Verstärkung verfügbar ist.
- **Orte**
  Orte sind einfache Beschreibungen, die sich zu einer Hierarchie verlinken lassen – Stadt → Viertel → Gebäude → Raum – und mir schnellen Zugriff auf jede Ebene geben. Jeder Ort kann einer Fraktion, Unterfraktion oder einem einzelnen NPC gehören; der Eintrag zeigt direkt, wer verantwortlich ist und welche Beziehungen oder Ressourcen daran geknüpft sind.
  Basierend auf Besitzer und Art unterhalten Orte Einflussbereiche auf der Karte, sodass sichtbar bleibt, wer ein Gebiet dominiert und welche Stimmung dort herrscht.
  Gebäude sind eine besondere Form von (Sub-)Ort: NPCs arbeiten dort, investieren Zeit und Ressourcen und stellen Gegenstände her oder warten Ausrüstung. Die Übersicht hält fest, welche Produktionsketten laufen und welche Kosten dafür anfallen.
  - **Dungeons**  
    Dungeons sind besondere Orte (oder Gebäude), die eine quadratische Kartenansicht mit klaren Rasterzellen nutzen. Alle wichtigen Elemente – Spieler- und NPC-Positionen, Türen, Fallen, Schätze, Möbel, Geländestufen – werden direkt als Tokens oder Marker auf der Karte eingezeichnet, sodass ich jederzeit eine visuelle Repräsentation der Situation habe. Bei Bedarf blendet ein optionales Overlay Fog of War und Geräuschradien ein, um Sicht- und Hörgrenzen abzubilden.
    Jeder Dungeon ist in Räume unterteilt. Ein Klick auf einen Raum öffnet im Seitenfenster eine strukturierte Beschreibung mit Sinneseindrücken (was man sieht, riecht, hört), einer Türliste sowie sämtlichen Features. Ausgänge tragen IDs wie `T1`, `T2`, `T3`, Features erhalten Markierungen `F1`, `F2`, `F3`, ergänzt um Typ-Kürzel (`G` für Geheimnisse, `H` für Hindernisse, `S` für Schätze). Tippe ich auf ein solches Label – sei es auf der Karte oder in der Liste – springt die Ansicht zur passenden Passage in der Raumbeschreibung.
    So arbeite ich mit einer nahtlosen Mischung aus visueller Karte und narrativem Detail: Ich sehe sofort, welche Türen offenstehen, welche Fallen scharf sind und wo sich Figuren gerade bewegen, während die Panel-Texte mir die volle atmosphärische Beschreibung liefern.
- **Calculator**  
   Der Calculator bildet das Regel-Backend für Begegnungen und Belohnungen. Encounter-Presets als Markdown-Dateien (`SaltMarcher/EncounterPresets`) legen Basissummen und Hausregeln fest – jede Regel hat einen Scope (`xp` oder `gold`), einen Modifikatortyp (flat, Prozent vom Gesamtwert, Prozent bis zur nächsten Stufe, pro Durchschnittslevel usw.), Min-/Max-Grenzen sowie optionale Notizen.
   Im Encounter-View arbeite ich direkt mit diesen Regeln: Basissumme setzen, Presets laden, Einträge per Drag & Drop ordnen, temporär deaktivieren oder feinjustieren und sofort sehen, wie sich der Breakdown auf einzelne Charaktere auswirkt. Der Store überwacht Level, XP-Stand und Resultat je Party-Mitglied und gleicht Werte gegen die D&D-Schwellen ab, damit Fehler auffallen.
   So kann ich handgebaute Begegnungen zuverlässig balancieren – und dieselben Regeln sorgen dafür, dass Random Encounters im Session Runner automatisch nach meinen Vorgaben die passenden Belohnungen ausrechnen.
- **Audio & Atmosphäre**
  Ein integrierter Audio-Player stellt kuratierte Playlists bereit, die sich nach Terrain, Wetter, Fraktionen und Encounter-Typ filtern lassen, damit die Stimmung ohne langes Suchen passt.  
  Während der Sitzung kann ich Stimmungen live wechseln: sanfte Fades, klare Statusanzeigen und gespeicherte Favoriten erleichtern spontane Übergänge.
- **Loot**  
  Loot orientiert sich an den XP der Begegnung: Gold, Handelswaren und magische Items werden über die Calculator-Regeln generiert, die Party-Level, Encounter-XP und selbst definierte Modifikatoren berücksichtigen. Der Generator zieht dafür aufbereitete Listen aus der Library heran, filtert nach Tags (z. B. „Sumpf“, „Untote“, „Ozean“) und sorgt dafür, dass Beute zur Location und den Gegnern passt.  
  Magische Items folgen Level-Limits, damit nicht jede Begegnung legendäre Artefakte ausspuckt, während Gold und wertvolle Waren linear mit XP und Charakterstufe skalieren. Viele Gegner bringen außerdem inhärente Beute mit: Drachen liefern Schuppen, Drow exotische Gifte, Konstrukte seltene Komponenten. Diese Werte stehen direkt im Statblock – inklusive des Anteils, den sie vom sonstigen Loot-Pool ersetzen – sodass ich sofort weiß, wie viel zusätzliche Beute noch verteilt wird.

## Architektur-Roadmap

**Status:** Phase 10.3 ✅ Complete | Tests: 1070/1070 (100%) ✅ | **Next:** Phase 10.4 - Weather Session Runner UI

**Abgeschlossen:**
- **Phase 0-4:** Tags/Schemas, Stores, Encounter (Travel→Combat E2E), Event Engine (Timeline/Inbox/Hooks)
- **Phase 5:** Loot Generator - Gold (XP-based, 5 rule types), Items (tag-filter, rarity-limits, weighted), E2E tests (13 scenarios)
- **Phase 6:** Audio System ✅ - See [docs/audio-system.md](docs/audio-system.md)
- **Phase 7:** Random Encounters ✅ - See [docs/random-encounters.md](docs/random-encounters.md)
- **Phase 8.1:** Faction System Foundation ✅ - See [docs/faction-system.md](docs/faction-system.md)
  - Member system with position tracking (hex/POI/expedition/unassigned)
  - Job system (crafting, gathering, training, summoning, guard, patrol, research)
  - Structured resources (gold, food, equipment, magic, influence)
  - Faction relationships with numeric values (-100 to +100)
- **Phase 8.2:** Faction AI & Simulation ✅ - See [docs/faction-system.md](docs/faction-system.md)
  - Decision-making AI: 14 decision types with priority weighting and goal evaluation
  - NPC generation: 6 culture templates, procedural names/profiles, personality traits
  - Simulation engine: Resource production/consumption, job processing, expedition events
  - Plot hook generation: 6 hook categories from decisions, events, and relationships
  - 70 new tests (AI: 13, Simulation: 17, NPC: 17, Plot Hooks: 23)
- **Phase 8.3:** Faction Integration & Automation (Stub Implementation) ✅ - See [docs/faction-system.md](docs/faction-system.md)
  - Integration helper functions: `getFactionMembersAtHex`, `getAllFactionCamps`, `runDailyFactionSimulation`
  - Architectural stubs with clear TODO markers for full implementation
  - 15 new integration tests demonstrating expected behavior
  - Foundation ready for encounter/calendar/map integration
- **Phase 8.4:** Full Faction Integration ✅ - See [docs/faction-system.md](docs/faction-system.md)
  - Full YAML parsing using js-yaml library (parses members, resources, relationships)
  - Coordinate system conversion: cube {q,r,s} → axial {q,r} → oddr {r,c}
  - POI→coordinate lookup via callback function pattern
  - Calendar date integration (ISO date string, elapsed days)
  - Persistence: Simulation results applied and saved back to faction files
  - Event generation with dates for calendar inbox
  - Updated integration tests with full YAML structures
- **Phase 8.5:** Advanced Faction Features ✅ - See [docs/faction-system.md](docs/faction-system.md)
  - Subfaction system: Organizational hierarchy with resource/culture inheritance, validation
  - Dynamic relationships: Action-based changes, natural decay, relationship propagation
  - Economic simulation: Market pricing (supply/demand), trade routes, buy/sell operations
  - Military simulation: Strength calculation, battles, sieges, casualties, morale, tactical AI
  - Diplomatic events: Treaty negotiation/violation/lifecycle, diplomatic events, negotiation
  - 122 new tests (Subfactions: 28, Relationships: 30, Economics: 22, Military: 22, Diplomacy: 20)
- **Phase 8.6:** Advanced Faction Features ✅ - See [docs/faction-system.md](docs/faction-system.md)
  - NPC Personality System: Procedural quirks (35+ templates), multi-layered loyalties, secrets, trust/ambition (0-100), betrayal detection
  - Advanced Economics: Production chains (6 templates), daily resource consumption, trade goods catalog (20+ items with categories/tags)
  - Advanced Military: Veterancy system (0-100, up to +50% bonus), equipment degradation/repair, supply lines with raid risk
  - Advanced Diplomacy: Secret treaties, espionage operations (5 types), diplomatic incidents (5 types), intelligence gathering
  - 69 new tests (NPC Personalities: 18, Advanced Features: 51)
- **Phase 8.7:** Further Advanced Features ✅ - See [docs/faction-system.md](docs/faction-system.md)
  - Complex NPC Networks: Dynamic relationship graphs (-100 to +100), cluster detection, cross-faction diplomacy influence, event generation (love triangles, betrayals, feuds)
  - Economic Markets: Regional markets with supply/demand pricing, market events (shortage/surplus/panic), price history/trends, economic cycles (4 phases), investment analysis
  - Advanced Supply Chains: Multi-step production dependencies, critical path analysis, bottleneck detection, parallelization optimization, chain events
  - Intelligence Networks: Persistent spy networks with agents/safe houses, intelligence gathering (5 types), counter-intelligence, false intel, covert operations
  - 85 new tests (NPC Networks: 25, Economic Markets: 22, Supply Chains: 18, Intelligence Networks: 20)
- **Phase 8.8:** Integration with Existing Systems ✅ - See [docs/random-encounters.md](docs/random-encounters.md#phase-88-faction-encounter-integration-)
  - Faction Encounter Integration: Faction members at hexes automatically included in random encounters
  - Coordinate conversion: odd-r → cube coordinates for faction lookup
  - Named NPCs and unit types spawn as combatants with proper stats
  - 2 new tests for hex coordinate integration
- **Phase 8.9:** Calendar Integration ✅ - See [docs/faction-system.md](docs/faction-system.md#phase-89-calendar-integration-)
  - FactionSimulationHook interface for decoupled integration
  - Automatic faction simulation on calendar day advancement
  - Factory function to wire up App instance with hook
  - Non-blocking error handling (simulation failures don't break time advancement)
  - 14 new tests for calendar-faction integration
- **Phase 9:** Location Integration & Influence System ✅ - See [docs/faction-system.md](docs/faction-system.md#phase-9-location-integration--influence-system-)
  - Location influence areas: 9 location types with radius/strength/decay configs
  - Coordinate parsing: odd-r and axial formats, hex distance calculations
  - Building production: 16 building templates across 6 categories
  - Job permissions, worker capacity, production rates, maintenance costs
  - Building bonuses: quality (+15-30%), training speed (+20-50%), research (+20-50%)
  - Building degradation and repair system (condition, maintenance overdue)
  - Location-faction integration: bidirectional ownership, worker management, validation
  - 68 new tests (influence: 25, buildings: 43)
- **Phase 9.1:** UI Integration ✅ - See [docs/faction-system.md#phase-91-ui-integration-](docs/faction-system.md#phase-91-ui-integration-)
  - Location influence overlays on cartographer map with color-coded strength
  - Inspector panel shows location influence info (strength, owner, type)
  - Reactive store pattern for map overlay updates
  - 17 new tests for location-influence-store
- **Phase 9.2:** Building Management Data Model ✅ - See [docs/faction-system.md#phase-92-building-management-data-model-](docs/faction-system.md#phase-92-building-management-data-model-)
  - Extended LocationData with building_production field (BuildingProduction interface)
  - Location create-spec with building fields (type, condition, maintenance, workers)
  - Browse view enhancement with building status badges (color-coded condition)
  - Serialization support for building production in markdown
  - Type guard isBuildingLocation() for type-safe checks
  - 11 new tests for type guards and serialization (100% pass rate)
- **Phase 9.1.2:** Inspector Building Display ✅ - See [docs/PHASE_9_1_UI_INTEGRATION.md#phase-912-building--worker-information-display-](docs/PHASE_9_1_UI_INTEGRATION.md#phase-912-building--worker-information-display-)
  - Cartographer inspector shows building details for locations with influence
  - Displays building type, condition (color-coded 🟢🟡🔴), worker count, maintenance status
  - Async location file loading with graceful error handling
  - Uses existing frontmatter utilities and type guards
  - No new tests (follows existing proven patterns)
- **Phase 9.2B:** Building Management UI ✅ - See [docs/faction-system.md#phase-92b-building-management-ui-](docs/faction-system.md#phase-92b-building-management-ui-)
  - Building management modal with CRUD operations for building state
  - Edit building condition (slider with live production rate calculation)
  - Edit maintenance overdue status
  - View/edit current worker count (validated against template max)
  - View allowed jobs and building bonuses
  - View/remove active jobs
  - View period production output
  - Save changes via Obsidian's processFrontMatter API
  - "Manage Building" button in cartographer inspector
  - No new tests (follows proven Obsidian Modal pattern)
- **Phase 9.2C:** Worker Assignment UI ✅ - See [docs/faction-system.md#phase-92c-worker-assignment-ui-](docs/faction-system.md#phase-92c-worker-assignment-ui-)
  - Load available faction members from vault (filters by location and job status)
  - Drag-and-drop interface for assigning/unassigning workers
  - Visual worker roster showing assigned and available members
  - Worker cards display name, faction, and role
  - Capacity validation (max workers per building)
  - Worker position and job updates persisted to faction files
  - Assign/unassign buttons for quick access
  - No new tests (follows proven modal patterns)
- **Phase 9.2D:** Production Visualization ✅ - See [docs/faction-system.md#phase-92d-production-visualization-](docs/faction-system.md#phase-92d-production-visualization-)
  - Production rate visualization with color-coded condition bars
  - Worker efficiency indicators with capacity warnings
  - Resource flow visualization with progress bars
  - Unified production dashboard combining all metrics
  - Pure HTML/CSS implementation (no external chart libraries)
  - 22 new tests for visualization components (100% pass rate)
- **Phase 10.1:** Weather System Core ✅ - See [docs/weather-system.md](docs/weather-system.md)
  - Weather state types and interfaces (WeatherState, WeatherCondition, ClimateTemplate) ✅
  - 6 climate templates: Arctic, Temperate, Tropical, Desert, Mountain, Coastal ✅
  - Procedural weather generator with Markov chain transitions ✅
  - Seeded RNG for deterministic generation ✅
  - Temperature, wind, precipitation, visibility calculations ✅
  - Season-aware weather probabilities and transitions ✅
  - Weather store with reactive hex-based state management ✅
  - Fixed test issues: svelte/store mock, temperature ranges, probabilistic test reliability ✅
  - 19 weather tests passing (100%)

- **Phase 10.2:** Weather Calendar Integration ✅ - See [docs/weather-system.md#phase-102](docs/weather-system.md#phase-102)
  - WeatherSimulationHook interface for decoupled calendar integration ✅
  - Automatic weather simulation on day advancement ✅
  - Day-of-year calculation for seasonal transitions ✅
  - ISO date string formatting (YYYY-MM-DD) ✅
  - Non-blocking error handling (weather failures don't break time) ✅
  - 32 new tests for weather-calendar integration (100% pass rate) ✅
  - Hex/region integration: Scans all map files for hexes with tiles ✅
  - Climate loading: Extracts climate tags from region metadata ✅
  - Climate mapping: Maps climate tags to climate templates (Arctic/Desert/Tropical/Mountain/Coastal/Temperate) ✅
  - Coordinate conversion: odd-r → cube coordinates for weather storage ✅
  - Fallback: Generates placeholder 3x3 grid when no maps exist ✅
  - Note: Weather event persistence to calendar inbox intentionally skipped (weather is transient state)

- **Phase 10.3:** Weather Encounter & Audio Integration ✅ - See [docs/weather-system.md](docs/weather-system.md#phase-103)
  - Weather tag mapper utility: Maps WeatherType to TAGS.md vocabulary ✅
  - Encounter context builder: Extracts weather from store, converts to tags ✅
  - Audio context extractor: Queries weather store for hex, returns primary tag ✅
  - Coordinate conversion: odd-r → cube for weather lookups ✅
  - Integration tests: 31 new tests (weather tag mapping: 15, encounter context: 7, audio context: 9) ✅

**Geplant:**
- **Phase 10.4:** Weather Session Runner UI
  - Weather panel component
  - Weather icon system
  - Travel movement modifiers
- **Phase 10.5:** Advanced Weather Features (Future)
  - Weather forecasting (predict next 3 days)
  - Extreme weather events (hurricanes, blizzards)
  - Player-controlled weather (Control Weather spell)

**Aktuelle TODOs (Priorität):**

**CRITICAL (Feature komplett kaputt/unbrauchbar):**
None currently! All blocking issues resolved. ✅

**HIGH (Feature fehlt oder stark beeinträchtigt):**
1. **[HIGH] Encounter Edit Workflow Broken** - Cannot edit encounters unless random encounter triggered first
   - User cannot use feature without workaround
   - Needs investigation: Why is editor bound to random encounter trigger?
   - Location: encounter-gateway.ts or encounter view initialization
2. **[HIGH] Almanac Frontend Missing** - Calendar has no UI, completely unusable
   - Backend fully implemented (Phase 8.9 ✅)
   - Goal specifies "Monats-, Wochen-, Timeline-Modus" but none exist
   - Need: Month/week/timeline views, event editor, astronomical cycles UI
   - Location: src/workmodes/almanac/ (missing view components)
3. **[HIGH] Phase 9.2B Resource Integration** - Building repair ignores resource costs
   - Currently: Repair is free, no faction resource deduction
   - Need: Deduct gold/materials from faction resources on repair
   - Location: building-management-modal.ts:234 (TODO comment)
4. **[HIGH] Library Tabs Missing** - Location, Playlist, Encounter Tables non-functional
   - Tabs exist in UI but no browse views implemented
   - Goal: "Tabs für Kreaturen, Zauber, Items, Equipment, Terrains, Regionen und Kalender"
   - Need: Create specs + serializers for Location, Playlist, EncounterTable entities
   - Location: src/workmodes/library/registry.ts

**MEDIUM (Feature unvollständig aber teilweise nutzbar):**
5. **[MEDIUM] POI Integration Missing** - Cannot place location markers on map
   - Goal: "Ortsmarker (Städte, Landmarken)" in Cartographer
   - Phase 9 Location system fully implemented but no UI access
   - Need: Cartographer mode for placing/editing location markers
   - Location: Cartographer brush/inspector modes
6. **[MEDIUM] Cartographer Brush Error** - Brush mode logs error messages
   - Terrain-brush functionality potentially broken, needs real testing
   - Location: Cartographer terrain-brush mode
7. **[MEDIUM] Phase 9.2C Worker Validation** - Worker assignment ignores allowed jobs
   - Workers assignable regardless of building job compatibility
   - Need: Validate worker.job ∈ buildingTemplate.allowedJobs
   - Location: worker-assignment-modal.ts validation logic

**LOW (Nice-to-have, Verbesserungen):**
8. **[LOW] Phase 9.2 Error Handling** - Building management modal lacks comprehensive error handling
9. **[LOW] Calendar Inbox Integration** - calendar-state-gateway.ts TODO: Add faction events to calendar inbox
10. **[LOW] Encounter Presenter Path Resolution** - presenter.ts:442 uses hardcoded path `SaltMarcher/Creatures/${creature.name}.md`
   - Currently assumes creature files are in standard location
   - Need: Get actual file path from vault lookup or repository
   - Location: src/workmodes/encounter/presenter.ts:442
11. **[LOW] [UX] Building Management Modal - No Keyboard Support** - Modal lacks keyboard navigation
   - No escape key to close, no tab navigation between sections
   - Drag-and-drop only, no keyboard alternative for worker assignment
   - Location: src/workmodes/cartographer/building-management-modal.ts
12. **[LOW] [UX] Building Management Modal - No Loading States** - Async operations lack feedback
   - Worker loading shows no spinner/placeholder while loading factions
   - Save operation has no loading indicator during vault writes
   - Location: building-management-modal.ts:86-133 (loadAvailableWorkers), :618-653 (saveChanges)
13. **[LOW] [UX] Building Management Refresh - Inspector Doesn't Auto-Update** - User must re-select hex
   - After saving building changes, inspector panel shows stale data
   - onSave callback logs but doesn't refresh display
   - Location: inspector.ts:310-314
14. **[LOW] [UX] Production Visualization - No Interactivity** - Charts are static displays
   - Progress bars show data but no hover tooltips or click interactions
   - No way to see historical trends or detailed breakdowns
   - Location: src/features/locations/production-visualization.ts
15. **[LOW] 22 Feature TODOs** - Intentional placeholders for future work (weather extraction, time-of-day, UI improvements)

**Test-Status:**
- Unit tests: 1070/1070 passing (100%) ✅
  - Audio tests: 57/57 ✅
  - Playlist tests: 17/17 ✅
  - Encounter tests: 26/26 ✅
  - Faction tests: 391/391 ✅ (fixed 2 flaky probabilistic tests)
  - Location tests: 118/118 ✅
  - Building/Production tests: 22/22 ✅
  - Weather tests: 20/20 ✅ (Phase 10.1 complete)
  - Weather calendar integration: 32/32 ✅ (Phase 10.2 complete)
  - Weather tag mapper: 15/15 ✅ (Phase 10.3 complete)
  - Weather encounter integration: 7/7 ✅ (Phase 10.3 complete)
  - Weather audio integration: 9/9 ✅ (Phase 10.3 complete)
  - Header policy: 1/1 ✅ (AGENTS.md check removed)
- Integration tests: 6 require live Obsidian (expected, documented limitation)

**Nächste Schritte (Empfehlung):**
1. **[HIGH] Fix Broken User Features** - Core functionality unusable
   - Encounter edit workflow (investigate why editor requires random encounter trigger)
   - Almanac frontend implementation (month/week/timeline views, event editors)
   - Library tabs (Location/Playlist/EncounterTable specs + serializers)
2. **[MEDIUM] Complete Partial Features** - Working but incomplete
   - POI placement UI in Cartographer (location system ready, needs UI mode)
   - Cartographer Brush debugging (investigate error messages)
   - Building repair resource costs (deduct from faction resources)
   - Worker assignment validation (enforce allowed jobs)
3. **[PLANNED] Phase 10.3: Weather Encounter & Audio Integration** - Next planned phase
   - Update encounter-context-builder with weather extraction
   - Update audio context-extractor with weather
   - Weather tag mapping to tag vocabulary
