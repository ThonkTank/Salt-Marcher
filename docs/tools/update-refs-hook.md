# Update-Refs Hook

Automatisches Update von Markdown-Links und CLAUDE.md bei Änderungen in `docs/`.

---

## Überblick

Der Hook erfüllt zwei Aufgaben:

1. **Referenz-Updates**: Bei `mv`/`git mv` werden alle Markdown-Links aktualisiert
2. **Docs-Tree-Updates**: Bei jeder Strukturänderung wird die Projektstruktur in CLAUDE.md neu generiert

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
| Bash | `update-refs.mjs` | Referenz-Updates + Docs-Tree |
| Write | `update-docs-tree.mjs` | Nur Docs-Tree |

### Erkannte Befehle (Bash)

| Befehl | Referenz-Update | Docs-Tree-Update |
|--------|-----------------|------------------|
| `mv` / `git mv` | ✅ | ✅ |
| `rm` | – | ✅ |
| `mkdir` | – | ✅ |

### Ablauf

1. Hook erhält Kommando/Dateipfad via stdin (JSON)
2. Prüft ob `docs/` betroffen ist
3. Bei `mv`: Aktualisiert alle Markdown-Links
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

- Nur Pfade in `docs/` werden verarbeitet
- Nur erfolgreich ausgeführte mv-Befehle (exitCode 0)
- Keine Unterstützung für Glob-Patterns: `mv *.md dest/`
- Keine Unterstützung für Mehrfach-Quellen: `mv file1 file2 dest/`
