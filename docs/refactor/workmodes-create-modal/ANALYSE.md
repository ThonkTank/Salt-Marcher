# Überblick
Dieses Dokument fasst den Ist-Zustand der Create-/Edit-Flows in den Workmodes der Salt-Marcher-Library und des Atlas zusammen. Es liefert die Basis für die Vereinheitlichung über ein gemeinsames Create-Modal.

## IST-Befunde
### Workmodes & Create/Edit/Save-Pfade
- **Library – Creatures**
  - Create-Entry-Trigger über `LIBRARY_VIEW_CONFIGS.creatures.handleCreate` (`src/apps/library/view/view-registry.ts`), öffnet `CreateCreatureModal` mit Pipeline (`serialize` → `persist` → `onComplete`).
  - Edit nutzt denselben Modal-Typ, lädt Presets via `loadCreaturePreset`, Persistenz `createCreatureFile` (`StatblockData` in `SaltMarcher/Creatures`).
  - Speicherung über `createVaultFilePipeline` → Markdown mit YAML-Frontmatter + strukturierte Body-Sections (`src/apps/library/core/creature-files.ts`).
- **Library – Spells**
  - Create/Edit in `CreateSpellModal` (Settings-basierte Form). Pipelines rufen `createSpellFile` bzw. `app.vault.modify` an (`view-registry.ts`).
  - Speicherung als Markdown mit `smType: spell` Frontmatter (`spellToMarkdown` in `src/apps/library/core/spell-files.ts`).
- **Library – Items**
  - Modal `CreateItemModal` mit Validierung `collectItemValidationIssues`. Create-Handler in `view-registry.ts` nutzt `createItemFile`.
  - Markdown-Dateien unter `SaltMarcher/Items` mit umfangreicher Frontmatter (JSON-Strings für komplexe Felder) (`itemToMarkdown`).
- **Library – Equipment**
  - Modal `CreateEquipmentModal` inklusive Typ-spezifischer Renderpfade (`weapon`/`armor`/`tool`/`gear`). Pipeline ruft `createEquipmentFile` (`equipmentToMarkdown`).
- **Atlas – Terrains**
  - Renderer `TerrainsRenderer` (`src/apps/atlas/view/terrains.ts`) verwaltet lokale Forminputs (Text, Color, Number) und speichert direkt nach Debounce via `saveTerrains`.
  - Daten liegen gesammelt in `SaltMarcher/Terrains.md` als ```terrain```-Codeblock (`src/core/terrain-store.ts`).
- **Atlas – Regions**
  - `RegionsRenderer` rendert Inputs + Select mit Live-Speichern (`saveRegions`).
  - Persistenz im Markdown-Codeblock ```regions``` in `SaltMarcher/Regions.md` (`src/core/regions-store.ts`).
- **Basis-Infrastruktur**
  - Alle Library-Modi verwenden `FilterableLibraryRenderer` (`src/apps/library/view/filterable-mode.ts`) mit `handleCreate`-Hook → `LibraryViewConfig`.
  - Atlas-Renderer erben von `BaseModeRenderer`, verwalten jedoch Create/Save eigenständig.

### Feld- & Widget-Inventar
- `Setting.addText`, `addDropdown`, `addToggle`, `addTextArea` innerhalb der Modals (Text, Select, Checkbox, Markdown-Area).
- `createNumberStepper`, `createNumberInput`, `createSelectDropdown`, `enhanceExistingSelectDropdown` in `src/ui/workmode/create/form-controls.ts` (Stepper, Zahlen, searchable Selects).
- `mountTokenEditor` (`token-editor.ts`) für Chips/Tags.
- Creature-spezifisch: `createFieldGrid`, `createRepeatingGrid`, `mountEntryManager`, `createStatColumn`, `createMovementModel`, `mountPresetSelectEditor` (Array-of-object, Komposit-Statblocks, Preset-Autocomplete).
- Atlas-Terrains: direkte HTML-Inputs (Text, Color, Number) ohne Registry.

### Speicherformate & Konventionen
- **Markdown mit YAML-Frontmatter**
  - Creatures (`smType: creature`, modulare Sections via Markdown-Renderer) – Pfad `SaltMarcher/Creatures/<Name>.md`.
  - Spells (`smType: spell`) – `SaltMarcher/Spells/<Name>.md`.
  - Items (`smType: item`, JSON-Strings in Frontmatter) – `SaltMarcher/Items/<Name>.md`.
  - Equipment (`smType: equipment`) – `SaltMarcher/Equipment/<Name>.md` (Analog zu Items, Variation je Typ).
- **Listen-Dateien**
  - Terrains (`SaltMarcher/Terrains.md`): YAML-Frontmatter `smList: true`, Codeblock-Liste, Parser/Serializer `parseTerrainBlock` / `stringifyTerrainBlock`.
  - Regions (`SaltMarcher/Regions.md`): analog, `parseRegionsBlock` / `stringifyRegionsBlock`.
- Dateinamen über `createVaultFilePipeline` → `sanitizeVaultFileName`, Auto-Numbering bei Konflikten.

### Status des gemeinsamen Create-Modals (`src/ui/workmode/create`)
- `BaseCreateModal` liefert Navigation (Sections), Validierungssammelpunkt, Pipeline (`serialize`/`persist`/`onComplete`), Default Textarea-Helfer.
- Layouts: `createFormCard`, `createFieldGrid`, `createIrregularGrid`, `createRepeatingGrid` für karten-/gridbasierte Formulare.
- Formkomponenten: `form-controls.ts`, `token-editor.ts`, `entry-card.ts`, `entry-manager.ts` (Listendaten mit Add/Delete), Demo vorhanden (`demo.ts`).
- Fehlende Elemente für voll-deklarativen Einsatz:
  - Kein Schema-gesteuerter Renderer – Felder werden direkt mit Obsidian-`Setting`-APIs erstellt.
  - Validierung/Defaultwerte individuell (Zod/Schema nicht integriert).
  - Storage-Pipeline erfordert manuelle Implementierung je Modal (kein StorageSpec-Vertrag).

### Lokale Render-/Save-Logik
- **Terrains/Regions**: Direktmanipulation der Renderer mit Debounce-Speichern, ohne `BaseCreateModal` oder gemeinsame Formkontrollen.
- **Creature Sections**: Nutzen gemeinsame Layouts, aber Logik stark modal-spezifisch (Preset-Autocomplete, Entry-Manager) – schwer wiederverwendbar ohne Contract.
- **Validation**: `collectSpellScalingIssues`, `collectItemValidationIssues`, `collectEquipmentValidationIssues` implementieren Checks lokal.

## Probleme
- Hohe Duplizierung bei Felddefinitionen und Obsidian-`Setting`-Verkabelung in jedem Modal.
- Kein deklaratives Mapping von Schema → UI → Storage; jede Modal-Datei pflegt Werte manuell.
- Atlas-Renderer umgehen das Shared-Modal komplett (kein Pipeline-Hook, kein Persistenz-Contract).
- Validierung heterogen (teilweise boolesche Rückgaben, teilweise string-Listen) → schwer zu standardisieren.
- Storage-Anbindung für Markdown vs. Codeblock-Listen unterscheidet sich fundamental, ohne gemeinsame Abstraktion.

## Risiken
- Migration der Terrains/Regions auf ein Modal muss Codeblock-Formate exakt erhalten (Parser/Serializer sensibel).
- Schema-Änderungen könnten bestehende Dateien invalidieren – benötigt Migrations-/Validierungsstrategie.
- Zentralisierung birgt Gefahr, dass komplexe Creature-Features (Entry-Manager, Spellcasting) im generischen Modal schwer abbildbar sind.
- Fehlende Testabdeckung für Modal-Pipelines erhöht Risiko von Regressions beim Schreiben/Umbenennen von Dateien.
- UI-Verhalten (Autosave, Debounce) in Atlas könnte durch Standard-Modal verändert werden → Nutzererwartung prüfen.
