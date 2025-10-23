# Autonomous Testing System - Testing Guide

## Overview

Das autonome Testsystem ermöglicht vollständig automatisierte UI-Tests ohne manuelle Interaktion in Obsidian. Es umfasst Screenshot-Capture, DOM-Analyse, CSS-Validierung und strukturiertes Logging.

## System-Komponenten

### 1. IPC Server
- **Datei**: `src/app/ipc-server.ts`
- **Socket**: `.obsidian/plugins/salt-marcher/ipc.sock` (vault-relativ)
- **Startet automatisch** beim Plugin-Load
- **Akzeptiert**: JSON-Befehle über Unix-Socket
- **Kompatibilität**: Funktioniert mit Flatpak/Snap-Sandboxes (vault wird gemountet)

### 2. CLI Tool
- **Datei**: `scripts/obsidian-cli.mjs`
- **Funktionen**:
  - Plugin reload
  - Entity-Editor öffnen (creature, spell, item, equipment)
  - Screenshot von Modals
  - Grid-Layout Validierung
  - DOM-Struktur-Analyse
  - Logs abrufen

### 3. UI-State Logging
- **Log-Datei**: `CONSOLE_LOG.txt`
- **Prefix**: `[UI-TEST]`
- **Format**: Strukturiertes JSON
- **Logged werden**:
  - Modal geöffnet
  - Field gerendert (mit Dimensionen, Werten, etc.)
  - DOM-Struktur (für tag-fields)
  - CSS Grid-Layout (für tag-fields)
  - Validierungsergebnisse

### 4. Visual Testing
- **Screenshots**: Electron `capturePage()` API für vollständige Window-Captures
- **Speicherort**: `.obsidian/plugins/salt-marcher/screenshot.png`
- **Format**: PNG mit voller Auflösung
- **Verwendung**: Visuelle Validierung von Layouts, Positionierung, Styling

### 5. DOM & CSS Analysis
- **DOM-Analyse**: Element-Hierarchie, CSS-Klassen, Child-Typen
- **Grid-Validierung**: Computed CSS properties (display, grid-template-*, gap)
- **Position-Prüfung**: Grid-row/column für jedes Element
- **Pass/Fail-Validierung**: Strukturierte Ergebnisse mit detaillierten Metriken

## Quick Start

### Plugin laden
1. Obsidian öffnen mit dem Vault `/home/aaron/ObsVaults/DnD`
2. Plugin ist bereits installiert unter `.obsidian/plugins/salt-marcher`
3. Plugin in Obsidian aktivieren (Settings → Community Plugins → Salt Marcher)
4. IPC-Server startet automatisch

### Test 1: IPC-Verbindung prüfen
```bash
node scripts/obsidian-cli.mjs reload-plugin
```

Erwartetes Ergebnis:
```json
{
  "status": "reloaded"
}
```

### Test 2: Creature-Editor öffnen
```bash
node scripts/obsidian-cli.mjs edit-creature adult-black-dragon
```

Erwartetes Ergebnis:
```json
{
  "status": "opened",
  "entity": "adult-black-dragon"
}
```

### Test 3: UI-Logs überprüfen
```bash
grep '\[UI-TEST\]' CONSOLE_LOG.txt | tail -n 20
```

Erwartete Log-Einträge:
- `[UI-TEST] Modal opened: {"kind":"creature","title":"...","entity":"adult-black-dragon",...}`
- `[UI-TEST] Field rendered: {"id":"name","type":"text","label":"Name",...}`
- `[UI-TEST] Field rendered: {"id":"size","type":"select","label":"Größe",...}`
- etc.

### Test 4: Vollständiger Test-Workflow
```bash
npm run test:ui edit-creature adult-black-dragon
```

Dieser Befehl führt automatisch aus:
1. Build (`npm run build`)
2. Plugin reload
3. Creature-Editor öffnen
4. Logs extrahieren und anzeigen

### Test 5: Screenshot von Modal
```bash
node scripts/obsidian-cli.mjs edit-creature
node scripts/obsidian-cli.mjs screenshot-modal
```

Erwartetes Ergebnis:
```json
{
  "success": true,
  "path": "/home/aaron/ObsVaults/DnD/.obsidian/plugins/salt-marcher/screenshot.png"
}
```

Screenshot kann dann mit Read-Tool analysiert werden.

### Test 6: Grid-Layout Validierung
```bash
node scripts/obsidian-cli.mjs edit-creature
node scripts/obsidian-cli.mjs validate-grid-layout
```

Erwartetes Ergebnis:
```json
{
  "success": true,
  "totalEditors": 10,
  "validEditors": 10,
  "invalidEditors": 0,
  "results": [
    {
      "index": 0,
      "fieldLabel": "Typ-Tags",
      "isGrid": true,
      "gridTemplateColumns": "75.0123px 670.318px",
      "gridTemplateRows": "33.9902px 38.2122px",
      "gridPositions": {
        "label": { "row": "1", "column": "1" },
        "control": { "row": "1", "column": "2" },
        "chips": { "row": "2", "column": "2" }
      },
      "valid": true
    }
    // ... weitere Editoren
  ]
}
```

## Erweiterte Test-Workflows

### Screenshot-basierte Validierung

**Workflow**: UI-Änderung → Build → Screenshot → Visuelle Analyse

```bash
# 1. Build nach UI-Änderung
npm run build

# 2. Plugin neu laden
node scripts/obsidian-cli.mjs reload-plugin

# 3. Modal öffnen
node scripts/obsidian-cli.mjs edit-creature

# 4. Screenshot machen
node scripts/obsidian-cli.mjs screenshot-modal

# 5. Screenshot analysieren (mit Claude Code Read-Tool)
# Screenshot zeigt vollständiges Layout, Positionierung, Styling
```

**Use Cases**:
- Grid-Layout visuell prüfen (2x2 Grid für Tag-Editoren)
- Spacing und Alignment validieren
- Button-Positionen prüfen
- Responsive Verhalten testen
- CSS-Änderungen verifizieren

### Grid-Layout Autonome Validierung

**Workflow**: Grid-Änderung → Build → Automatische Validierung

```bash
# 1. Grid-CSS ändern (z.B. grid-template-columns, grid-row)
# 2. Build
npm run build

# 3. Plugin neu laden
node scripts/obsidian-cli.mjs reload-plugin

# 4. Modal öffnen
node scripts/obsidian-cli.mjs edit-creature

# 5. Grid validieren
node scripts/obsidian-cli.mjs validate-grid-layout
```

**Validiert**:
- `display: grid` ist aktiv
- Korrekte Anzahl Spalten/Zeilen
- Label in Grid-Position (1,1)
- Control in Grid-Position (1,2)
- Chips in Grid-Position (2,2)
- Alle erforderlichen Child-Elemente vorhanden

### DOM-Struktur Debugging

**Workflow**: Unerwartetes Layout → DOM-Analyse via Logs

```bash
# 1. Modal öffnen
node scripts/obsidian-cli.mjs edit-creature

# 2. Logs nach DOM-Struktur durchsuchen
grep '\[UI-TEST\] Field rendered:.*domStructure' CONSOLE_LOG.txt | tail -n 1 | jq .
```

**Output-Beispiel**:
```json
{
  "id": "type_tags",
  "domStructure": {
    "classes": ["setting-item", "sm-cc-setting--token-editor"],
    "children": [
      {
        "tag": "div",
        "classes": ["setting-item-info"],
        "hasInput": false,
        "hasButton": false,
        "hasChips": false
      },
      {
        "tag": "div",
        "classes": ["setting-item-control"],
        "hasInput": true,
        "hasButton": true,
        "hasChips": false
      },
      {
        "tag": "div",
        "classes": ["sm-cc-chips"],
        "hasInput": false,
        "hasButton": false,
        "hasChips": true
      }
    ]
  },
  "gridLayout": {
    "display": "grid",
    "gridTemplateColumns": "75px 670px",
    "childrenGrid": [
      { "index": 0, "classes": ["setting-item-info"], "gridRow": "1", "gridColumn": "1" },
      { "index": 1, "classes": ["setting-item-control"], "gridRow": "1", "gridColumn": "2" },
      { "index": 2, "classes": ["sm-cc-chips"], "gridRow": "2", "gridColumn": "2" }
    ]
  }
}
```

### Vollständiger Autonomer Test-Zyklus

**Szenario**: 2x2 Grid-Layout für Tag-Editoren implementieren

```bash
# 1. CSS-Änderungen machen (grid-template-*, grid-row, grid-column)
# 2. Build
npm run build

# 3. Plugin neu laden
node scripts/obsidian-cli.mjs reload-plugin

# 4. Modal öffnen (Timeout ist OK, Modal öffnet sich trotzdem)
node scripts/obsidian-cli.mjs edit-creature

# 5. Automatische Validierung
node scripts/obsidian-cli.mjs validate-grid-layout

# Erwartetes Ergebnis:
# {
#   "success": true,
#   "totalEditors": 10,
#   "validEditors": 10,
#   "invalidEditors": 0
# }

# 6. Screenshot zur visuellen Bestätigung
node scripts/obsidian-cli.mjs screenshot-modal

# 7. Screenshot mit Read-Tool analysieren
# Bestätigt: Label oben links, Input+Button oben rechts, Chips unten rechts
```

**Ergebnis**: Vollständig autonome Validierung ohne manuelle Inspektion!

## Geänderte Dateien

### 2x2 Grid-Layout Implementierung
- `src/features/data-manager/fields/tag-chips.ts` - Token editor implementation
- `src/features/data-manager/fields/renderer-tokens.ts` - Unified token field renderer (replaces tags-editor & structured-tags-editor)
- `src/features/data-manager/fields/field-rendering-core.ts` - Core rendering logic
- `src/app/css.ts` - 2x2 Grid-CSS für Tag-Editoren

### IPC-System
- `src/app/ipc-server.ts` - Unix-Socket-Server (vault-relativ)
- `src/app/ipc-commands.ts` - Command-Handlers inkl. screenshot-modal, validate-grid-layout
- `src/app/main.ts` - IPC-Server Integration
- `src/workmodes/library/core/library-mode-service-port.ts` - Modal-Öffnungs-Helper

### UI-Logging und Analyse
- `src/features/data-manager/fields/field-manager.ts` - Erweitert um:
  - `logFieldState()` - Feld-State-Logging
  - `analyzeDOMStructure()` - DOM-Hierarchie-Analyse
  - `analyzeGridLayout()` - CSS Grid-Analyse
- `src/features/data-manager/modal/modal.ts` - Modal-Logging
- `src/features/data-manager/modal/modal-validator.ts` - Validierungs-Logging

### Test-Infrastruktur
- `scripts/obsidian-cli.mjs` - CLI-Tool mit allen Commands
- `esbuild.config.mjs` - Node.js-Module als external markiert

## Troubleshooting

### IPC-Server startet nicht
**Problem**: `Error: Plugin IPC server not running`
**Lösung**:
1. Obsidian neustarten
2. Plugin neu laden (Settings → Community Plugins → Salt Marcher deaktivieren/aktivieren)
3. CONSOLE_LOG.txt nach Fehler-Meldungen durchsuchen
4. Socket-Datei prüfen: `ls -la .obsidian/plugins/salt-marcher/ipc.sock`

### Socket-Datei existiert bereits
**Problem**: `EADDRINUSE: address already in use`
**Lösung**:
```bash
rm .obsidian/plugins/salt-marcher/ipc.sock
# Dann Plugin neu laden
```

### Flatpak/Snap Sandbox Issues
**Problem**: Socket-Verbindung schlägt fehl trotz laufendem Server
**Erklärung**: Vault-Verzeichnis ist in Sandbox gemountet, `/tmp` jedoch nicht
**Lösung**: Socket-Pfad ist bereits korrekt (vault-relativ), keine Aktion nötig

### Screenshot ist leer oder schwarz
**Problem**: `screenshot-modal` erstellt leeren Screenshot
**Lösung**:
1. Modal muss geöffnet sein bevor Screenshot gemacht wird
2. Kurz warten nach `edit-creature` (ca. 1-2 Sekunden)
3. Electron `remote` API muss verfügbar sein (sollte standardmäßig der Fall sein)

### Keine UI-TEST Logs
**Problem**: `grep '\[UI-TEST\]' CONSOLE_LOG.txt` findet nichts
**Lösung**:
1. Prüfen ob CONSOLE_LOG.txt existiert und beschreibbar ist
2. Plugin-Logger prüfen: `logger.log()` sollte in `src/app/plugin-logger.ts` korrekt konfiguriert sein
3. Modal öffnen und nochmal prüfen

### Validation schlägt fehl
**Problem**: `validate-field.sh` findet Feld nicht
**Lösung**:
1. Prüfen ob Entity existiert: `ls /home/aaron/ObsVaults/DnD/SaltMarcher/Creatures/`
2. Entity-Name korrekt schreiben (mit Bindestrichen, z.B. `adult-black-dragon`)
3. Field-ID aus CreateSpec prüfen

## Zusammenfassung: Autonomes Testing

### Was ist möglich?

**Vollständig automatisierte UI-Validierung ohne manuelle Inspektion:**

1. ✅ **Build & Reload**: Plugin neu bauen und automatisch neu laden
2. ✅ **UI öffnen**: Modals programmatisch öffnen
3. ✅ **Screenshots**: Visuelle Captures des gesamten Windows
4. ✅ **DOM-Analyse**: Element-Hierarchie und CSS-Klassen inspizieren
5. ✅ **CSS-Validierung**: Grid-Layouts mit computed styles prüfen
6. ✅ **Position-Prüfung**: Grid-row/column für jedes Element validieren
7. ✅ **Strukturierte Ergebnisse**: Pass/Fail mit detaillierten Metriken

### Typischer Workflow

```bash
# 1. UI-Änderung machen
# 2. Autonomer Test-Zyklus:
npm run build
node scripts/obsidian-cli.mjs reload-plugin
node scripts/obsidian-cli.mjs edit-creature
node scripts/obsidian-cli.mjs validate-grid-layout
node scripts/obsidian-cli.mjs screenshot-modal
# 3. Read-Tool für visuelle Validierung des Screenshots
```

### Vorteile

- **Kein manuelles Testen**: Keine Obsidian-Inspektion nötig
- **Schnelles Feedback**: Sekunden statt Minuten
- **Reproduzierbar**: Gleiche Tests jedes Mal
- **Visuell verifizierbar**: Screenshots für finale Bestätigung
- **Strukturiert**: JSON-Output für automatisierte Auswertung

### Limitierungen

- **Electron-abhängig**: Läuft nur mit Obsidian (Electron-App)
- **Modal muss offen sein**: Commands wie `screenshot-modal` benötigen geöffnetes Modal
- **Timeouts**: `edit-creature` kann timeout (Modal öffnet sich trotzdem)
- **Sandbox-Kompatibilität**: Socket muss in vault-relativem Pfad liegen
