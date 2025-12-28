# Update-Refs Hook

Automatisches Update von Markdown-Links bei Dateiverschiebungen in `docs/`.

---

## Überblick

Wenn Dateien in `docs/` per `mv` oder `git mv` verschoben werden, aktualisiert dieser Hook automatisch alle Markdown-Links, die auf die verschobene Datei zeigen.

**Beispiel:**
```bash
git mv docs/entities/creature.md docs/entities/creature-definition.md
# → Alle Links auf "entities/creature.md" werden zu "entities/creature-definition.md" aktualisiert
```

---

## Funktionsweise

### Trigger

PostToolUse-Hook auf `Bash`-Tool. Wird nach jedem Bash-Kommando ausgeführt.

### Ablauf

1. Hook erhält Kommando und Exit-Code via stdin (JSON)
2. Parst `mv` oder `git mv` Befehle
3. Prüft ob Source-Pfad in `docs/` liegt
4. Bei Erfolg: Findet und ersetzt alle Markdown-Links in `docs/`

### Unterstützte Formate

- `mv source dest`
- `mv -i source dest` (mit Flags)
- `git mv source dest`
- Pfade mit Anführungszeichen: `mv "path with spaces" "dest"`

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
| `.claude/hooks/update-refs.mjs` | Hook-Script (PostToolUse) |
| `scripts/services/ref-updater-service.mjs` | Core-Logik für Referenz-Updates |

---

## CLI: Kaputte Links finden

```bash
# Alle kaputten Links anzeigen
node scripts/task.mjs scan-refs

# Kaputte Links automatisch reparieren (wo möglich)
node scripts/task.mjs scan-refs --fix
```

### Scan-Ausgabe

```
docs/features/Travel.md:42
  [Terrain](../domain/Terrain.md)
  → Datei existiert nicht
  Vorschlag: ../data/terrain-definition.md
```

### Auto-Fix

Mit `--fix` werden Links repariert, wenn:
- Die Zieldatei nicht existiert
- Ein eindeutiger Vorschlag gefunden wurde (Fuzzy-Match auf Dateiname)

---

## Konfiguration

Hook ist in `.claude/settings.json` registriert:

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
      }
    ]
  }
}
```

---

## Einschränkungen

- Nur Dateien in `docs/` werden verarbeitet
- Nur erfolgreich ausgeführte mv-Befehle (exitCode 0)
- Keine Unterstützung für `mv *.md dest/` (Glob-Patterns)
- Keine Unterstützung für `mv file1 file2 dest/` (Mehrfach-Quellen)
