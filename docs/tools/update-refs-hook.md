# Update-Refs Hook

Automatisches Update von Markdown-Links, TypeScript-Imports, JSON-Pfaden und CLAUDE.md bei Datei-Verschiebungen.

---

## Überblick

Der Hook erfüllt vier Aufgaben:

1. **Referenz-Updates**: Bei `mv`/`git mv` werden alle Referenzen aktualisiert (Markdown-Links, Imports, JSON-Pfade)
2. **Rename-Erkennung**: Delete+Create-Sequenzen werden als Renames erkannt und Referenzen automatisch aktualisiert
3. **Projektstruktur-Updates**: Bei Strukturänderungen wird die Projektstruktur in CLAUDE.md neu generiert
4. **Selbstständig**: Alle Logik ist in `.claude/hooks/` enthalten, keine externen Dependencies

**Unterstützte Verzeichnisse:**
- `docs/` - Markdown-Dokumentation
- `src/` - TypeScript-Source
- `scripts/` - JavaScript-Skripte
- `presets/` - Preset-Daten

**Unterstützte Dateitypen:**
- `.md` - Markdown-Links `[text](path)`
- `.ts`, `.tsx`, `.js`, `.mjs` - Import/Export-Statements
- `.json` - Pfad-Referenzen (tsconfig, package.json, etc.)

**Beispiele:**
```bash
# Markdown-Datei verschieben
git mv docs/entities/creature.md docs/entities/creature-definition.md
# -> Alle Links auf "creature.md" werden aktualisiert

# TypeScript-Datei verschieben
git mv src/types/common/Result.ts src/core/Result.ts
# -> Alle Imports werden aktualisiert (Aliases bevorzugt)

# Ganzer Ordner
git mv docs/domain docs/entities
# -> Alle Links auf Dateien in "domain/" werden aktualisiert
```

---

## Funktionsweise

### Trigger

| Tool | Hook | Aktion |
|------|------|--------|
| Bash | `update-refs.mjs` | Referenz-Updates + Deletion-Tracking + Projektstruktur |
| Write | `update-docs-tree.mjs` | Rename-Erkennung + Projektstruktur |

### Erkannte Befehle (Bash)

| Befehl | Referenz-Updates | Deletion-Tracking | Projektstruktur |
|--------|------------------|-------------------|-----------------|
| `mv` / `git mv` | ✅ | – | ✅ |
| `rm` | – | ✅ (für Rename) | ✅ |
| `mkdir` | – | – | ✅ |

### Ablauf

1. Hook erhält Kommando/Dateipfad via stdin (JSON)
2. Prüft ob ein unterstütztes Verzeichnis betroffen ist
3. Bei `mv`: Aktualisiert alle Referenzen (Markdown, Imports, JSON)
4. Bei jeder Änderung: Regeneriert Projektstruktur in CLAUDE.md

### Unterstützte Formate

- `mv source dest` / `git mv source dest`
- Mit Flags: `mv -i source dest`
- Mit Anführungszeichen: `mv "path with spaces" "dest"`
- Ordner-Renames: `git mv src/old-folder src/new-folder`

### Rename-Erkennung (Delete + Create)

Der Hook erkennt Delete+Create-Sequenzen als Renames:

| Schritt | Tool | Aktion |
|---------|------|--------|
| 1 | Bash (`rm`) | Datei wird als "gelöscht" gemerkt (60s Timeout) |
| 2 | Write | Neue Datei wird erstellt |
| 3 | Hook | Vergleicht Dateinamen, führt Referenz-Update aus |

**Beispiel:**
```bash
rm docs/entities/creature.md          # Schritt 1: Deletion gemerkt
# Write tool: docs/data/creature.md   # Schritt 2: Match gefunden
# -> Alle Referenzen werden aktualisiert
```

**Matching-Algorithmus:**
- Vergleich nach Dateiname (basename), case-insensitive
- Bei mehreren Matches: Neuester Timestamp gewinnt
- Timeout: 60 Sekunden zwischen Delete und Create

**State-Datei:** `.claude/.hook-state.json` (gitignored, ephemeral)

### Referenz-Typen

**Markdown (.md):**
- `[Text](pfad.md)`
- `[Text](pfad.md#section)`

**TypeScript/JavaScript (.ts, .tsx, .js, .mjs):**
- `import { X } from 'path'`
- `import X from 'path'`
- `import * as X from 'path'`
- `import type { X } from 'path'`
- `export { X } from 'path'`
- `export * from 'path'`
- `import('path')` (dynamic imports)

**JSON (.json):**
- Pfade die mit `./`, `../` oder `src/` beginnen
- tsconfig.json `paths`-Objekt
- package.json `main`, `types`, `exports`

**Path-Aliases:**
Der Hook bevorzugt Path-Aliases wo möglich:
- `#entities/*` -> `src/types/entities/*`
- `#types/*` -> `src/types/*`
- `@/*` -> `src/*`

---

## Dateien

| Datei | Beschreibung |
|-------|--------------|
| `.claude/hooks/update-refs.mjs` | Bash-Hook: mv/rm Erkennung + Referenz-Updates |
| `.claude/hooks/update-docs-tree.mjs` | Write-Hook: Rename-Erkennung + Projektstruktur |
| `.claude/hooks/ref-utils.mjs` | Kern-Logik: Referenz-Updates für alle Dateitypen |
| `.claude/hooks/hook-state.mjs` | State-Management für Rename-Erkennung |
| `.claude/hooks/docs-tree.mjs` | Tree-Generierung für CLAUDE.md |

---

## Konfiguration

Hooks sind in `.claude/settings.json` registriert:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Bash",
        "hooks": [{
          "type": "command",
          "command": "node .claude/hooks/update-refs.mjs"
        }]
      },
      {
        "matcher": "Write",
        "hooks": [{
          "type": "command",
          "command": "node .claude/hooks/update-docs-tree.mjs"
        }]
      }
    ]
  }
}
```

### Ignore-Liste

Folgende Verzeichnisse werden nicht gescannt:
- `node_modules`
- `.git`
- `dist`, `build`
- `.claude`
- `Archive`
- `.obsidian`, `.vscode`
- `coverage`

---

## Einschränkungen

**Allgemein:**
- Nur erfolgreich ausgeführte Befehle (exitCode 0)
- Keine Unterstützung für Glob-Patterns: `mv *.md dest/`
- Keine Unterstützung für Mehrfach-Quellen: `mv file1 file2 dest/`
- **Rename-Erkennung:** Nur bei gleichem Dateinamen (basename), Timeout 60 Sekunden

**Nicht unterstützt:**
- `[[Wiki-Links]]`
- HTML-Links
- `.d.ts` Dateien (TypeScript Declaration Files)
- `.test.ts` Dateien
