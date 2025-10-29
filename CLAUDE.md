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

| Phase | Status | Zielbild |
|-------|--------|----------|
| Phase 0-1 | ✅ Abgeschlossen | Tags, Schemas, Store-Platform |
| Phase 2.1-2.7 | ✅ Abgeschlossen | Travel → Encounter → Combat E2E |
| Phase 2.3.1 | ✅ Abgeschlossen | Faction Members Display |
| Phase 2.6 | ✅ Abgeschlossen | Random Encounter Generator |
| Phase 3.1 | ✅ Abgeschlossen | Location CRUD (Library) |
| Phase 3.2-3.2.1 | ✅ Abgeschlossen | Tree View (Hierarchy) |
| Phase 3.3-3.3.1 | ✅ Abgeschlossen | Map POI Markers + Editor |
| Phase 3.4.1 | ✅ Abgeschlossen | Dungeon Data Model |
| Phase 3.4.2 | ✅ Abgeschlossen | Grid Renderer (Canvas) |
| **Phase 3.4.3** | ⏳ **NÄCHSTER SCHRITT** | **Zoom/Pan/Click** |
| Phase 3.4.4-5 | ⏳ Later | Token Management, FOW |
| Phase 4-6 | ⏳ Geplant | Events, Loot, Audio |

**Aktueller Fokus:** Phase 3.4.3 (Interactive Features) ← **NÄCHSTER SCHRITT**

**Test-Suite:** 267/269 grün (99.3% pass rate) ✅

### Phase 0-1 – Foundation ✅
- **Phase 0:** Tag-Taxonomie (`docs/TAGS.md`), Schema-Validatoren (`src/domain/schemas.ts`)
- **Phase 1:** Store-Platform (Readable/Writable/Persistent), Event-Bus, 49→0 Test-Failures
  - Map/Almanac auf PersistentStores migriert
  - Encounter nutzt Event-driven Pattern

### Phase 2 – Encounter System ✅
- **2.1-2.4:** Territory Marking, Faction Context, Creature Composition, XP Calculator
- **2.6:** Random Encounter Generator (Tag-Fallback, D&D 5e XP Budget, 22 Tests)
- **2.7:** Combat Tracking (HP/Initiative, Health-Bars, Defeated-State)
- **2.3.1:** Faction Members Display im Encounter Composer
- **Ergebnis:** Travel → Encounter → Combat E2E spielbar

---

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

#### Phase 3.2 - Location Hierarchy (Core Infrastructure) ✅ ABGESCHLOSSEN
**Scope:** Hierarchie-Visualisierung und Navigation

**User Story:**
> "Als GM will ich die hierarchische Struktur von Orten (Stadt → Viertel → Gebäude → Raum) visualisieren und navigieren, damit ich Ortsbeziehungen auf einen Blick verstehe."

**Acceptance Criteria (Core Infrastructure):**
1. ✅ Tree View Component für Location-Hierarchie
2. ✅ Automatic Parent-Child Resolution (basierend auf `parent` field)
3. ✅ Expandable/Collapsible Nodes
4. ✅ Click Callback API (ready for integration)
5. ✅ Visual Indicators für Location Type (Icons: 🏙️ 🏘️ 🏢 ⚔️ ⛺ etc.)
6. ✅ Breadcrumb Navigation Component

**Implementation Status:**

**✅ Completed Steps (Core Functionality):**

**Schritt 1: Tree Data Structure** ✅ (tree-builder.ts, 140 lines)
- ✅ `buildLocationTree()` - Hierarchical tree construction
- ✅ `flattenTree()` - Depth-first traversal
- ✅ `findNodeByName()` - Tree search
- ✅ `buildBreadcrumbs()` - Parent path generation
- ✅ **Cycle Detection**: Detects A→B→C→A patterns
- ✅ **Orphan Handling**: Missing parents treated as roots

**Schritt 2: Tree View Component** ✅ (tree-view.ts, 150 lines)
- ✅ `LocationTreeView` class with expand/collapse
- ✅ Recursive rendering
- ✅ Icons: 🏙️ Stadt, 🏘️ Dorf, 🏢 Gebäude, ⚔️ Dungeon, ⛺ Camp, 🗿 Landmark, 🏚️ Ruine, 🏰 Festung
- ✅ Owner badges
- ✅ Click callbacks
- ✅ Depth-based indentation

**Schritt 4: Breadcrumb Component** ✅ (breadcrumb.ts, 80 lines)
- ✅ `LocationBreadcrumb` class
- ✅ Path rendering (Root → Parent → Current)
- ✅ Clickable parent links
- ✅ Customizable separators

**Schritt 5: Tests & Validation** ✅ (locations-tree.test.ts, 17 tests)
- ✅ All hierarchy scenarios (1-level, multi-level, orphans, cycles)
- ✅ Tree operations (flatten, search, breadcrumbs)
- ✅ **Test Results**: 17/17 passing (100%)
- ✅ **Overall Suite**: 239/241 passing (99%)

**Status:**
- ✅ Core tree infrastructure (100%)
- ✅ All components tested (17/17 tests)
- ✅ Cycle detection & orphan handling
- ✅ Ready for UI integration (→ Phase 3.2.1)

**Out of Scope:**
- ❌ Drag & Drop re-parenting → später
- ❌ Map visualization → Phase 3.3
- ❌ Bulk operations (move subtree) → später

**Commits:**
- `7a3b611` feat(locations): Add Phase 3.2 core - Tree view & breadcrumb components

**Actual Time:** ~1.5 hours (core infrastructure)

---

#### Phase 3.2.1 - Tree UI Integration ✅ ABGESCHLOSSEN
**Scope:** Integration der Tree View Components in die Library UI

**User Story:**
> "Als GM will ich in der Library zwischen List- und Tree-View für Locations wechseln können, damit ich entweder alle Locations flach oder hierarchisch sehen kann."

**Acceptance Criteria:**
1. ✅ Toggle Button "List/Tree" in Location Browse View
2. ✅ View Switching zwischen GenericListRenderer und Tree View
3. ✅ Click Handler → Opens location in browse view
4. ⏳ Breadcrumb in Location Edit/Create Modal (deferred to Phase 3.2.2)
5. ⏳ Persist view preference in Plugin Settings (deferred to Phase 3.2.2)

**Implementation Summary:**

**LocationListRenderer** (location-list-renderer.ts, 170 lines):
- ✅ Extends `GenericListRenderer<"locations">`
- ✅ View mode state: `"list" | "tree"`
- ✅ Toggle UI: 📋 List / 🌳 Tree buttons
- ✅ Conditional rendering:
  - List mode → parent's GenericListRenderer
  - Tree mode → LocationTreeView with buildLocationTree()
- ✅ Click handler → opens location via "Open" action

**Library View Integration:**
- ✅ Added "locations" to LIBRARY_COPY.modes
- ✅ Added "locations" to LIBRARY_MODES array
- ✅ Override `createRenderer()` to inject LocationListRenderer for locations mode
- ✅ All other modes use default GenericListRenderer

**Test Updates:**
- ✅ Updated library/view.test.ts to expect 9 modes (added locations)
- ✅ All 239/241 tests passing

**User Experience:**
1. Library → Locations Tab
2. Default: List view (flat, sortable, filterable)
3. Click "🌳 Tree": Hierarchical view
   - Stadt → Dorf → Gebäude with indentation
   - Expand/collapse nodes
   - Location type icons (🏙️ 🏘️ 🏢 ⚔️ ⛺ 🗿 🏚️ 🏰)
   - Owner badges
4. Click location name → Opens in browse view
5. Click "📋 List" → Back to flat list

**Files:**
- `src/workmodes/library/locations/location-list-renderer.ts` (NEW, 170 lines)
- `src/workmodes/library/view.ts` (modified - renderer override)
- `devkit/testing/unit/library/view.test.ts` (modified - test updates)

**Commits:**
- `7663741` feat(locations): Complete Phase 3.2.1 - Tree view in Library UI

**Actual Time:** ~2 hours (UI integration)

---

#### Phase 3.3 - Map POI Markers ⏳ IN ARBEIT
**Scope:** Locations auf der Hex-Karte platzieren und visualisieren

**User Story:**
> "Als GM will ich Locations auf der Cartographer-Karte platzieren, damit ich sehen kann wo Städte, Dungeons und andere Orte liegen, und diese Informationen im Inspector abrufen kann."

**Acceptance Criteria:**
1. ⏳ Location-Marker Store (welche Location auf welchem Hex)
2. ⏳ Marker Rendering auf Karte (Icons/SVG-Marker über Hexes)
3. ⏳ Inspector Integration (zeige Location-Info bei Hex-Click)
4. ⏳ Editor Mode Integration (Location zu Hex hinzufügen/entfernen)
5. ⏳ Unit Tests für Store und Rendering-Logic

**Implementation Plan:**

**Schritt 1: Location Marker Store** (~30min)
- Erstelle `src/features/maps/state/location-marker-store.ts`
- Pattern: ähnlich wie `faction-overlay-store.ts`
- Interface:
  ```typescript
  interface LocationMarker {
      coord: TileCoord;
      locationName: string;
      locationType: LocationType;
      icon?: string; // SVG path or emoji
  }
  ```
- Store-API: `setMarkers()`, `get()`, `list()`, `clear()`

**Schritt 2: Marker Rendering** (~45min)
- SVG Marker Layer in `hex-render.ts`
- Icons basierend auf Location Type (🏙️ 🏘️ 🏢 ⚔️ etc.)
- Marker über Hex-Polygon positionieren
- Subscribe zu location-marker-store

**Schritt 3: Inspector Integration** (~30min)
- Erweitere Inspector Mode (`modes/inspector.ts`)
- Zeige Location-Info wenn Hex mit Marker geklickt wird
- Display: Location Name, Type, Parent (falls vorhanden)
- Button "Open Location" → öffnet Location in Library

**Schritt 4: Editor Integration** (~45min)
- Neue Toolbar: "Location Marker" Tool
- Dropdown: Locations aus Library laden
- Click auf Hex: Location platzieren
- Shift+Click: Marker entfernen

**Schritt 5: Tests** (~30min)
- Unit Tests für `location-marker-store.ts`
- Test: setMarkers, get, list, clear
- Test: Marker persistence (via store)

**Out of Scope (spätere Phasen):**
- ❌ Einflussbereiche (Area of Influence) → Phase 3.3.1
- ❌ Automatische Marker-Platzierung → später
- ❌ Drag & Drop Marker verschieben → später
- ❌ Multi-Hex Locations (große Städte) → später

**Estimated Time:** 3-3.5 hours

**Actual Time:** ~3 hours

---

#### Phase 3.3 - Map POI Markers ✅ ABGESCHLOSSEN
**Scope:** Locations auf der Hex-Karte platzieren und visualisieren

**Implementation Summary:**

**✅ Completed Steps (1-3, 5):**

**Step 1: Location Marker Store** (200 lines)
- Created `location-marker-store.ts` with full store API
- Registry pattern per map file
- Icon mapping for location types (emoji-based)
- Store API: `setMarkers()`, `get()`, `list()`, `getByLocationName()`, `clear()`
- Follows `faction-overlay-store` pattern

**Step 2: Marker Rendering** (80 lines)
- Integrated marker layer in `hex-render.ts`
- SVG <g> element for location markers
- Subscribe to location-marker-store
- Render markers as SVG <text> with emojis
- Automatic positioning above hex center
- Tooltip support via SVG <title>
- Non-invasive: no changes to scene.ts

**Step 3: Inspector Integration** (90 lines)
- Added location marker info display to Inspector sidebar
- Shows: name, type, parent, owner when hex with marker is clicked
- "Open in Library" button navigates to Library view
- Automatic lookup from location-marker-store on hex selection
- Conditional rendering: only shown if marker exists

**Step 5: Unit Tests** (440 lines, 19 tests)
- Comprehensive test suite for `location-marker-store`
- Coverage: store creation, setMarkers validation, get/list/clear operations
- Bug fixes: Replace Obsidian `.empty()` with native DOM API
- Fixed test mocks for region-repository imports
- All 258/260 tests passing (99.2%)

**⏸ Deferred:**
- ❌ Step 4: Editor Mode Integration (marker placement tool)
  - Reason: Complex UI work, requires separate planning
  - Status: Deferred to Phase 3.3.1

**Architecture:**
- Marker store: WeakMap-based registry per App + Map file
- Rendering: Separate SVG <g> layer in contentG
- Inspector: Conditional UI section after "Notiz" field
- Tests: Mock-based unit tests, no E2E yet

**Files:**
- `src/features/maps/state/location-marker-store.ts` (200 lines) - Store
- `src/features/maps/rendering/hex-render.ts` (+80 lines) - Rendering
- `src/workmodes/cartographer/modes/inspector.ts` (+90 lines) - Inspector
- `devkit/testing/unit/maps/location-marker-store.test.ts` (440 lines, 19 tests)

**Commits:**
- `52a4351` feat(locations): Steps 1-2 - Marker infrastructure
- `10e69c5` feat(locations): Step 3 - Inspector integration
- `a181f08` feat(locations): Step 5 - Unit tests + bug fixes

**Test Results:**
- ✅ Build: 2.8mb (successful)
- ✅ Tests: 258/260 passing (99.2%)
- ✅ +19 new location-marker-store tests
- ⏭️ 2 skipped (todo-governance, header-policy)

**Next Steps:**
- Phase 3.3.1 - Editor Mode Integration (marker placement UI) ← **NEXT**
- Phase 3.4 - Dungeons (grid maps, room features)
- Phase 4 - Event Engine (calendar automation)

---

#### Phase 3.3.1 - Marker Editor Tool ✅ COMPLETED

**Scope:** Editor Mode Tool zum Platzieren und Entfernen von Location Markern

**User Story:**
> "Als GM will ich im Cartographer Editor Mode Locations auf Hexes platzieren können, damit ich meine Karte mit wichtigen Orten annotieren kann."

**Acceptance Criteria:**
1. ✅ Neues Tool "Location Marker" im Editor Mode
2. ✅ Dropdown: Locations aus Library laden
3. ✅ Click auf Hex: Location platzieren (marker erscheint)
4. ✅ Mode-Switcher: Place/Remove Modi
5. ✅ Persistence: Marker in TileData speichern (neue Eigenschaft)
6. ✅ Auto-Sync: marker-store lädt aus TileData

**✅ Completed Implementation:**

**Schritt 1: TileData Schema erweitern** (~15min) ✅
- Extended `TileData` interface mit `locationMarker?: string` property
- Updated `tile-repository.ts` load/save functions
- Validation logic mit 200 char limit
- Backward compatibility durch optional property

**Schritt 2-5: Editor Tool & Panel** (~2h) ✅
- Created `marker-panel.ts` (330 lines) following brush-options pattern
- Location dropdown mit Library integration
- Place/Remove mode switcher
- Auto-save to TileData on hex click
- Auto-sync mit location-marker-store
- Status messages & error handling

**Schritt 6: Editor Integration** (~30min) ✅
- Updated `editor.ts` mit Multi-Tool Support
- Tool dropdown enabled mit "Brush" und "Location Marker" options
- Tool switching logic mit cleanup
- Both tools work independently
- No regressions in existing brush functionality

**Files:**
- `src/features/maps/data/tile-repository.ts` (+20 lines) - Schema extension
- `src/workmodes/cartographer/editor/tools/location-marker/marker-panel.ts` (330 lines) - Tool
- `src/workmodes/cartographer/modes/editor.ts` (+100 lines) - Multi-tool support

**Test Results:**
- ✅ Build: 2.8mb (successful)
- ✅ Tests: 258/260 passing (99.2%)
- ✅ No regressions in existing tests
- ✅ Backward compatibility maintained (optional locationMarker property)

**Out of Scope (Future Enhancements):**
- ❌ Drag & Drop Marker verschieben → later
- ❌ Multi-Hex Locations → later
- ❌ Automatic marker placement → later
- ❌ Marker editing (change location) → later (re-place stattdessen)
- ❌ Keyboard Shortcut: `L` für Location Marker Tool → later

**Total Time:** ~3 hours (15min + 2h + 30min)

---

### Phase 3.4 – Dungeons ⏳ NÄCHSTER SCHRITT

**Zielbild (Langfristig):**
Vollständiges Dungeon-Management-System für den Session Runner:
- Grid-basierte Kartenansicht (quadratisch, Rasterzellen)
- Token-Management (Spieler, NPCs, Objekte auf Grid platzieren)
- Raum-Features mit IDs (T1/T2/T3 für Türen, F1/F2/F3 für Features)
- Feature-Kategorien: Geheimnisse (G), Hindernisse (H), Schätze (S)
- Klickbare Navigation (Feature-ID → Beschreibung)
- Optional: Fog of War, Geräuschradien

**Scope-Entscheidung:**
Phase 3.4 ist zu umfangreich für einen Sprint. Aufteilung in inkrementelle Slices:

#### Phase 3.4.1 - Dungeon Data Model & Storage ✅ COMPLETED
**Scope:** Minimale Dungeon-Verwaltung als spezieller Location-Typ

**User Story:**
> "Als GM will ich Dungeons als speziellen Location-Typ in der Library verwalten können, damit ich Grid-Größe, Räume und Features strukturiert speichern kann."

**Acceptance Criteria:**
1. ✅ Dungeon-Schema: Extends Location mit grid_width, grid_height, rooms
2. ✅ Room-Schema: name, description, grid_bounds, doors, features
3. ✅ Feature-Schema: id, type (door|secret|trap|treasure|hazard), position, description
4. ✅ Library Integration: Conditional fields in create-spec, grid_size badge in browse view
5. ✅ Serializer: Markdown-Format mit YAML frontmatter

**Implementation Plan:**

**Schritt 1: Schema Definition** (~30min)
- Extend `LocationDocument` interface → `DungeonDocument`
- Add dungeon-specific fields:
  ```typescript
  type DungeonDocument = LocationDocument & {
    grid_width: number;      // Grid-Breite (z.B. 30)
    grid_height: number;     // Grid-Höhe (z.B. 20)
    cell_size: number;       // Zellgröße in Pixels (default: 40)
    rooms: DungeonRoom[];    // Array von Räumen
  };

  type DungeonRoom = {
    id: string;              // Eindeutige ID (R1, R2, ...)
    name: string;            // Name des Raums
    description: string;     // Markdown-Text mit Sinneseindrücken
    grid_bounds: {           // Raum-Bereich auf Grid
      x: number;
      y: number;
      width: number;
      height: number;
    };
    doors: DungeonDoor[];    // Türen/Ausgänge
    features: DungeonFeature[]; // Features im Raum
  };

  type DungeonDoor = {
    id: string;              // T1, T2, T3, ...
    position: { x: number; y: number };
    leads_to?: string;       // Raum-ID oder "outside"
    locked: boolean;
    description?: string;
  };

  type DungeonFeature = {
    id: string;              // F1, F2, F3, ...
    type: 'secret' | 'trap' | 'treasure' | 'hazard' | 'furniture' | 'other';
    position: { x: number; y: number };
    description: string;
  };
  ```

**Schritt 2: Serializer** (~45min)
- Create `dungeon-serializer.ts` following `location-serializer.ts` pattern
- Frontmatter: Basic fields + grid dimensions
- Body: Rooms als Markdown-Sections
  ```markdown
  ## Room R1: Entrance Hall

  **Bounds:** (0,0) - (10,8)

  ### Description
  A large hall with vaulted ceilings...

  ### Doors
  - T1 (3,0): Leads to R2 (Main Corridor)
  - T2 (10,4): Locked, leads to R3 (Treasury)

  ### Features
  - F1 (Secret): Hidden door at (7,2)
  - F2 (Trap): Pressure plate at (5,4)
  - F3 (Treasure): Chest at (8,6)
  ```

**Schritt 3: Library Integration** (~1h)
- Add Dungeon to `entity-registry.ts`
- Create `dungeon/create-spec.ts` (similar to location)
- Form fields:
  - Basic: name, type, owner, parent (from Location)
  - Grid: grid_width, grid_height, cell_size
  - Rooms: Array-Field (add/remove rooms)
  - Room Editor: Modal for editing einzelner Raum
- Browse view: Show grid dimensions badge

**Schritt 4: Tests** (~30min)
- Unit tests for dungeon-serializer
- Test room parsing and generation
- Test feature ID generation

**Out of Scope (spätere Slices):**
- ❌ Grid Renderer (visual) → Phase 3.4.2
- ❌ Token Management → Phase 3.4.3
- ❌ Interactive Room Editor → Phase 3.4.3
- ❌ Fog of War → Phase 3.4.4 (optional)

**Estimated Time:** 3 hours

**✅ Completed Implementation:**

**Schritt 1: Schema Definition** ✅
- Extended `LocationData` interface in `types.ts` with optional dungeon fields:
  - `grid_width?: number`, `grid_height?: number`, `cell_size?: number`, `rooms?: DungeonRoom[]`
- Created comprehensive type system: `DungeonRoom`, `DungeonDoor`, `DungeonFeature`, `GridBounds`, `GridPosition`
- Added helper functions: `getFeatureTypePrefix()`, `getFeatureTypeLabel()`, `isDungeonLocation()`
- Feature type prefixes: G (Geheimnisse), H (Hindernisse), S (Schätze), F (Features)

**Schritt 2: Serializer** ✅
- Extended `locationToMarkdown()` in `serializer.ts` to handle dungeon-specific sections
- Conditional rendering: Grid Size, Cell Size (non-default only), Rooms section
- Helper functions: `serializeRoom()`, `serializeDoor()`, `serializeFeature()`
- Backward compatible: Only adds sections when type === "Dungeon"

**Schritt 3: Library Integration** ✅
- Extended `LocationEntryMeta` interface with `grid_size?: string` field
- Modified `loadLocationEntry()` to extract grid dimensions for browse badges
- Added 3 conditional fields to `create-spec.ts` (visible only when type === "Dungeon"):
  - `grid_width` (number-stepper, default 30, range 5-100)
  - `grid_height` (number-stepper, default 20, range 5-100)
  - `cell_size` (number-stepper, default 40, range 20-80)
- Added grid_size badge to browse metadata: `⬚ 30×20`
- Updated frontmatter array to persist all dungeon fields

**Schritt 4: Tests** ✅
- Created `dungeon-serializer.test.ts` with 9 comprehensive test cases:
  - Basic location (no dungeon fields)
  - Dungeon with non-default cell_size
  - Dungeon without cell_size (default)
  - Single room with description
  - Room with doors (locked/unlocked)
  - Room with features (secret/trap/treasure)
  - Multi-room dungeon
  - Empty rooms array
  - All location fields preserved
- All tests passing ✅ (9/9)
- No regressions in full test suite (267/269 passing)

**Files Modified:**
- `src/workmodes/library/locations/types.ts` (+110 lines) - Schema extension
- `src/workmodes/library/locations/serializer.ts` (+60 lines) - Dungeon serialization
- `src/workmodes/library/storage/data-sources.ts` (+15 lines) - Grid size extraction
- `src/workmodes/library/locations/create-spec.ts` (+50 lines) - Conditional fields & badges
- `devkit/testing/unit/library/locations/dungeon-serializer.test.ts` (260 lines) - New test file

**Test Results:**
- ✅ Build: Successful (2.8mb)
- ✅ Tests: 267/269 passing (99.3%)
- ✅ All dungeon serializer tests passing (9/9)
- ✅ No regressions in existing functionality

**Out of Scope (Future Phases):**
- ❌ Room array editor UI (complex nested forms) → Phase 3.4.3
- ❌ Visual grid renderer → Phase 3.4.2
- ❌ Interactive token placement → Phase 3.4.3

**Total Time:** ~3 hours (matched estimate)

---

#### Phase 3.4.2 - Grid Renderer ✅ COMPLETED
**Scope:** Canvas-based Visual Grid Renderer für Dungeon-Ansicht

**User Story:**
> "Als GM will ich eine visuelle Grid-Karte meines Dungeons sehen können, damit ich Räume, Türen und Features auf einen Blick erkenne und während der Sitzung schnell navigieren kann."

**Acceptance Criteria:**
1. ✅ Canvas-based Grid Renderer (quadratisches Raster)
2. ✅ Room boundaries rendering (Raum-Rechtecke mit IDs)
3. ✅ Door markers (Position + Icon, optional locked indicator)
4. ✅ Feature markers (Position + Typ-Icon: G/H/S/F)
5. ✅ Grid lines & cell coordinates (toggle)
6. ✅ View integration: DungeonView als dedizierte Obsidian View

**Implementation Plan:**

**Schritt 1: Grid Renderer Core** (~1h)
- Create `src/features/dungeons/rendering/grid-renderer.ts`
- Canvas-based renderer mit:
  ```typescript
  interface GridRendererOptions {
    gridWidth: number;
    gridHeight: number;
    cellSize: number;
    showGrid: boolean;
    showCoordinates: boolean;
  }

  class GridRenderer {
    constructor(canvas: HTMLCanvasElement, options: GridRendererOptions);
    render(dungeon: LocationData): void;
    clear(): void;
    setOptions(options: Partial<GridRendererOptions>): void;
  }
  ```
- Grid lines drawing (horizontal/vertical)
- Cell coordinate labels (optional)

**Schritt 2: Room Rendering** (~45min)
- Render room boundaries als Rechtecke
- Room ID label im Zentrum
- Room name tooltip on hover
- Bounds: grid_bounds (x, y, width, height)
- Stroke color: distinct per room
- Fill: transparent or subtle background

**Schritt 3: Door & Feature Markers** (~1h)
- Door markers:
  - Position als kleine Icons (🚪)
  - Locked doors: 🔒 overlay
  - leads_to indicator (arrow?)
- Feature markers:
  - G (Secret): 👁️ or 🗝️
  - H (Trap/Hazard): ⚠️
  - S (Treasure): 💰
  - F (Furniture/Other): 📦
- Click handler: show tooltip mit description

**Schritt 4: View Integration** (~1h)
- Create `src/workmodes/library/locations/dungeon-view.ts`
- Mounted when location type === "Dungeon"
- Canvas container in detail view
- Toggle controls: Grid, Coordinates, Labels
- Status: "Loading...", "No rooms defined", "Ready"

**Schritt 5: Polish & Tests** (~30min)
- Responsive canvas sizing (fills container)
- Canvas exports (PNG snapshot?)
- Unit tests for grid calculations
- Visual regression test (optional)

**Out of Scope (spätere Slices):**
- ❌ Zoom/Pan controls → Phase 3.4.3
- ❌ Token placement (player/NPC positions) → Phase 3.4.3
- ❌ Click-to-edit rooms → Phase 3.4.3
- ❌ Fog of War overlay → Phase 3.4.4
- ❌ Line-of-Sight calculations → Phase 3.4.4
- ❌ Sound radius visualization → Phase 3.4.4

**Technical Decisions:**
- Canvas API statt SVG (bessere Performance für große Grids)
- Cell size in pixels (z.B. 40px = 5ft in D&D)
- Grid origin: Top-left (0,0)
- Room IDs clickable for navigation

**Estimated Time:** 4 hours (1h + 45min + 1h + 1h + 30min)

**✅ Completed Implementation:**

**Schritt 1: Grid Renderer Core** ✅
- Created `grid-renderer.ts` with Canvas-based rendering
- Grid lines drawing (horizontal/vertical) with configurable color
- Cell coordinate labels (togglable, every 5th cell)
- GridRendererOptions interface: gridWidth, gridHeight, cellSize, showGrid, showCoordinates
- Helper methods: gridToPixel(), pixelToGrid() for coordinate conversion
- Automatic canvas sizing based on grid dimensions

**Schritt 2: Room Rendering** ✅
- Room boundaries as colored rectangles with distinct colors
- 8-color palette for visual distinction between rooms
- Room ID label centered in each room
- Room name label below ID (if room height > 50px)
- Grid bounds (x, y, width, height) correctly converted to pixels
- 2px black stroke for room boundaries

**Schritt 3: Door & Feature Markers** ✅
- Door markers: 🚪 emoji at door position
- Locked door indicator: 🔒 overlay
- Door ID label below icon
- Feature markers by type:
  - Secret (G): 🔍
  - Trap/Hazard (H): ⚠️
  - Treasure (S): 💰
  - Furniture/Other (F): 📦
- Feature ID with type prefix (GF1, HF2, SF3)

**Schritt 4: View Integration** ✅
- Created `DungeonView` class extending ItemView
- Registered in VIEW_MANIFEST as "salt-dungeon-view"
- Toggle controls: Grid, Coordinates (future: Export)
- `openDungeonView()` helper function to open dungeons from files
- Reads LocationData from frontmatter
- Validates dungeon requirements (grid_width, grid_height)
- Reuses existing view or creates new leaf

**Schritt 5: Polish** ✅
- Responsive canvas sizing (updates on grid dimension changes)
- Control buttons for toggling grid/coordinates
- Error handling and logging
- Type guards for dungeon validation
- Clean separation of concerns (renderer ↔ view ↔ integration)

**Files Created:**
- `src/features/dungeons/rendering/grid-renderer.ts` (240 lines) - Core renderer
- `src/workmodes/library/locations/dungeon-view.ts` (224 lines) - View integration
- Modified: `src/workmodes/view-manifest.ts` (+10 lines) - View registration

**Test Results:**
- ✅ Build: Successful (2.8mb)
- ✅ Tests: 267/269 passing (99.3%)
- ✅ No regressions in existing functionality
- ✅ TypeScript compilation clean

**Out of Scope (Deferred):**
- ❌ CSS styling for controls → Quick follow-up
- ❌ "View Grid" action in Library → Follow-up
- ❌ Click handlers for tooltips → Phase 3.4.3
- ❌ Zoom/Pan controls → Phase 3.4.3

**Total Time:** ~4 hours (matched estimate)

---

#### Phase 3.4.3 - Navigation & Interactivity ⏳ NÄCHSTER SCHRITT
**Scope:** Zoom/Pan Controls und Click-to-Highlight für bessere Dungeon-Navigation

**User Story:**
> "Als GM will ich große Dungeons durch Zoom/Pan navigieren und Räume/Features anklicken können, damit ich während der Sitzung schnell Details anzeigen und den Fokus ändern kann."

**Acceptance Criteria:**
1. ⏳ Zoom/Pan Controls (Mausrad + Drag)
2. ⏳ Click-to-highlight rooms (visuelles Feedback)
3. ⏳ Hover tooltips für doors/features (zeige description)
4. ⏳ Room detail panel (zeige room info on click)
5. ⏳ Zoom-Level Indicator (z.B. "100%")

**Implementation Plan:**

**Schritt 1: Zoom/Pan Infrastructure** (~1.5h)
- Extend GridRenderer mit Transform-State (scale, offsetX, offsetY)
- Zoom via Mausrad: scale *= (1 + delta * 0.001)
- Pan via Drag: update offsetX/offsetY on mousemove
- Constrain: minScale=0.5, maxScale=3.0
- Transform all rendering coordinates

**Schritt 2: Click-to-Highlight** (~1h)
- Add click event listener to canvas
- Convert canvas coords → grid coords (account for transform)
- Find clicked room/door/feature
- Highlight selected room (thicker border + glow effect)
- Clear highlight on background click

**Schritt 3: Hover Tooltips** (~1h)
- Track mouse position on canvas
- Detect hovered door/feature
- Show tooltip div at mouse position
- Display: ID, type, description
- Hide on mouse leave

**Schritt 4: Room Detail Panel** (~1h)
- Add side panel to DungeonView
- Show on room click: Name, Description, Doors, Features
- "Close" button
- Scroll if content exceeds height

**Schritt 5: Polish & Tests** (~30min)
- Zoom level indicator (e.g., "125%")
- Reset view button (back to 100%, centered)
- Cursor feedback (grab/grabbing for pan)
- Unit tests for coordinate transforms

**Out of Scope (Phase 3.4.4):**
- ❌ Token Management (player/NPC tokens) → Phase 3.4.4
- ❌ Drag & Drop tokens → Phase 3.4.4
- ❌ Edit room data from UI → Phase 3.4.4
- ❌ Fog of War → Phase 3.4.5 (optional)

**Technical Decisions:**
- Canvas transform via ctx.save/restore + translate/scale
- Click detection: adjust for transform with inverse matrix
- Tooltips: absolute-positioned div, not canvas rendering
- Room panel: flexbox sidebar, togglable

**Estimated Time:** 5 hours (1.5h + 1h + 1h + 1h + 30min)

---

#### Phase 3.4.4 - Token Management ⏳ Later
**Scope:** Drag & Drop Token-Placement für Spieler/NPCs/Objekte
- Token types: Player, NPC, Monster, Object
- Drag & Drop from palette
- Move tokens on grid
- Token state persistence

**Estimated Time:** 4-5 hours

---

#### Phase 3.4.5 - Advanced Features ⏳ Optional
**Scope:** Fog of War, Sound Radii, Line-of-Sight
- FOW overlay (revealed/hidden cells)
- Sound propagation visualization
- LOS calculations

**Estimated Time:** 4-6 hours (optional)

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
