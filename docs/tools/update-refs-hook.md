# Update-Refs Hook

Automatisches Update von Markdown-Links, TypeScript-Imports und CLAUDE.md bei Änderungen in `docs/` oder `src/`.

---

## Überblick

Der Hook erfüllt vier Aufgaben:

1. **Markdown-Referenz-Updates**: Bei `mv`/`git mv` in `docs/` werden alle Markdown-Links aktualisiert
2. **Import-Updates**: Bei `mv`/`git mv` in `src/` werden alle TypeScript-Imports aktualisiert
3. **Rename-Erkennung**: Delete+Create-Sequenzen werden als Renames erkannt und Referenzen/Imports automatisch aktualisiert
4. **Projektstruktur-Updates**: Bei Strukturänderungen in `docs/` oder `src/` wird die Projektstruktur in CLAUDE.md neu generiert (inkl. Beschreibungen aus Zeile 1 bei .ts-Dateien und Zeile 3 bei .md-Dateien)

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

git mv src/services/encounter src/services/combat
# -> Alle Imports auf Dateien in "encounter/" werden aktualisiert
```

---

## Funktionsweise

### Trigger

| Tool | Hook | Aktion |
|------|------|--------|
| Bash | `update-refs.mjs` | Referenz-Updates + Import-Updates + Deletion-Tracking + Projektstruktur |
| Write | `update-docs-tree.mjs` | Rename-Erkennung + Projektstruktur |

### Erkannte Befehle (Bash)

| Befehl | docs/ Links | src/ Imports | Deletion-Tracking | Projektstruktur |
|--------|-------------|--------------|-------------------|-----------------|
| `mv` / `git mv` | ✅ | ✅ | – | ✅ |
| `rm` | – | – | ✅ (für Rename) | ✅ |
| `mkdir` | – | – | – | ✅ |

### Ablauf

1. Hook erhält Kommando/Dateipfad via stdin (JSON)
2. Prüft ob `docs/` oder `src/` betroffen ist
3. Bei `mv` in `docs/`: Aktualisiert alle Markdown-Links
4. Bei `mv` in `src/`: Aktualisiert alle TypeScript-Imports
5. Bei jeder Änderung: Regeneriert Projektstruktur in CLAUDE.md

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
| 3 | Hook | Vergleicht Dateinamen, führt Referenz-/Import-Update aus |

**Beispiel (docs/):**
```bash
rm docs/entities/creature.md          # Schritt 1: Deletion gemerkt
# Write tool: docs/data/creature.md   # Schritt 2: Match gefunden
# -> Alle Links auf "creature.md" werden aktualisiert
```

**Beispiel (src/):**
```bash
rm src/types/common/Result.ts         # Schritt 1: Deletion gemerkt
# Write tool: src/core/Result.ts      # Schritt 2: Match gefunden
# -> Alle Imports auf "Result.ts" werden aktualisiert
```

**Matching-Algorithmus:**
- Vergleich nach Dateiname (basename), case-insensitive
- Bei mehreren Matches: Neuester Timestamp gewinnt
- Timeout: 60 Sekunden zwischen Delete und Create

**State-Datei:** `.claude/.hook-state.json` (gitignored, ephemeral)

### Link-Typen (docs/)

Nur Standard-Markdown-Links werden aktualisiert:
- `[Text](pfad.md)`
- `[Text](pfad.md#section)`

Nicht unterstützt:
- `[[Wiki-Links]]`
- HTML-Links

### Import-Typen (src/)

Alle TypeScript/JavaScript-Import-Varianten werden aktualisiert:
- `import { X } from 'path'`
- `import X from 'path'`
- `import * as X from 'path'`
- `import type { X } from 'path'`
- `export { X } from 'path'`
- `export * from 'path'`
- `import('path')` (dynamic imports)

**Path-Aliases:**
Der Hook bevorzugt Path-Aliases wo möglich:
- `#types/*` -> `src/types/*`
- `@/*` -> `src/*`

**Beispiel:**
```typescript
// Vorher (relative imports)
import { Result } from '../types/common/Result';
import { ok } from '../../core/utils';

// Nachher (mit Aliases)
import { Result } from '#types/common/Result';
import { ok } from '@/core/utils';
```

---

## Dateien

| Datei | Beschreibung |
|-------|--------------|
| `.claude/hooks/update-refs.mjs` | Bash-Hook: Referenzen + Imports + Deletion-Tracking + Docs-Tree |
| `.claude/hooks/update-docs-tree.mjs` | Write-Hook: Rename-Erkennung + Docs-Tree |
| `.claude/hooks/hook-state.mjs` | State-Management für Rename-Erkennung |
| `.claude/hooks/docs-tree.mjs` | Shared: Tree-Generierung |
| `scripts/services/ref-updater-service.mjs` | Core: Markdown-Referenz-Updates |
| `scripts/services/import-updater-service.mjs` | Core: TypeScript-Import-Updates |

---

## CLI: Kaputte Links finden

```bash
node scripts/task.mjs scan-refs
```

Zeigt alle kaputten Referenzen mit Datei, Zeile und Fehlertyp:

```
docs/features/Travel.md:42
  [Terrain](../domain/Terrain.md)
  FILE_NOT_FOUND
```

**Fehlertypen:**
- `FILE_NOT_FOUND` – Zieldatei existiert nicht
- `ANCHOR_NOT_FOUND` – Datei existiert, Überschrift fehlt

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

---

## Einschränkungen

**Allgemein:**
- Nur erfolgreich ausgeführte Befehle (exitCode 0)
- Keine Unterstützung für Glob-Patterns: `mv *.md dest/`
- Keine Unterstützung für Mehrfach-Quellen: `mv file1 file2 dest/`
- **Rename-Erkennung:** Nur bei gleichem Dateinamen (basename), Timeout 60 Sekunden

**docs/ (Markdown-Links):**
- Beschreibungen werden aus Zeile 3 extrahiert (führendes `> ` und `**Label:**` werden entfernt)

**src/ (TypeScript-Imports):**
- Nur `.ts`/`.tsx`-Dateien (keine `.d.ts`, `.js`, `.mjs`)
- Scannt `src/` und `scripts/` für Import-Updates
- Beschreibungen werden aus Zeile 1 extrahiert (Kommentar-Präfix `// ` entfernt)
