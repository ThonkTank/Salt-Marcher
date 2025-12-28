# Update-Refs Hook

Automatisches Update von Markdown-Links und CLAUDE.md bei Änderungen in `docs/` oder `src/`.

---

## Überblick

Der Hook erfüllt drei Aufgaben:

1. **Referenz-Updates**: Bei `mv`/`git mv` in `docs/` werden alle Markdown-Links aktualisiert
2. **Rename-Erkennung**: Delete+Create-Sequenzen werden als Renames erkannt und Referenzen automatisch aktualisiert
3. **Projektstruktur-Updates**: Bei Strukturänderungen in `docs/` oder `src/` wird die Projektstruktur in CLAUDE.md neu generiert (inkl. Beschreibungen aus Zeile 1 bei .ts-Dateien und Zeile 3 bei .md-Dateien)

**Beispiele:**
```bash
# Einzelne Datei
git mv docs/entities/creature.md docs/entities/creature-definition.md
# → Alle Links auf "creature.md" werden aktualisiert

# Ganzer Ordner
git mv docs/domain docs/entities
# → Alle Links auf Dateien in "domain/" werden aktualisiert
```

---

## Funktionsweise

### Trigger

| Tool | Hook | Aktion |
|------|------|--------|
| Bash | `update-refs.mjs` | Referenz-Updates + Deletion-Tracking + Projektstruktur |
| Write | `update-docs-tree.mjs` | Rename-Erkennung + Projektstruktur |

### Erkannte Befehle (Bash)

| Befehl | Referenz-Update (docs/) | Deletion-Tracking | Projektstruktur-Update |
|--------|------------------------|-------------------|------------------------|
| `mv` / `git mv` | ✅ | – | ✅ |
| `rm` | – | ✅ (für Rename-Erkennung) | ✅ |
| `mkdir` | – | – | ✅ |

### Ablauf

1. Hook erhält Kommando/Dateipfad via stdin (JSON)
2. Prüft ob `docs/` oder `src/` betroffen ist
3. Bei `mv` in `docs/`: Aktualisiert alle Markdown-Links
4. Bei jeder Änderung: Regeneriert Projektstruktur in CLAUDE.md

### Unterstützte Formate

- `mv source dest` / `git mv source dest`
- Mit Flags: `mv -i source dest`
- Mit Anführungszeichen: `mv "path with spaces" "dest"`
- Ordner-Renames: `git mv docs/old-folder docs/new-folder`

### Link-Typen

Nur Standard-Markdown-Links werden aktualisiert:
- `[Text](pfad.md)`
- `[Text](pfad.md#section)`

Nicht unterstützt:
- `[[Wiki-Links]]`
- HTML-Links

---

## Dateien

| Datei | Beschreibung |
|-------|--------------|
| `.claude/hooks/update-refs.mjs` | Bash-Hook: Referenzen + Docs-Tree |
| `.claude/hooks/update-docs-tree.mjs` | Write-Hook: Nur Docs-Tree |
| `.claude/hooks/docs-tree.mjs` | Shared: Tree-Generierung |
| `scripts/services/ref-updater-service.mjs` | Core: Referenz-Updates |

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

- **Referenz-Updates:** Nur für Pfade in `docs/` (Markdown-Links)
- **Projektstruktur-Updates:** Für `docs/` und `src/`
- Nur erfolgreich ausgeführte Befehle (exitCode 0)
- Keine Unterstützung für Glob-Patterns: `mv *.md dest/`
- Keine Unterstützung für Mehrfach-Quellen: `mv file1 file2 dest/`
- Bei `src/`: Nur `.ts`-Dateien (keine `.d.ts`, `.test.ts`, `.js`)
- Bei `docs/`: Beschreibungen werden aus Zeile 3 extrahiert (führendes `> ` und `**Label:**` werden entfernt)
