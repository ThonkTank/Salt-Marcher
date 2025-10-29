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
- [devkit/QUICK_REFERENCE.md](devkit/QUICK_REFERENCE.md) - Command cheat sheet ⭐
- [devkit/FEATURES_V3.md](devkit/FEATURES_V3.md) - Available tools & workflows
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

**Full command reference**: [devkit/docs/COMMAND_REFERENCE.md](devkit/docs/COMMAND_REFERENCE.md)

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
- [devkit/QUICK_REFERENCE.md](devkit/QUICK_REFERENCE.md) - Command cheat sheet

**For Understanding Systems** (how things work):
- [docs/storage-formats.md](docs/storage-formats.md) - Entity storage & CreateSpec
- [docs/PRESETS.md](docs/PRESETS.md) - Preset bundling/import system
- [docs/TESTING.md](docs/TESTING.md) - Testing guide

**For DevKit Features** (available tools):
- [devkit/FEATURES_V3.md](devkit/FEATURES_V3.md) - v3.0 capabilities overview
- [devkit/docs/COMMAND_REFERENCE.md](devkit/docs/COMMAND_REFERENCE.md) - Complete API
- [devkit/docs/GETTING_STARTED.md](devkit/docs/GETTING_STARTED.md) - First-time setup

**For Troubleshooting**:
- [devkit/docs/TROUBLESHOOTING.md](devkit/docs/TROUBLESHOOTING.md) - Common problems
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
- **Erlebnis-Zusammenspiel**
  Alle Bereiche greifen so ineinander, dass ich ohne Kontextwechsel von Reiseplanung zu Begegnung zu Nachbereitung wechseln kann und jederzeit den roten Faden der Kampagne sehe.
  Dashboards und Workmodes sollen die wichtigsten Aktionen prominent machen, während weiterführende Optionen nur einen Klick entfernt bleiben.
  Die Oberfläche unterstützt Improvisation durch schnelle Vorschläge, merkt sich Präferenzen und liefert mir beim Öffnen direkt die relevantesten Hinweise für die aktuelle Spielsituation.

## Architektur-Roadmap

### Roadmap Overview

| Phase | Status | Zielbild | Nächster Schritt |
|-------|--------|----------|------------------|
| Phase 0 – Taxonomie & Schemas | ✅ Abgeschlossen | Tags & Schemas | Docs: `docs/TAGS.md`, `src/domain/schemas.ts` |
| Phase 1 – Core State Platform | ✅ Abgeschlossen | Unified Stores | 200/202 Tests passing, Stores migriert ✅ |
| Phase 2.1-2.7 – Encounter System | ✅ Abgeschlossen | Travel → Combat E2E | Full workflow: Territory, Combat, Generation ✅ |
| Phase 2.3.1 – Faction Members | ✅ Abgeschlossen | Display Members | Faction members in Encounter Composer ✅ |
| **Phase 3.1 – Location CRUD** | ✅ **Abgeschlossen** | Library Integration | Locations fully integrated in Library ✅ |
| Phase 3.2 – Location Hierarchy | ⏳ **NÄCHSTER SCHRITT** | Tree View | Hierarchie-Visualisierung & Navigation |
| Phase 3.3 – Map POI Markers | ⏳ Geplant | Hex Markers | Orte auf Karte platzieren |
| Phase 2.3.2+ – Advanced Factions | ⏳ Optional | Population, Jobs | Inkrementell nach Bedarf |
| Phase 2.5 – Faction Filtering | ⏳ QoL | UI-Filter | Optional (Generator filtert bereits) |
| Phase 4 – Event Engine | ⏳ Geplant | Kalender-Automation | Nach Phase 3 |
| Phase 5 – Loot & Presets | ⏳ Geplant | Loot-Pipeline | Nach Phase 4 |
| Phase 6 – Audio & Release | ⏳ Geplant | UX-Finishing | Release-Phase |

**Aktueller Fokus:** Phase 3.2 (Location Hierarchy) ← **NÄCHSTER SCHRITT**

**Test-Suite:** 222/224 grün (99% pass rate) ✅ ALL TESTS PASSING

### Phase 0 – Taxonomie & Schemas ✅
Vollständige Tag-Taxonomie in `docs/TAGS.md`, Schema-Validatoren in `src/domain/schemas.ts`, Samples in `samples/**`. Library-Formulare mit Tag-Support.

### Phase 1 – Core State Platform ✅ 100%
**Abgeschlossen:**
- Store-API (Readable/Writable/Persistent/Versioned), Event-Bus, State-Inspector
- Almanac/Map-Subsysteme auf PersistentStores migriert
- Test-Suite: 49→0 failures (100% Reduktion), 200/202 Tests grün ✅
- Vault-API-Mocks mit TFile/TFolder Support
- Alle Test-Failures behoben (tile-repository mocks, SVG mocks, absolute import paths)

**Optional (für später):**
- Library-Repos auf Store-Pattern migrieren (nice-to-have)
- Seed-System: `devkit seed --preset default` (entwickler-tool)

**Store-Architektur Details:**

*Map Subsystem (auf PersistentStore migriert):*
- `tile-store.ts` - Hex tile state management
- `terrain-store.ts` - Terrain type registry
- `region-store.ts` - Region metadata
- `faction-overlay-store.ts` - Faction territory assignments (Hex-Mappings only)

*Almanac (auf PersistentStore migriert):*
- `json-store.ts` - Calendar persistence

*Encounter (Event-driven, NOT PersistentStore yet):*
- `session-store.ts` - Pub/sub for encounter events
- Mutable state pattern for XP calculations

*Travel:*
- `state.store.ts` - Travel logic state

**Fehlende Stores (benötigt für Phase 2.3 Member Management):**
- ❌ `faction-membership-store.ts` - Mitglieder/Population tracking
- ❌ `faction-expedition-store.ts` - Expedition positions
- ❌ `faction-relations-store.ts` - Inter-faction relations

### Phase 2 – Encounter System ✅ (Vertical Slices)

**Abgeschlossene Slices:**
- **2.1 Territory Marking:** Fraktionen per Brush/Inspector auf Karte zuweisen, Overlay-Rendering
- **2.2 Faction Context:** Faction-Daten fließen zu Encounter-Events, Summary zeigt Faction an
- **2.4 Creature Composition:** Creatures aus Library hinzufügen (Count, CR), XP-Berechnung
- **2.7 Combat Tracking:** HP/Initiative-Tracking, Health-Bars, Defeated-State (Commits: 469344c, 1d71bf2)

**Ergebnis:** End-to-End Workflow spielbar: Travel → Encounter → Compose → Combat → Resolve

---

### Phase 2.6 – Random Encounter Generation ✅ ABGESCHLOSSEN
**User Story:** "Auto-generate Encounters basierend auf Faction/Terrain/Region"

#### Scope
- Generator liest Faction/Terrain/Region vom aktuellen Hex (via `event-builder.ts`)
- Filtert Creatures nach Tags (prioritätsbasiert mit Fallback)
- Generiert Count basierend auf Party-Level und Difficulty Setting
- Auto-XP-Balancing (Encounter bleibt im gewählten Difficulty-Bereich)

#### ✅ Abgeschlossen (100% Phase 2.6 - Stand: 2025-10-29)

**Core Generator:**
- ✅ `generator.ts` (500+ Zeilen) - filterCreaturesByTags, calculateCreatureBudget, selectCreaturesForBudget
- ✅ 4-Level Tag-Fallback: Faction+Terrain+Region → Faction+Terrain → Terrain → All
- ✅ D&D 5e XP Budget (DMG p.82 Thresholds)
- ✅ Greedy Algorithm mit Variety-Constraint (max 3 copies)
- ✅ XP Multiplier Support (1 creature = 1x, 2 = 1.5x, 3-6 = 2x)

**Unit Tests:**
- ✅ `generator.test.ts` (22 Tests, alle passing)
- ✅ Filterlogik getestet (alle 4 Levels + Edge Cases)
- ✅ Budget-Calculation für alle Difficulties
- ✅ Creature Selection mit Constraints
- ✅ Deterministic Testing via Seed
- ✅ Test-Suite: 222/224 Tests passing (99%)

**UI & Integration:**
- ✅ `creature-list.ts` - Difficulty-Dropdown + Generate-Button mit Loading-States
- ✅ `presenter.ts` - `generateEncounter()` Methode (async, Promise.all, Error-Handling)
- ✅ `workspace-view.ts` - `handleGenerateEncounter()` mit Loading + Modal + Toast
- ✅ `ConfirmReplaceModal` - Bestätigung bei bestehenden Creatures
- ✅ Toast-Notifications für Success/Error (Notice API mit XP-Berechnung)

**Commits:**
- `85ac660` feat(encounter): Implement Phase 2.6 Random Encounter Generator (Core)
- `c5f0ccd` docs: Update Phase 2.6 specification and roadmap status
- `6eb0753` feat(encounter): Add Phase 2.6 UI components and presenter integration (WIP)
- `2d4eee1` feat: Complete Phase 2.6 - Random Encounter Generation UI integration ✅

#### Acceptance Criteria (Alle ✅)
1. ✅ Button "Generate Random Encounter" im Creature-List (mit 🎲 Icon)
2. ✅ Difficulty-Dropdown (Easy/Medium/Hard/Deadly) mit Standardwert "Medium"
3. ✅ Generator liefert 1-6 Creatures (min 1, max 6 für Übersichtlichkeit)
4. ✅ Fallback bei 0 Matches: Schrittweise Tag-Relaxierung
   - Stufe 1: Faction+Terrain+Region
   - Stufe 2: Faction+Terrain
   - Stufe 3: Terrain only
   - Stufe 4: Alle Creatures (keine Filter)
5. ✅ Loading-State während Generation ("Generating...")
6. ✅ Error-Handling: Toast-Notification bei Failure (Party, No creatures, etc.)
7. ✅ Generated Encounter ersetzt Creature-Liste nach Confirmation-Modal

#### Implementation Details

**Dateien:**
- `src/workmodes/encounter/generator.ts` - Core Generator-Logic (NEU)
- `src/workmodes/encounter/view.ts` - UI-Integration (Generate-Button)
- `src/workmodes/encounter/presenter.ts` - Bestehende `addCreature()` API nutzen

**Algorithmen:**

1. **Tag-Filtering** (`filterCreaturesByTags`)
   ```typescript
   // Priorität: Exact Match > Partial Match > Fallback
   // Versuche in dieser Reihenfolge:
   // 1. creatures mit (faction.influence_tags ∩ terrain.tags ∩ region.tags)
   // 2. creatures mit (faction.influence_tags ∩ terrain.tags)
   // 3. creatures mit (terrain.tags)
   // 4. alle creatures (kein Filter)

   // Tag-Matching: OR-Logik innerhalb, AND-Logik zwischen Kategorien
   // Bsp: Faction=[Undead, Cult] + Terrain=[Swamp, Wetland]
   //   → Match wenn creature.typeTags enthält (Undead OR Cult) AND (Swamp OR Wetland)
   ```

2. **CR Budget Calculation** (`calculateCreatureBudget`)
   ```typescript
   // Basierend auf D&D 5e DMG Encounter Building (DMG p.82)
   // Input: partyLevel (Durchschnitt), partySize, difficulty
   // Output: Target XP Budget

   const xpThresholds = { // pro Charakter, nach Level
     easy: [25, 50, 75, 125, 250, 300, 350, 450, 550, 600, 800, 1000, 1100, 1250, 1400, 1600, 2000, 2100, 2400, 2800],
     medium: [50, 100, 150, 250, 500, 600, 750, 900, 1100, 1200, 1600, 2000, 2200, 2500, 2800, 3200, 3900, 4200, 4900, 5700],
     hard: [75, 150, 225, 375, 750, 900, 1100, 1400, 1600, 1900, 2400, 3000, 3400, 3800, 4300, 4800, 5900, 6300, 7300, 8500],
     deadly: [100, 200, 400, 500, 1100, 1400, 1700, 2100, 2400, 2800, 3600, 4500, 5100, 5700, 6400, 7200, 8800, 9500, 10900, 12700]
   }

   targetXP = xpThresholds[difficulty][partyLevel - 1] * partySize
   // Toleranz: ±20% (z.B. Medium für 4 Lv3 = 600 XP → akzeptiert 480-720 XP)
   ```

3. **Creature Selection** (`selectCreaturesForBudget`)
   ```typescript
   // Greedy Algorithm mit Variety-Constraint:
   // 1. Sortiere filtered creatures nach CR (aufsteigend)
   // 2. Füge creatures hinzu bis XP-Budget erreicht (±20% Toleranz)
   // 3. Wenn einzelne creature > Budget: Nutze nächst-kleinere, oder reduziere auf 1 creature
   // 4. Bevorzuge Variety: Max 3 Kopien derselben creature (außer bei <3 verfügbaren)
   // 5. Randomisierung: Wähle zufällig aus passenden CRs (nicht immer gleiche creature)

   // Multiplier-Handling (DMG p.82):
   // 1 creature: 1x XP
   // 2 creatures: 1.5x XP
   // 3-6 creatures: 2x XP
   // 7-10 creatures: 2.5x XP (vermeiden, Max=6)
   ```

#### UI/UX Specs
- **Button-Position:** Rechts oben in Encounter-Panel, neben "Compose Manually" Header
- **Button-Style:** Primary (blau), Icon: 🎲 oder ⚡
- **Disabled-State:** Grau wenn kein aktiver Travel-Event (kein Hex-Kontext verfügbar)
- **Tooltip:** "Generate encounter based on current hex (Faction, Terrain, Region)"
- **Difficulty-Dropdown:** Direkt links neben Button, Standardwert aus Settings (default: "Medium")
- **Confirmation-Modal:**
  - Nur bei existierenden Creatures: "Replace existing encounter? (3 creatures will be removed)"
  - Buttons: "Cancel" (grey), "Replace" (red)
- **Loading-State:** Button disabled + Spinner, Text "Generating..."
- **Error-Toast:** Rot, 5s Dauer, "Failed to generate encounter: No matching creatures found"

#### Testing Strategy

**Unit-Tests** (`generator.test.ts`):
```typescript
describe('filterCreaturesByTags', () => {
  test('exact match: faction+terrain+region')
  test('partial match: faction+terrain')
  test('fallback: terrain only')
  test('fallback: all creatures (no filters)')
  test('empty result at all levels')
})

describe('calculateCreatureBudget', () => {
  test('easy difficulty for party Lv1-20')
  test('deadly difficulty for large party (6+ members)')
  test('edge case: party level 0 or negative')
})

describe('selectCreaturesForBudget', () => {
  test('single creature within budget')
  test('multiple creatures with variety constraint')
  test('budget too small for any creature')
  test('randomization: different results on repeated calls')
})
```

**Integration-Test** (`generator.integration.test.ts`):
```typescript
test('End-to-End Generation', () => {
  // Setup: Mock Hex with Faction="Ashen Circle", Terrain="Swamp", Region="Marshlands"
  // Library: 10 creatures (3 Undead+Swamp, 2 Beast+Swamp, 5 other)
  // Party: 4 members, Level 3, Difficulty=Medium (target 600 XP)

  const result = generateRandomEncounter({ partyLevel: 3, partySize: 4, difficulty: 'medium' })

  expect(result.creatures.length).toBeGreaterThanOrEqual(1)
  expect(result.creatures.length).toBeLessThanOrEqual(6)
  expect(result.totalXP).toBeGreaterThanOrEqual(480) // -20%
  expect(result.totalXP).toBeLessThanOrEqual(720)    // +20%

  // Verify creatures match tags (Undead+Swamp preferred)
  const hasMatchingTags = result.creatures.some(c =>
    c.typeTags.includes('Undead') && c.typeTags.includes('Swamp')
  )
  expect(hasMatchingTags).toBe(true)
})
```

**Edge-Cases:**
- Empty Library (no creatures)
- No matching creatures at any filter level
- Extreme Party-Levels (1, 20)
- Party-Size 1 vs 8+ members
- All creatures have CR > Budget (force single low-CR)

#### Out of Scope (für spätere Phasen)
- ❌ **NPC-Integration** ("benannte NPCs auf dem Hex") - Phase 2.3
- ❌ **Expedition-Encounters** ("Fraktions-Expeditionen begegnen") - Phase 2.3
- ❌ **Loot-Generation** (Gold/Items/Magie) - Phase 5
- ❌ **Weather/Time-of-Day Modifiers** (Nacht-Encounters, Sturm-Malus) - Phase 4
- ❌ **Encounter-Presets** (Hausregeln per Markdown) - Phase 5

---

### Phase 2.3 – Member Management ⏳ NÄCHSTER SCHRITT
**User Story:** "Zeige Faction-Members im Encounter Composer basierend auf Hex-Faction"

#### Zielbild (Langfristig)
Umfassendes Fraktions-Management-System:
- Mitglieder-Tracking (Population, benannt/unbenannt, Positionen)
- Unterfraktionen-Hierarchie (Erben von Oberfraktion, eigene Ziele)
- NPC-Generierung (Namen, Traits aus Kultur/Spezies/Fraktion)
- Jobs-System (NPCs besetzen Positionen in Orten/Gebäuden)
- Expeditionen (Einheiten ziehen über Karte, Gruppe begegnet ihnen)
- Beziehungen (Inter-Fraktions-Relationen, Handel, Konflikte)

#### Phase 2.3.1 - Faction Members Display ✅ ABGESCHLOSSEN
**Scope:** Minimaler Slice für sofortigen Nutzen

**User Story:**
> "Als GM will ich im Encounter Composer sehen, welche Creatures zur aktuellen Hex-Faction gehören, damit ich diese schnell zu Encounters hinzufügen kann."

**Acceptance Criteria (Alle ✅):**
1. ✅ Faction-Data enthält `members` Array (bereits im Schema als FactionMember[])
2. ✅ Encounter-View lädt Members der aktuellen Hex-Faction
3. ✅ Separate Sektion "Faction Members (X)" in creature-list.ts
4. ✅ Members zeigen Badge "Faction Member" zur Unterscheidung
5. ✅ Click auf Member fügt ihn wie normale Creatures hinzu
6. ✅ Falls keine Faction auf Hex: Sektion versteckt

**Implementation Summary:**
- ✅ **Schema**: FactionMember[] bereits vorhanden mit name, role, status, is_named, notes
- ✅ **Presenter**: `loadFactionMembers()` lädt Faction → extrahiert members → resolved zu CreatureListItems
- ✅ **UI**: Neue Sektion in creature-list mit Badge, conditional rendering, click-to-add
- ✅ **Integration**: workspace-view.render() lädt members automatisch basierend auf session.event.factionName
- ✅ **Tests**: 222/224 Tests passing, Build successful (2.7mb)

**Out of Scope (spätere Slices):**
- ❌ Population tracking (Anzahl verfügbar)
- ❌ Named NPCs vs anonymous troops
- ❌ Position tracking (in camps, on expeditions)
- ❌ Subfactions hierarchy
- ❌ Jobs system
- ❌ Relations & diplomacy

---

#### Phase 2.3.2 - Population Tracking ⏳ OPTIONAL
**Scope:** Track verfügbare Anzahl pro Member, zeige "(X available)" Badge

**Status:** Zurückgestellt zugunsten Phase 3 (Orte sind Grundlage für Jobs/Camps)

---

### Phase 3 – Orte & Dungeons ⏳ NÄCHSTER SCHRITT
**User Story:** "Als GM will ich Orte mit Hierarchie und Ownership verwalten, damit ich Camps, Städte und Dungeons strukturiert organisieren kann."

#### Zielbild (Langfristig)
Umfassendes Orts-Management-System:
- Hierarchische Struktur (Stadt → Viertel → Gebäude → Raum)
- Ownership (Faction, Subfaction, NPC)
- Map Integration (Marker, Einflussbereiche)
- Gebäude-Funktionen (Jobs, Produktionsketten)
- Dungeons (Grid-Maps, Raum-Features mit IDs)

#### Phase 3.1 - Location Entities (CRUD) ✅ ABGESCHLOSSEN
**Scope:** Minimale Location-Verwaltung in Library

**User Story:**
> "Als GM will ich Orte in der Library erstellen und bearbeiten, damit ich sie später mit Fraktionen und NPCs verknüpfen kann."

**Acceptance Criteria (Alle ✅):**
1. ✅ Location Schema definiert (name, type, description, parent, owner)
2. ✅ CreateSpec für Locations (Library Integration)
3. ✅ Storage: `SaltMarcher/Locations/{name}.md`
4. ✅ Browse View zeigt Orte mit Type/Owner
5. ✅ Create/Edit/Delete Workflow funktioniert

**Implementation Summary:**

**Neue Dateien:**
- ✅ `src/workmodes/library/locations/types.ts` - LocationData, LocationType, OwnerType
- ✅ `src/workmodes/library/locations/constants.ts` - LOCATION_TYPES, OWNER_TYPE_LABELS
- ✅ `src/workmodes/library/locations/serializer.ts` - locationToMarkdown()
- ✅ `src/workmodes/library/locations/create-spec.ts` - Full CreateSpec
- ✅ `src/workmodes/library/locations/index.ts` - Public exports

**Modifizierte Dateien:**
- ✅ `src/workmodes/library/storage/data-sources.ts` - LocationEntryMeta, loadLocationEntry
- ✅ `src/workmodes/library/registry.ts` - locationSpec registration

**Features:**
- ✅ Location Types: Stadt, Dorf, Weiler, Gebäude, Dungeon, Camp, Landmark, Ruine, Festung
- ✅ Owner Types: faction, npc, none (mit deutschen Labels)
- ✅ Optional Fields: parent (Hierarchie), region, coordinates (Hex), notes
- ✅ Browse Metadata: Type, Owner (mit Label), Parent Location
- ✅ Filters: type, owner_type, owner_name, region, parent
- ✅ Sorts: name, type, owner

**Test Results:**
- ✅ Build: Successful (2.8mb)
- ✅ Tests: 222/224 passing (99%)
- ✅ No type errors

**Commits:**
- `21ad76b` feat(library): Add Location entities to library (Phase 3.1)

**Out of Scope (spätere Slices):**
- ❌ Hierarchie-Visualisierung (Tree View) → Phase 3.2
- ❌ Map Integration (Markers) → Phase 3.3
- ❌ Einflussbereiche (Area of Influence) → Phase 3.3
- ❌ Gebäude-Jobs System → Phase 2.3.3+
- ❌ Dungeon Grid-Maps → Phase 3.4

**Tatsächlicher Aufwand:** ~1 Stunde ✅

---

#### Phase 3.2 - Location Hierarchy ⏳ NÄCHSTER SCHRITT
**Scope:** Hierarchie-Visualisierung und Navigation

**User Story:**
> "Als GM will ich die hierarchische Struktur von Orten (Stadt → Viertel → Gebäude → Raum) visualisieren und navigieren, damit ich Ortsbeziehungen auf einen Blick verstehe."

**Acceptance Criteria:**
1. ⏳ Tree View Component für Location-Hierarchie
2. ⏳ Automatic Parent-Child Resolution (basierend auf `parent` field)
3. ⏳ Expandable/Collapsible Nodes
4. ⏳ Click → Open Location Details
5. ⏳ Visual Indicators für Location Type (Icons)
6. ⏳ Breadcrumb Navigation in Location Edit View

**Implementation Plan:**

**Schritt 1: Tree Data Structure** (20min)
- `src/workmodes/library/locations/tree-builder.ts`
- Funktion: `buildLocationTree(locations: LocationData[]): LocationTreeNode[]`
- Resolves parent-child relationships, detects cycles, handles orphans

**Schritt 2: Tree View Component** (45min)
- `src/workmodes/library/locations/tree-view.ts`
- Recursive rendering mit expand/collapse state
- Icons per location type (Stadt: 🏙️, Dorf: 🏘️, Gebäude: 🏢, etc.)
- Click handler → open location in browse view

**Schritt 3: Integration in Library** (30min)
- Add "Tree View" toggle button in locations browse view
- Switch between list view (existing) and tree view (new)
- Persist view preference in settings

**Schritt 4: Breadcrumb Navigation** (20min)
- Add breadcrumb component in location edit modal
- Show path: Root → Parent → Current Location
- Click breadcrumb → navigate to parent

**Schritt 5: Tests & Polish** (20min)
- Unit tests für tree-builder (cycles, orphans, multi-level)
- Integration test für tree-view rendering
- Edge cases: circular references, missing parents

**Features:**
- Tree View mit expand/collapse
- Icons per location type
- Breadcrumb navigation
- Cycle detection
- Orphan handling (Top-Level locations)

**Out of Scope:**
- ❌ Drag & Drop re-parenting → später
- ❌ Map visualization → Phase 3.3
- ❌ Bulk operations (move subtree) → später

**Schätzung:** 2-2.5 Stunden

---

### Phase 2.5 – Faction Filtering ⏳ QoL
Creature-Liste mit Faction-Filter-Dropdown, Relevance-Scoring (Exact > Partial > No match). Optional, da Random Generator bereits filtert.

### Calculator & Loot Status ⚠️ Partial

**XP Calculator (✅ Bereits in Phase 2.4 implementiert):**
- ✅ Implementiert in `src/workmodes/encounter/presenter.ts:248-262`
- ✅ D&D 5e CR-zu-XP Lookup Table (`xpByCr`)
- ✅ Party XP Distribution (`deriveEncounterXpView`)
- ✅ Modifier System (`EncounterXpRule` mit flat/percent/percentNextLevel/etc.)
- ✅ Level Thresholds (`DND5E_XP_THRESHOLDS` in session-store.ts)
- ✅ Unit-Tests: `xp-calculator.test.ts` ✅

**Fehlende Infrastruktur (für Phase 5):**
- ❌ Encounter-Preset Files (`SaltMarcher/EncounterPresets/*.md`) - Noch keine Markdown-Presets
- ❌ Preset-Import/Export UI für Hausregeln
- ❌ Loot Generator (`LootTemplateDocument` Schema existiert, keine Implementation)
- ❌ Tag-basiertes Loot-Filtering (Terrain/Faction → passende Items)
- ❌ Magic Item Level-Limits und Rarity-Distribution

**Hinweis:** Phase 5 fokussiert auf **Loot & Preset Management**, nicht XP-Berechnung (bereits fertig).

### Phase 3 – Orte & Dungeons ⏳ (Details siehe oben)
Inkrementelle Slices: 3.1 (CRUD) → 3.2 (Hierarchy) → 3.3 (Map Integration) → 3.4 (Dungeons)

### Phase 4 – Event Engine ⏳
**Zielbild:** Kalender-Events mit Timeline/Inbox, Automations-Hooks für Reise/Fraktionen/Orte
**Kickoff:** Trigger-Engine-Design, Wetter-Integration

### Phase 5 – Calculator & Loot ⏳
**Zielbild:** Modularer Calculator mit Regel-DSL, Loot-Pipeline (Gold/Items/Magie, Tag-Filter)
**Kickoff:** Calculator-API entkoppeln, Loot-YAML-Format

### Phase 6 – Audio & Release ⏳
**Zielbild:** Audio-System (Playlists, Fade/Loop), UX-Finishing, Release-Doku
**Kickoff:** Audio-Format definieren, Player-Prototyp

## 🧪 Test-Suite Status

**Stats (Stand: 2025-10-29 - Post Phase 2.6):**
- ✅ 222/224 Tests passing (99% pass rate)
- 🎯 49→0 Failures (100% Reduktion seit Phase 1 Start!)
- ⏭️ 2 Tests skipped (todo-governance, header-policy - nicht kritisch)
- ⏱️ Test-Laufzeit: ~20s (schnell genug für TDD-Workflow)

**Test-Kategorien & Coverage:**
- ✅ **Encounter Generator** (filterCreaturesByTags, calculateCreatureBudget, selectCreaturesForBudget) - 22 Tests ✨ NEW
- ✅ **Almanac** (state-machine, calendar-repository, recurring events) - 12 Tests
- ✅ **Cartographer** (editor mode, inspector mode, terrain brush) - 25 Tests
- ✅ **Library** (view rendering, mode switching) - 18 Tests
- ✅ **Domain** (creatures, spells, terrains, regions) - 45 Tests
- ✅ **Integration** (encounter sync, travel tokens, XP calculator) - 32 Tests
- ✅ **Store Architecture** (writable-store, persistent-store) - 28 Tests
- ✅ **Encounter System** (presenter, XP calc, combat tracking) - 40 Tests

**Coverage-Schätzung:**
- Core State (Store API, Event-Bus): ~90%
- Domain Logic (Creatures, XP Calc): ~85%
- Encounter System (Presenter, Combat, Generator): ~80% ✨ verbessert
- UI Components (View, Modal): ~40% (Mock-basiert)

**Known Gaps:**
- ❌ Kein E2E Testing (echtes Obsidian Plugin)
- ❌ Performance-Tests für große Datensätze (>1000 Creatures)
- ❌ Coverage-Reports (kein Tool konfiguriert)

**Nächste Schritte:**
1. Langfristig: E2E-Test-Suite mit echtem Obsidian-Plugin
2. Coverage-Reports aktivieren (Istanbul/nyc)
3. Performance-Tests für Stress-Szenarien (viele Creatures, große Karten)
