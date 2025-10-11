# Gap-Analyse & Refactor-Plan

## Gaps zwischen Ist und Soll
1. **Fehlende Deklarativität** – Workmodes erzeugen Obsidian-`Setting`-Controls manuell; es gibt keine Feld-Spezifikation oder Renderer-Registry.
2. **Uneinheitliche Validierung** – Individuelle Funktionen (`collectSpellScalingIssues`, `collectItemValidationIssues`, etc.) statt zentralem Schema.
3. **Storage-Spezifika pro Modal** – Markdown (Frontmatter + Body) und Codeblock-Formate werden direkt im Modal bzw. Renderer behandelt, ohne gemeinsame `StorageSpec`.
4. **Atlas ohne Modal** – `TerrainsRenderer` und `RegionsRenderer` pflegen Inline-Editing, Debounce-Speichern, keine Pipeline-Hooks.
5. **Fehlende Transformations-/Migrations-Hooks** – Legacy-Daten (Creature Spellcasting) werden ad hoc migriert; kein Contract für `preSave`.
6. **Testlücken** – Unit-/Integrationstests für Modal-Pipeline, Storage-Renderer und Schema fehlen.
7. **Dokumentation** – Kein zentraler Leitfaden für neue Workmodes; bestehende README/Docs decken Create-Pipeline nicht ab.

## Milestones & ToDos
### M1 – Analyse & Contract Finalisieren (aktuell)
- [x] Dokumentation des Ist-Zustands (Analyse, API-Contract, Gap-Plan). Aufwand: **M**. Risiko: gering.
- [ ] Stakeholder-Review des Contracts einholen (Library & Atlas Maintainer). Aufwand: **S**. Risiko: gering.

### M2 – Create-Modal erweitern
- [ ] Feld-Registry und Renderer-Infrastruktur implementieren (Text, Number, Select, Toggle, Color, Markdown, Tags). Aufwand: **L**. Risiko: mittel – UI-Regressionen möglich.
- [ ] Schema-Integration (Zod) + Validator-Mapping. Aufwand: **M**. Risiko: mittel – Fehlermeldungs-UX muss abgestimmt werden.
- [ ] Storage-Layer (`StorageSpec`, Pfad-Templates, Markdown/Codeblock-Renderer, Hooks). Aufwand: **L**. Risiko: hoch – Dateiformate dürfen sich nicht ändern.
- [ ] Pipeline-API (`openCreateModal`, Transformer-Hooks, Defaults) fertigstellen. Aufwand: **M**. Risiko: mittel.
- [ ] Unit-Tests für Registry, Storage, Schema-Pipeline (Temp-Vault). Aufwand: **M**. Risiko: gering.

### M3 – Terrain-Manager migrieren (Pilot)
- [ ] Spezifikation `terrain` definieren (Schema, Felder, StorageSpec mit `codeblock`). Aufwand: **M**. Risiko: hoch – Codeblock muss unverändert bleiben.
- [ ] Renderer auf Shared Modal umstellen (`handleCreate` → `openCreateModal`, AutoSave-Ersatz). Aufwand: **M**. Risiko: hoch – UX-Änderung (kein Inline-Edit) erfordert Abstimmung.
- [ ] Post-Save-Hooks implementieren (Reload, Fokus auf Suche). Aufwand: **S**. Risiko: gering.
- [ ] Regressionstest: Terrains erstellen/umbenennen, Codeblock diff. Aufwand: **S**.

### M4 – Weitere Workmodes migrieren
- **Library**
  - [ ] Creature-Spec ableiten (Kompositfelder, Entry-Manager-Widget registrieren). Aufwand: **L**. Risiko: hoch – komplexe UI.
  - [ ] Spell/Item/Equipment-Specs erstellen (Felder & Storage-Mapping). Aufwand: **M**. Risiko: mittel.
  - [ ] Validierung (Zod-Schema) + Transformationslogik (z. B. Spell Scaling). Aufwand: **M**.
- **Atlas Regions**
  - [ ] Region-Spec (Terrain-Select, Encounter Odds). Aufwand: **M**. Risiko: mittel.
  - [ ] Replace Inline-Edit mit Modal + optionalem Bulk-Editor (UX-Review). Aufwand: **M**.
- **Weitere Mods (z. B. Items/Presets)** – nach Bedarf, sobald Contract stabil ist. Aufwand: **S** pro Modus.

### M5 – Bereinigung, Docs & Tests
- [ ] Legacy-Modal-Implementierungen entfernen, Workmode-spezifische Dateien verschlanken. Aufwand: **M**.
- [ ] README/AGENTS aktualisieren (Modal-Usage, Storage-Contracts). Aufwand: **S**.
- [ ] Automatisierte Tests erweitern (Smoke-Test Modal, Snapshot Markdown/Codeblocks). Aufwand: **M**.
- [ ] Developer Guide für neue Workmodes schreiben. Aufwand: **S**.

## Risiken & Mitigation
- **Format-Regressionen** – Schreiben in bestehende Markdown-/Codeblock-Dateien könnte Diff erzeugen → Snapshot-Tests & Dry-Run-Modus in Storage-Layer.
- **UX-Veränderungen im Atlas** – Nutzer gewohnt an Inline-Edit → Modal muss schnelle Bearbeitung (z. B. Hotkeys, Draft-Save) unterstützen; ggf. hybride Lösung.
- **Performance** – Zod-Validierung großer Creature-Drafts → Lazy-Validation + Debounce bei `visibleIf`.
- **Widget-Komplexität** – Creature-Entry-Manager benötigt spezialisiertes Widget; Registry muss Custom-Factories erlauben.

## Migrationsschritte
1. **Schema-Verifikation**: Bestehende Dateien mit neuen Zod-Schemas validieren (Script in `tools/`), Report generieren.
2. **Backup/Export**: Vor Migration Terrains/Regions Markdown sichern (automatisches Vault-Backup).
3. **Feature Flags**: Neues Modal optional aktivieren (`appSetting.enableUnifiedCreate`) für stufenweise Adoption.
4. **Script**: Falls Markdown-Format sich minimal ändert, Auto-Migration-Script bereitstellen (z. B. Sortierung normalisieren).

## Testplan
- **Unit**: Registry-Renderer, Storage-Serialization, Schema-Parser.
- **Integration**: Modal öffnet, Validation & Persistenz in Temp-Vault (jest/vitest).
- **End-to-End**: Workmode-List mit neuem Modal (Vitest DOM, Screenshot-Diff optional).
- **Regression**: Golden Files für Terrains/Regions, Markdown Snapshots für Creatures/Spells.

## POC-Status
Kein POC-Commit umgesetzt. Grund: Der Contract muss zuerst stehen (insbesondere StorageSpec für Codeblock-Listen), bevor eine risikoarme Terrain-Migration möglich ist.
