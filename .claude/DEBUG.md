# Debug Logging System

Ein flexibles, konfigurierbares Logging-System für gezieltes Debugging.

## Quick Start

1. **Debug-Modus aktivieren:**
   ```bash
   cp .claude/debug.json.example .claude/debug.json
   ```

2. **Plugin neu laden:**
   - Obsidian: Settings → Community Plugins → Salt Marcher → Reload
   - Oder via CLI: `./scripts/obsidian-cli.mjs reload-plugin`

3. **Logs ansehen:**
   ```bash
   tail -f CONSOLE_LOG.txt
   ```

## Konfiguration

### `.claude/debug.json`

```json
{
  "enabled": true,              // Globaler Ein/Aus-Schalter
  "logFields": ["saveProf"],    // Nur diese Felder loggen
  "logCategories": ["*"],       // Alle Kategorien loggen
  "logAll": false               // Alle Felder & Kategorien (überschreibt Filter)
}
```

### Beispiele

**Nur saveProf/saveMod debuggen:**
```json
{
  "enabled": true,
  "logFields": ["saveProf", "saveMod"],
  "logCategories": ["*"]
}
```

**Nur onChange-Chain debuggen (alle Felder):**
```json
{
  "enabled": true,
  "logFields": ["*"],
  "logCategories": ["onChange", "onChange-wrapper", "repeating-onChange"]
}
```

**Nur Visibility & Init:**
```json
{
  "enabled": true,
  "logFields": ["saveMod"],
  "logCategories": ["visibility", "init"]
}
```

**Komplett deaktivieren:**
```json
{
  "enabled": false
}
```

**Alles loggen (Vorsicht - viele Logs!):**
```json
{
  "enabled": true,
  "logAll": true
}
```

## Verfügbare Kategorien

### Field Creation
- `field-creation` - Wenn Felder erstellt werden

### User Interaction
- `toggle` - Wenn Star/Icon geklickt wird
- `onChange` - Wenn onChange des clickable-icon aufgerufen wird

### Callback Chain
- `onChange-wrapper` - onChange wrapper in field-utils
- `repeating-onChange` - onChange in repeating field template
- `visibility` - Visibility-Checks in updateEntryFields

### Initialization
- `init` - Field initialization logic
- `init-function` - saveMod init function execution
- `update` - Field update() method calls

## Troubleshooting

**Logs erscheinen nicht:**
1. Prüfe, ob `.claude/debug.json` existiert
2. Prüfe `enabled: true` in der Config
3. Stelle sicher, dass Plugin neu geladen wurde
4. Checke CONSOLE_LOG.txt auf "[DebugLogger] Config loaded"

**Zu viele Logs:**
1. Reduziere `logFields` auf spezifische Felder
2. Reduziere `logCategories` auf spezifische Kategorien
3. Setze `logAll: false`

**Config wird nicht geladen:**
- Der Pfad muss relativ zum Vault-Root sein
- Prüfe JSON-Syntax (keine trailing commas!)
- Schaue in CONSOLE_LOG.txt nach Error-Messages

## Log-Format

```
[category:fieldId] Message { data }
```

Beispiel:
```
[onChange:saveProf] Field toggled { oldValue: false, newValue: true }
[init:saveMod] Calling init function { score: 14, saveProf: true }
```

## Git

Die Datei `.claude/debug.json` ist in `.gitignore` und wird **nicht** committed.
Jeder Entwickler kann seine eigene Debug-Konfiguration haben.
