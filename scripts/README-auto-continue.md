# Claude Code Auto-Continue Script (Python)

Automatisches Fortsetzungs-Skript für Claude Code Sessions mit intelligenter Rate-Limit-Erkennung und rotierenden Arbeits-Phasen.

**Features:**
- ✅ **Drei rotierende Prompts** für optimale Entwicklungszyklen (A → B → C → A → ...)
- ✅ **Automatische Permission-Genehmigung** (beantwortet Erlaubnis-Prompts)
- ✅ Automatische Fortsetzung bei Inaktivität (konfigurierbar)
- ✅ Rate-Limit-Erkennung mit automatischer Quota-Reset-Wartezeit
- ✅ Automatischer Neustart nach Quota-Reset
- ✅ **Lock-Mechanismus** verhindert multiple Instanzen
- ✅ **Sauberes Error-Handling** mit graceful shutdown
- ✅ Sicherheits-Limits (max-iterations)

## Technologie

**Python 3 mit pexpect** - Keine fragilen Bash/expect-Mischungen mehr!
- Robustes Process-Handling
- Klarer, wartbarer Code
- Proper Exception-Handling
- Keine Fork-Bomb-Gefahr

## Voraussetzungen

```bash
# Python 3 (meist vorinstalliert)
python3 --version

# pexpect installieren (falls nicht vorhanden)
pip install pexpect
```

## Funktionsweise

Das Skript:
1. Startet Claude Code in einer `pexpect`-kontrollierten Session
2. **Aktives Output-Reading**: Nutzt `read_nonblocking()` um Output-Stream kontinuierlich zu lesen
3. **ANSI-Filterung**: Filtert Terminal-Control-Codes um echten Output von UI-Updates zu unterscheiden
4. **Rotiert durch drei spezialisierte Prompts** (A → B → C → A → ...)
5. Überwacht die Ausgabe auf Inaktivität **und Rate-Limits**
6. Sendet automatisch den nächsten Prompt nach konfigurierbarer Idle-Zeit (nach >5 Zeichen echtem Output)
7. **Erkennt Rate-Limit-Nachrichten automatisch** und extrahiert Quota-Reset-Zeit
8. **Pausiert bis zum nächsten Kontingent** und startet dann automatisch neu
9. Wiederholt bis Abbruch oder Maximum erreicht

## Prompt-Rotation

Das Skript nutzt drei spezialisierte Prompts in einem kontinuierlichen Zyklus:

### Phase A: Review & Roadmap Verification
**Zweck:** Projekt-Status überprüfen und Roadmap aktualisieren
**Model:** Opus (bevorzugt) oder Sonnet (Fallback)
**Aufgaben:**
- Implementation auf Konformität mit Zielen/Arbeitsweisen prüfen
- Roadmap ergänzen mit konkreten nächsten Schritten
- Sicherstellen dass Roadmap vollständig und aktuell ist

### Phase B: Implementation
**Zweck:** Roadmap-Schritte implementieren
**Model:** Sonnet
**Aufgaben:**
- Nächste Roadmap-Schritte umsetzen
- Sauberen, wartbaren Code schreiben (DRY-Prinzip)
- Tests ausführen und Fortschritt committen

### Phase C: Documentation & Cleanup
**Zweck:** Dokumentation aktualisieren und aufräumen
**Model:** Sonnet
**Aufgaben:**
- CLAUDE.md aktualisieren
- Code-Qualität prüfen
- Aufräumen und optimieren

**State-Persistenz:** Der aktuelle Prompt-Status wird in `.auto-continue-state` gespeichert und bleibt über Sessions erhalten.

## Verwendung

### Standard (unbegrenzte Iterationen, 180s Timeout = 3 Minuten)
```bash
./scripts/auto-continue.py
```

### Mit Custom Timeout (z.B. 60 Sekunden = 1 Minute)
```bash
./scripts/auto-continue.py --timeout 60
```

### Begrenzte Iterationen (z.B. 5 Auto-Continues)
```bash
./scripts/auto-continue.py --max-iterations 5
```

### Quota-Wait deaktivieren (nicht empfohlen)
```bash
./scripts/auto-continue.py --no-quota-wait
```

### Kombiniert
```bash
./scripts/auto-continue.py --timeout 90 --max-iterations 10
```

### Mit Custom Config
```bash
./scripts/auto-continue.py --config my-config.json
```

## Konfiguration

Die Konfiguration erfolgt über `auto-continue-config.json`:

```json
{
  "timeout": 180,
  "max_iterations": -1,
  "enable_quota_wait": true,
  "prompts": {
    "A": { "name": "...", "text": "..." },
    "B": { "name": "...", "text": "..." },
    "C": { "name": "...", "text": "..." }
  },
  "permission_patterns": [
    "Do you want to proceed",
    "❯.*1\\..*Yes",
    ...
  ],
  "rate_limit_pattern": "Your limit will reset at ([0-9]+)(am|pm)"
}
```

**Anpassbare Felder:**
- `timeout`: Inaktivitäts-Timeout in Sekunden
- `max_iterations`: Maximum Auto-Continues (-1 = unbegrenzt)
- `enable_quota_wait`: Rate-Limit-Wartezeit aktivieren
- `prompts`: Prompt-Texte und Model-Präferenzen
- `permission_patterns`: Regex-Pattern für Permission-Erkennung
- `rate_limit_pattern`: Regex-Pattern für Rate-Limit-Erkennung

## Automatische Rate-Limit-Erkennung

Das Skript erkennt automatisch wenn Claude ein Rate-Limit erreicht und extrahiert die Quota-Reset-Zeit:

**Claude's Rate-Limit Format:**
```
Claude usage limit reached. Your limit will reset at 1pm
```

**Verhalten bei Rate-Limit:**
1. ⏳ Erkennt Rate-Limit-Nachricht
2. 🕐 Extrahiert Reset-Zeit (AM/PM Format)
3. ⏰ Berechnet Wartezeit bis zur Reset-Zeit
4. 💤 Pausiert bis zum Reset
5. ✓ Startet Claude automatisch neu
6. 🔄 Setzt Session nahtlos fort

## Automatische Permission-Genehmigung

Das Skript erkennt automatisch wenn Claude nach Erlaubnis für Befehle fragt und genehmigt diese automatisch:

**Erkannte Permission-Prompts:**
- `"Do you want to proceed?"`
- `"❯ 1. Yes"`
- `"Allow this command?"`
- Alle Prompts mit nummerierten Optionen

**Verhalten:**
```
[Claude Code fragt nach Erlaubnis]
✓ PERMISSION DETECTED - Auto-approving
Pattern: Do you want to proceed
[Sendet "1" als Antwort]
```

## Lock-Mechanismus

Das Skript verhindert automatisch dass mehrere Instanzen gleichzeitig laufen:

```bash
./scripts/auto-continue.py
# Zweiter Versuch in anderem Terminal:
# ⚠️  ERROR: Another instance is already running (PID: 12345)
```

**Lock-File Location:** `/tmp/auto-continue-claude.lock`

**Manuelles Entsperren (falls nötig):**
```bash
rm /tmp/auto-continue-claude.lock
```

## State-Management

Der Prompt-Status wird in `.auto-continue-state` gespeichert:

```bash
# Aktuellen Status anzeigen
cat .auto-continue-state  # z.B. "B"

# Manuell zurücksetzen zu Phase A
echo "C" > .auto-continue-state
```

## Sicherheit

⚠️ **Wichtig**: Das Skript kann viel Rechenzeit/API-Credits verbrauchen!

**Empfehlungen:**
- Starte mit `--max-iterations 3` um das Verhalten zu testen
- Überwache die erste Session aufmerksam
- Nutze `--timeout 240` (4 Min) oder höher für sehr komplexe Aufgaben
- Drücke `Ctrl+C` jederzeit zum sauberen Abbruch

**Sicherheits-Features:**
- Lock-File verhindert multiple Instanzen
- Proper signal handling (SIGINT, SIGTERM)
- Automatisches Cleanup bei Exit
- Max-iterations Limit

## Troubleshooting

**Problem: pexpect nicht gefunden**
```bash
pip install pexpect
# oder
pip3 install pexpect
```

**Problem: Script startet nicht**
```bash
# Ausführungsrechte prüfen
chmod +x scripts/auto-continue.py

# Python-Version prüfen (min. 3.6)
python3 --version
```

**Problem: "Another instance is running"**
```bash
# Lock-File entfernen
rm /tmp/auto-continue-claude.lock
```

**Problem: Zu frühe Trigger**
```bash
# Erhöhe Timeout
./scripts/auto-continue.py --timeout 300
```

**Problem: Keine Auto-Continues**
- Prüfe ob Claude wirklich idle ist
- Check `.auto-continue-state` file exists
- Verify config file is valid JSON

**Problem: Permission-Dialoge werden nicht erkannt**
- Prüfe `permission_patterns` in config
- Erweitere Pattern-Liste falls nötig

## Vergleich zur alten Bash-Lösung

**Vorteile der Python-Lösung:**
- ✅ Keine Fork-Bomb-Gefahr mehr
- ✅ Sauberes Error-Handling
- ✅ Einfacher zu debuggen
- ✅ Besser wartbar
- ✅ Keine Bash/expect-Mischung
- ✅ Proper process management
- ✅ Structured logging

**Migration:**
Die alte Bash-Version wurde entfernt. Alle Funktionalität ist in der Python-Version verfügbar.

## Log-Output

Das Script gibt strukturierte Logs aus:

```
============================================================
Claude Code Auto-Continue (Python)
============================================================
Configuration:
  Timeout: 180s
  Max iterations: unlimited
  Quota wait: True
  ...

[DEBUG] Starting Claude Code (iteration 1)...

============================================================
Phase: B - Implementation
Model preference: sonnet
============================================================

✓ Prompt sent and state saved
```

## Weiterführende Anpassungen

Für erweiterte Anpassungen kannst du:
- Config-File duplizieren und anpassen
- Prompt-Texte in config ändern
- Permission-Patterns erweitern
- Eigene Rate-Limit-Pattern hinzufügen
- Python-Script für spezielle Anforderungen erweitern
