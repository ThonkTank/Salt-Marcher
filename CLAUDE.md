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
- [docs/almanac-system.md](docs/almanac-system.md) - Calendar management, time advancement, event scheduling (Phase 12)
- [docs/TAGS.md](docs/TAGS.md) - Tag vocabularies across all entity types

**For DevKit Features** (available tools):
- [devkit/README.md](devkit/README.md) - Complete CLI reference & features

**For Troubleshooting**:
- [devkit/README.md](devkit/README.md) - DevKit troubleshooting section
- CONSOLE_LOG.txt - Live debugging logs

## 🎯 Development Principles 🔒

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

## ⚠️ Important Constraints 🔒

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

## 🎯 Ziele 🔒
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

## 📊 Priority Definitions (Standard für Auto-Continue System)

Diese Prioritätsdefinitionen gelten einheitlich für alle Auto-Continue Phasen (A, B, C, D):

- **CRITICAL**: Feature komplett kaputt oder unbrauchbar, blockiert Kernfunktionalität, verhindert Plugin-Start oder verursacht Abstürze
  - Beispiel: "TypeError verhindert das Laden aller Kreaturen"

- **HIGH**: Wichtiges Feature fehlt oder ist stark beeinträchtigt, beeinflusst User-Workflow erheblich, verwirrende UX die zu häufigen Fehlern führt
  - Beispiel: "Weather Panel zeigt falsche Daten an"

- **MEDIUM**: Feature unvollständig aber teilweise nutzbar, suboptimale UX die zu viele Schritte erfordert, nicht-blockierende Bugs oder Inkonsistenzen, DevKit-Erweiterungen
  - Beispiel: "Building Capacity Warnung zeigt sich erst nach Fehler"

- **LOW**: Nice-to-have Verbesserungen, Code-Refactoring oder Cleanup, kleine Politur oder Konsistenz-Fixes
  - Beispiel: "Hover-Tooltips zu Production Charts hinzufügen"

## Architektur-Roadmap

**Status:** Phase 13 Priority 2 Complete ✅ (Event Editor) | Tests: 1148/1149 (99.9%) ⚠️ | **Next:** Phase B (Implementation - 37 UX issues documented)

**Abgeschlossen:**
- **Phase 0-4:** Tags/Schemas, Stores, Encounter (Travel→Combat E2E), Event Engine (Timeline/Inbox/Hooks)
- **Phase 5:** Loot Generator - Gold (XP-based, 5 rule types), Items (tag-filter, rarity-limits, weighted), E2E tests (13 scenarios)
- **Phase 6:** Audio System ✅ - See [docs/audio-system.md](docs/audio-system.md)
- **Phase 7:** Random Encounters ✅ - See [docs/random-encounters.md](docs/random-encounters.md)
- **Phase 8.1-8.9:** Faction System Complete ✅ - See [docs/faction-system.md](docs/faction-system.md) (390+ tests)
- **Phase 9-9.2D:** Location & Building System Complete ✅ - See [docs/faction-system.md](docs/faction-system.md) (118+ tests)
- **Phase 10.1-10.4:** Weather System Complete ✅ - See [docs/weather-system.md](docs/weather-system.md) (147 tests)
- **Phase D (1st-2nd Run):** UX Reviews Complete ✅ (multiple runs validated)
- **Phase D (3rd Run):** UX Review Complete ✅ (Nov 1, 2025 - validated, no new issues)
- **Phase 11.1:** Weather Panel Interactivity ✅ (6 tests)
- **Phase 12.1:** Almanac MVP ✅ (8 tests) - Functional time display, events list, controls
- **Phase 12.2:** Almanac MVP Interactivity ✅ - Fixed minute increment, event editor modal placeholder
- **Phase 12.3:** Library Tabs Verification ✅ - All tabs implemented (locations: 134 tests, playlists: 17, encounter-tables: 10)
- **Phase 12.4:** Month View Calendar ✅ - Grid layout, event indicators, view switching (6 new tests)
- **Phase A (4th Run):** Quality Audit Complete ✅ (Nov 1, 2025 - One test failing, code duplication found)
- **Phase C (5th Run):** Documentation Review Complete ✅ (Nov 1, 2025 - Phase 12.4 documentation updated, roadmap revised)
- **Phase A (5th Run):** Quality Audit Complete ✅ (Nov 1, 2025 - Tests 1130/1131 passing, no system errors, 27 [UX] tasks identified)
- **Phase D (5th Run):** UX Review Complete ✅ (Nov 1, 2025 - Verified Phases 11.1 and 12.1-12.4, all UX issues already documented)
- **Phase A (6th Run):** Quality Audit Complete ✅ (Nov 1, 2025 - Tests 1129/1131 passing, 1 probabilistic test failure, 27 [UX] tasks remain, Phase D needed)
- **Phase 13 Priority 1:** Vault Data Integration ✅ (Nov 1, 2025 - Almanac MVP now loads/persists calendar state from vault)
- **Phase D (6th Run):** UX Review Complete ✅ (Nov 1, 2025 - Verified Phase 13 Priority 1, found 10 new LOW-priority UX issues in Almanac components, total: 37 UX issues documented)
- **Phase 13 Priority 2:** Event Editor Implementation ✅ (Nov 1, 2025 - Full event creation/editing modal with form validation, recurrence patterns, 18 tests)

**Geplant:**
- **Phase 10.5:** Advanced Weather Features (Future)
  - Weather forecasting (predict next 3 days)
  - Extreme weather events (hurricanes, blizzards)
  - Player-controlled weather (Control Weather spell)

**Aktuelle TODOs (Priorität):**

**CRITICAL (Feature komplett kaputt/unbrauchbar):**
None currently! All blocking issues resolved. ✅

**HIGH (Feature fehlt oder stark beeinträchtigt):**
2. **[HIGH] Almanac Full Implementation Missing** - MVP + Month View + Vault Integration + Event Editor functional, additional features needed ⚠️
   - ✅ Phase 12.1-12.4 MVP Complete - basic time display, upcoming events, advance controls, month grid view with event indicators, view switching
   - ✅ Phase 13 Priority 1 Complete - vault data integration (loads calendar from vault, persists time advances)
   - ✅ Phase 13 Priority 2 Complete - event editor (full form, validation, single/recurring events, 18 tests)
   - Still missing (Phase 13 Priority 3-7):
     - Week/timeline calendar grid views with event visualization
     - Month navigation controls (prev/next month buttons)
     - Astronomical cycles UI (moon phases, eclipses, etc.)
     - Event inbox with priority sorting
     - Search functionality implementation
   - Current: Full event CRUD in UI, vault persistence working, event editor functional with all recurrence patterns
   - Location: src/workmodes/almanac/view/ (event-editor-modal.ts: 562 lines, fully implemented)
   - See: [docs/almanac-system.md](docs/almanac-system.md) for detailed status

**MEDIUM (Feature unvollständig aber teilweise nutzbar):**
4. **[MEDIUM] POI Integration Missing** - Cannot place location markers on map
   - Goal: "Ortsmarker (Städte, Landmarken)" in Cartographer
   - Phase 9 Location system fully implemented but no UI access
   - Need: Cartographer mode for placing/editing location markers
   - Location: Cartographer brush/inspector modes
5. **[MEDIUM] Cartographer Brush Error** - Brush mode logs error messages
   - Terrain-brush functionality potentially broken, needs real testing
   - Location: Cartographer terrain-brush mode
6. **[MEDIUM] [UX] Almanac - No Keyboard Shortcuts** - All interactions require mouse
   - No keyboard shortcuts for common actions (advance time, navigate events)
   - Arrow keys don't navigate event list, Space/Enter don't activate
   - Location: src/workmodes/almanac/view/ (all components)
7. **[MEDIUM] [UX] Weather History/Forecast - Collapsed by Default** - Users might miss these features
   - History and forecast sections hidden on load (line 132-133)
   - No visual cue that content is collapsible (no ▶ icon on headers)
   - Users need to discover collapse functionality by trial
   - Location: src/workmodes/session-runner/travel/ui/weather-panel.ts:132-133
8. **[MEDIUM] [UX] Building Management - Unclear Capacity Warnings** - Capacity limits not visible until error
   - User only sees "max capacity" Notice after clicking Assign
   - Need: Show visual capacity indicator (e.g., "Workers: 3/5") prominently in worker section
   - Location: building-management-modal.ts:489-491
9. **[MEDIUM] [UX] Building Status - Unclear Condition Impact** - User doesn't understand what condition affects
   - Shows "Condition: 75%" without explaining gameplay impact
   - Need: Add helper text like "Condition affects production rate and durability"
   - Location: building-management-modal.ts:195-212
10. **[MEDIUM] [UX] Production Dashboard - No Units Displayed** - Production shows percentages without context
   - Shows "75%" but unclear what this percentage represents
   - Need: Show actual values (e.g., "7.5 Gold/day at 75% efficiency")
   - Location: production-visualization.ts
11. **[MEDIUM] [UX] Weather Details - Categorical Values Lack Precision** - Some values show categories instead of numbers
   - Precipitation: "Mäßiger Niederschlag" (what mm/h?), Visibility: "Gut" (how many meters?)
   - Players wanting precise values for calculations can't get them
   - Need: Show both category and exact value: "Mäßiger Niederschlag (5 mm/h)" or add tooltip
   - Location: weather-icons.ts:117-133
12. **[MEDIUM] [UX] Weather Icon - No Severity Indication** - Icon shows type but not severity
   - "Regen" icon looks same for light drizzle and torrential downpour
   - Only text label shows severity, less scannable UI
   - Need: Visual severity indicator (icon size, color, badge, or animation)
   - Location: weather-panel.ts:118-124
13. **[MEDIUM] [UX] Weather Update Timing Not Visible** - Users don't know when weather will change
   - No indication of how long current weather lasts
   - No "next update in X hours" display
   - Critical for multi-day travel planning
   - Need: Show weather duration/next change time
   - Location: weather-panel.ts (entire component)

**LOW (Nice-to-have, Verbesserungen):**
14. **[LOW] [UX] Almanac Events List - No Filtering/Sorting** - All events shown without organization
   - No way to filter by category (Event vs Phenomenon)
   - No sorting options (by date, type, priority)
   - Large event lists would be overwhelming
   - Location: src/workmodes/almanac/view/upcoming-events-list.ts
15. **[LOW] [UX] Weather History Display - No Visual Trend** - Just a list of past conditions
   - Shows 7 days of weather but no visual indication of trends
   - No icons or color coding for quick scanning
   - Hard to spot patterns (e.g., "it's been raining all week")
   - Location: src/workmodes/session-runner/travel/ui/weather-panel.ts:248-281
16. **[LOW] Phase 9.2 Error Handling** - Building management modal lacks comprehensive error handling
17. **[LOW] Building Modal Refactoring** - Large file size (889 lines)
   - Single file handles all building management UI
   - Could benefit from component extraction (worker cards, production dashboard)
   - Impact: Maintainability concern, but works fine
   - Location: src/workmodes/cartographer/building-management-modal.ts
18. **[LOW] Weather Panel - Hardcoded German Strings** - Not using translator.ts
   - Weather panel uses German UI text directly (e.g., "Wetter", "Temperatur", "Reiseeffekte")
   - Inconsistent with translator.ts system used elsewhere (though German strings are per codebase convention)
   - Location: src/workmodes/session-runner/travel/ui/weather-panel.ts
19. **[LOW] Calendar Inbox Integration** - calendar-state-gateway.ts TODO: Add faction events to calendar inbox
20. **[LOW] Encounter Presenter Path Resolution** - presenter.ts:442 uses hardcoded path `SaltMarcher/Creatures/${creature.name}.md`
   - Currently assumes creature files are in standard location
   - Need: Get actual file path from vault lookup or repository
   - Location: src/workmodes/encounter/presenter.ts:442
21. **[LOW] [UX] Building Management Modal - No Keyboard Support** - Modal lacks keyboard navigation
   - No escape key to close, no tab navigation between sections
   - Drag-and-drop only, no keyboard alternative for worker assignment
   - Location: src/workmodes/cartographer/building-management-modal.ts
22. **[LOW] [UX] Building Management Modal - No Loading States** - Async operations lack feedback
   - Worker loading shows no spinner/placeholder while loading factions
   - Save operation has no loading indicator during vault writes
   - Location: building-management-modal.ts:86-133 (loadAvailableWorkers), :618-653 (saveChanges)
23. **[LOW] [UX] Building Management Refresh - Inspector Doesn't Auto-Update** - User must re-select hex
   - After saving building changes, inspector panel shows stale data
   - onSave callback logs but doesn't refresh display
   - Location: inspector.ts:310-314
24. **[LOW] [UX] Save Button - No Unsaved Changes Warning** - User can close without saving
   - unsavedChanges flag exists but not used for exit confirmation
   - Need: Warn user on modal close if unsavedChanges === true
   - Location: building-management-modal.ts:42
25. **[LOW] Time-of-Day Extraction Placeholder** - encounter-context-builder hardcodes "day"
   - TODO comment at line 133: Extract time from current in-game time
   - Currently always returns "day" regardless of actual calendar time
   - Need: Integration with calendar state to get actual time of day
   - Location: src/workmodes/session-runner/util/encounter-context-builder.ts:133-135
26. **[LOW] [UX] Production Visualization - No Interactivity** - Charts are static displays
   - Progress bars show data but no hover tooltips or click interactions
   - No way to see historical trends or detailed breakdowns
   - Location: src/features/locations/production-visualization.ts
27. **[LOW] [UX] Weather Speed Modifier Color Coding - Thresholds Arbitrary** - Color thresholds might not match user perception
   - Green ≥90% (only -10% or less), Yellow 70-89%, Red <70%
   - 80% speed might feel quite impactful but shows as "warning" yellow
   - Need: User testing to refine thresholds or make configurable
   - Location: weather-panel.ts:151-157
28. **[LOW] [UX] Weather Panel - No Animation or Transitions** - Weather updates instantly
   - No fade-in/out, no loading state, jarring when rapidly clicking hexes
   - Feels less professional
   - Need: Smooth fade transition between weather states
   - Location: weather-panel.ts:99-135
29. **[LOW] [UX] Weather Panel - Redundant "Reiseeffekte" Section** - Section header with only one item
   - "Reiseeffekte" section with only speed modifier takes vertical space
   - Implies more effects might exist
   - Need: Either add more effects or remove section header, just show speed modifier directly
   - Location: weather-panel.ts:74-84
30. **[LOW] [UX] Weather Panel - Missing Accessibility Features** - Screen reader and keyboard support lacking
   - No `aria-live` region for weather updates (screen readers won't announce changes)
   - No `role="region"` on panel, no `aria-label` on icon
   - Panel cannot receive keyboard focus (no shortcuts to jump to weather)
   - Need: Add ARIA labels, live regions, semantic markup
   - Location: weather-panel.ts (entire component)
31. **[LOW] [UX] Weather Change Notification Missing** - Silent weather updates
   - Weather can change during travel without visual feedback
   - No alert when severe weather arrives
   - Need: Toast notification or highlight when weather changes
   - Location: weather-panel.ts (entire component)
32. **[LOW] [UX] Manual vs Travel Encounters Not Distinguished** - UI doesn't show encounter source
   - Users can't tell if encounter was manually composed or travel-generated
   - No visual indicator for encounter type (manual/travel/faction)
   - Could cause confusion when reviewing encounter history
   - Location: src/workmodes/encounter/ (view components)
33. **[LOW] Almanac Time Handler Duplication** - Three nearly-identical time advance handlers
   - handleAdvanceDay, handleAdvanceHour, handleAdvanceMinute differ only by unit parameter
   - Each contains identical logic for logging, advanceTime call, and updateAllViews()
   - Impact: Minimal - only 3 handlers, works correctly, easy to maintain
   - Suggested fix: Extract to higher-order function createAdvanceHandler(unit)
   - Location: src/workmodes/almanac/view/almanac-mvp.ts:67-101
   - See docs/almanac-system.md "Code Duplication" section for detailed fix
34. **[LOW] Almanac MVP - No Loading States** - Async vault operations lack feedback
   - Gateway.loadSnapshot() and advanceTimeBy() are async but show no spinner/placeholder
   - User sees no feedback during vault reads/writes
   - Need: Add loading spinner when loading calendar from vault, disable controls during advances
   - Location: src/workmodes/almanac/view/almanac-mvp.ts:40, 67-101
35. **[LOW] Feature TODOs** - Intentional placeholders for future work (UI improvements, advanced features)
36. **[LOW] Probabilistic Market Fluctuation Test Failure** - Test fails consistently (not occasionally)
   - Test: `devkit/testing/unit/features/factions/economics.test.ts > Economic Simulation > simulateMarketFluctuation > randomly fluctuates supply and demand`
   - Impact: Non-blocking, test-only issue, economics feature still functional
   - Fix: Adjust test tolerance or fix random seed for deterministic testing
   - Location: devkit/testing/unit/features/factions/economics.test.ts
37. **[LOW] Old Preset Format Warning** - 5 files use old format with "ability:" prefix
   - DevKit doctor reports 5 creature presets use old format
   - Non-blocking: Plugin functions correctly with both formats
   - Fix: Run `node devkit/utilities/conversions/convert-references.mjs`
   - Location: Presets/Creatures/ (5 files identified by DevKit doctor)
38. **[LOW] [UX] Almanac Time Controls - Unclear Button Direction** - "−" and "+" don't indicate time direction
   - Buttons show mathematical symbols but unclear if + means "advance into future" or "add to current time"
   - Could use arrows (← →) or labels ("Earlier" / "Later") for clarity
   - Location: src/workmodes/almanac/view/almanac-time-display.ts:66-78
39. **[LOW] [UX] Almanac Month View - Incorrect Weekday Calculation** - Grid assumes all months start on Monday
   - Hardcoded firstWeekday = 0 (line 108), will show wrong layout for real calendars
   - Need: Implement proper calendar math to calculate actual weekday of month start
   - Impact: Month grid shows days in wrong columns
   - Location: src/workmodes/almanac/view/month-view-calendar.ts:108
40. **[LOW] [UX] Almanac Month View - Event Indicator Grammar** - Tooltip shows "phenomenon(a)" instead of "phenomenon(s)"
   - Line 207: Uses "(a)" suffix which is not standard English
   - Should be: "2 event(s), 1 phenomenon(s)" or "2 events, 1 phenomenon"
   - Location: src/workmodes/almanac/view/month-view-calendar.ts:207
41. **[LOW] [UX] Almanac Month View - Day Click Does Nothing Useful** - Clicking day only logs, no user value
   - User expects clicking day to show events for that day or jump to timeline view
   - Currently just logs to console (line 211)
   - Need: Show day events in detail panel or switch to day/timeline view
   - Location: src/workmodes/almanac/view/month-view-calendar.ts:211-213
42. **[LOW] [UX] Almanac Events List - No Relative Time Context** - Shows absolute timestamps without relative context
   - Displays "Year 2025, January, Day 16" but not "Tomorrow" or "In 2 days"
   - Users need to mentally calculate how far away events are
   - Need: Add relative time labels (e.g., "Today", "Tomorrow", "In 3 days")
   - Location: src/workmodes/almanac/view/upcoming-events-list.ts:154-156
43. **[LOW] [UX] Almanac Events List - No Visual Grouping by Day** - Flat list makes daily structure unclear
   - All events in one chronological list, hard to see which day has which events
   - Need: Group by day with day headers (e.g., "Today", "Tomorrow", "Jan 17")
   - Location: src/workmodes/almanac/view/upcoming-events-list.ts:146-182
44. **[LOW] [UX] Almanac MVP - Setup Notice Lacks Guidance** - No calendar setup notice doesn't guide user
   - Shows "No calendar is configured. Please create a calendar..." but no action button
   - User doesn't know where to create calendar or how to import presets
   - Need: Add "Open Library" or "Import Calendar" button to notice
   - Location: src/workmodes/almanac/view/almanac-mvp.ts:46-52
45. **[LOW] [UX] Almanac MVP - View Switcher Text-Only** - Uses text buttons without icons
   - "List View" / "Month View" buttons are text-only
   - Could be more compact and scannable with icons (📋 / 📅)
   - Location: src/workmodes/almanac/view/almanac-mvp.ts:174-180
46. **[LOW] [UX] Almanac Gateway - Generic Error Messages** - Error notices don't help user understand issue
   - "Failed to advance time. Check console for details." requires technical knowledge
   - User doesn't know if it's network issue, vault corrupted, or something else
   - Need: Parse error type and show actionable message (e.g., "Calendar file is locked, try again")
   - Location: src/workmodes/almanac/view/almanac-mvp.ts:71, 82, 93
47. **[LOW] [UX] Almanac Gateway - No Retry Mechanism** - Failed vault operations can't be retried
   - If loadSnapshot() or advanceTimeBy() fails, user must close/reopen Almanac
   - Need: Show "Retry" button on error or auto-retry with backoff
   - Location: src/workmodes/almanac/view/almanac-mvp.ts:40, 67-101

**Test-Status:**
- Unit tests: 1148/1149 passing (99.9%) ⚠️
  - Audio: 57/57 ✅, Playlist: 17/17 ✅
  - Encounter: 34/34 ✅ (includes 7 manual composition tests + 1 presenter test)
  - Faction: 388/390 ⚠️ (1 probabilistic market fluctuation test failing consistently, 1 NPC betrayal test occasionally fails)
  - Location/Building: 145/145 ✅ (includes 5 repair cost + 5 job validation tests)
  - Weather (Phase 10.1-10.4 + 11.1): 136/136 ✅ (includes 6 interactivity tests)
  - **Almanac MVP + Month View + Event Editor (Phase 12.1-12.4 + 13.2): 32/32 ✅** (time display, events list, month grid, view switching, event editor validation - 18 new tests)
  - **Library Entities (Phase 12.3): 161/161 ✅** (locations: 134, playlists: 17, encounter-tables: 10)
  - Header policy: 1/1 ✅
- Integration tests: 6 require live Obsidian (expected, documented limitation)
- **Known Issues:**
  - 1 probabilistic market fluctuation test fails consistently (economic simulation)
  - 1 probabilistic NPC betrayal test fails occasionally (non-blocking)

**Recently Completed:**
- **Phase 13 Priority 2:** Event Editor Implementation ✅ (Nov 1, 2025)
  - Complete event creation/editing modal (562 lines, event-editor-modal.ts)
  - Basic fields: title, description, category, tags (comma-separated), priority (0-10)
  - Timestamp selection: year, month (dropdown), day, hour, minute with schema-aware validation
  - All-day event toggle (hides time fields dynamically)
  - Event type selector: Single vs Recurring
  - Recurrence patterns: Annual (day-of-year), Monthly (specific day), Weekly (day index + interval), Custom
  - Form validation: required title, date/time bounds checking against calendar schema
  - Save callback integration with almanac MVP (passed schema + currentTime)
  - ID generation using timestamp + random string pattern (matches faction system)
  - 18 new unit tests covering creation, validation, recurrence, tag parsing
  - Tests: 1148/1149 passing (99.9%), Build: SUCCESS, CONSOLE_LOG: Clean
  - Updated almanac-mvp.ts to remove "placeholder" notice, wire up schema/currentTime
  - Documentation updated (docs/almanac-system.md)
- **Phase D (6th Run):** UX Review Complete ✅ (Nov 1, 2025)
- **Phase 13 Priority 1:** Vault Data Integration ✅ (Nov 1, 2025)
- **Phase A (6th Run):** Quality Audit Complete ✅ (Nov 1, 2025)
- **Phase 12.4:** Month View Calendar ✅ (Nov 1, 2025)

**Nächste Schritte (Empfehlung):**
1. **[HIGH] Phase 13: Continue Almanac Full Implementation** - MVP + Month View + Vault Integration + Event Editor (Priority 1-2) complete
   - **Priority 1:** ✅ COMPLETE - Vault data integration (Nov 1, 2025)
   - **Priority 2:** ✅ COMPLETE - Full event editor implementation (Nov 1, 2025)
   - **Priority 3:** Week/timeline calendar grid views with event visualization
   - **Priority 4:** Month navigation controls (prev/next month buttons)
   - **Priority 5:** Astronomical cycles UI (moon phases, eclipses, etc.)
   - **Priority 6:** Event inbox with priority sorting
   - **Priority 7:** Search functionality implementation (replace placeholder notice)
   - See [docs/almanac-system.md](docs/almanac-system.md) for technical details
2. **[MEDIUM] Complete Partial Features** - Working but incomplete
   - POI placement UI in Cartographer (location system ready, needs UI mode)
   - Cartographer Brush debugging (investigate error messages)
   - Almanac keyboard shortcuts (arrow nav, time advance hotkeys)
   - Weather history/forecast discoverability (expand by default or add ▶ icons)
   - **[UX] Building capacity warnings** (only shows after error, needs proactive display)
   - **[UX] Condition impact clarity** (users don't understand what condition affects)
   - **[UX] Production units display** (shows % without context)
   - **[UX] Weather detail precision** (categorical values lack exact numbers)
   - **[UX] Weather icon severity** (icon doesn't show severity visually)
   - **[UX] Weather update timing** (no indication when weather will change)
4. **[PLANNED] Phase 10.5: Advanced Weather Features** - Future enhancements
   - Extreme weather events (hurricanes, blizzards)
   - Player-controlled weather (Control Weather spell)
