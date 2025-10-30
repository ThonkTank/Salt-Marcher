# Claude Code Auto-Continue Script

Automatisches Fortsetzungs-Skript für Claude Code Sessions, das erkennt wann Claude inaktiv ist und automatisch den nächsten Arbeitsauftrag eingibt.

## Funktionsweise

Das Skript:
1. Startet Claude Code in einer `expect`-kontrollierten Session
2. Sendet initial den Fortsetzungsprompt
3. Überwacht die Ausgabe auf Inaktivität
4. Sendet automatisch den nächsten Prompt nach konfigurierbarer Idle-Zeit
5. Wiederholt bis Abbruch oder Maximum erreicht

## Voraussetzungen

```bash
# Fedora/RHEL
sudo dnf install expect

# Ubuntu/Debian
sudo apt install expect
```

## Verwendung

### Standard (unbegrenzte Iterations, 60s Timeout)
```bash
./scripts/auto-continue-claude.sh
```

### Mit Custom Timeout (z.B. 120 Sekunden)
```bash
./scripts/auto-continue-claude.sh --timeout 120
```

### Begrenzte Iterations (z.B. 5 Auto-Continues)
```bash
./scripts/auto-continue-claude.sh --max-iterations 5
```

### Debug-Modus
```bash
./scripts/auto-continue-claude.sh --debug
```

### Kombiniert
```bash
./scripts/auto-continue-claude.sh --timeout 90 --max-iterations 10 --debug
```

## Sicherheit

⚠️ **Wichtig**: Das Skript kann viel Rechenzeit/API-Credits verbrauchen!

**Empfehlungen:**
- Starte mit `--max-iterations 3` um das Verhalten zu testen
- Überwache die erste Session aufmerksam
- Nutze `--timeout 120` oder höher für komplexe Aufgaben
- Drücke `Ctrl+C` jederzeit zum Abbrechen

## Anpassung des Prompts

Der Fortsetzungsprompt steht in Zeile 44-45 des Skripts:
```bash
CONTINUATION_PROMPT="Lies dir die Arbeitsweisen..."
```

Bearbeite diese Zeile um den Prompt anzupassen.

## Troubleshooting

**Problem: Script startet nicht**
- Prüfe ob `expect` installiert ist: `which expect`
- Prüfe Ausführungsrechte: `chmod +x scripts/auto-continue-claude.sh`

**Problem: Zu frühe Trigger**
- Erhöhe Timeout: `--timeout 180`

**Problem: Keine Auto-Continues**
- Aktiviere Debug: `--debug`
- Prüfe ob Claude wirklich idle ist

**Problem: Unendliche Loops**
- Setze `--max-iterations 5`
- Nutze `Ctrl+C` zum Abbruch
