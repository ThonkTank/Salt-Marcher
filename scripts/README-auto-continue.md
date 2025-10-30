# Claude Code Auto-Continue Script

Automatisches Fortsetzungs-Skript für Claude Code Sessions mit intelligenter Rate-Limit-Erkennung und Sleep-Prevention.

**Features:**
- ✅ Automatische Fortsetzung bei Inaktivität (konfigurierbar)
- ✅ Rate-Limit-Erkennung mit automatischer Quota-Reset-Wartezeit
- ✅ Sleep-Prevention (Laptop bleibt wach)
- ✅ Automatischer Neustart nach Quota-Reset
- ✅ Regelmäßige Status-Updates während Wartezeiten
- ✅ Sicherheits-Limits (max-iterations)

## Funktionsweise

Das Skript:
1. Startet Claude Code in einer `expect`-kontrollierten Session
2. Sendet initial den Fortsetzungsprompt
3. Überwacht die Ausgabe auf Inaktivität **und Rate-Limits**
4. Sendet automatisch den nächsten Prompt nach konfigurierbarer Idle-Zeit
5. **Erkennt Rate-Limit-Nachrichten automatisch** und extrahiert Quota-Reset-Zeit
6. **Pausiert bis zum nächsten Kontingent** und startet dann automatisch neu
7. **Verhindert Sleep-Modus** des Laptops während der Session
8. Wiederholt bis Abbruch oder Maximum erreicht

## Voraussetzungen

```bash
# Fedora/RHEL
sudo dnf install expect

# Ubuntu/Debian
sudo apt install expect
```

## Verwendung

### Standard (unbegrenzte Iterations, 180s Timeout = 3 Minuten)
```bash
./scripts/auto-continue-claude.sh
```

### Mit Custom Timeout (z.B. 300 Sekunden = 5 Minuten)
```bash
./scripts/auto-continue-claude.sh --timeout 300
```

### Begrenzte Iterations (z.B. 5 Auto-Continues)
```bash
./scripts/auto-continue-claude.sh --max-iterations 5
```

### Debug-Modus
```bash
./scripts/auto-continue-claude.sh --debug
```

### Quota-Wait deaktivieren (nicht empfohlen)
```bash
./scripts/auto-continue-claude.sh --no-quota-wait
```

### Kombiniert
```bash
./scripts/auto-continue-claude.sh --timeout 90 --max-iterations 10 --debug
```

## Automatische Rate-Limit-Erkennung

Das Skript erkennt automatisch wenn Claude ein Rate-Limit erreicht und extrahiert die Quota-Reset-Zeit:

**Erkannte Muster:**
- `"available at 9:00 AM"`
- `"try again at 3:30 PM"`
- `"reset at 12:45 PM"`
- `"limit until 6:15 AM"`

**Verhalten bei Rate-Limit:**
1. ⏳ Erkennt Rate-Limit-Nachricht
2. 🕐 Extrahiert Reset-Zeit (AM/PM Format)
3. ⏰ Berechnet Wartezeit bis zur Reset-Zeit
4. 💤 Pausiert mit regelmäßigen Status-Updates
5. ✓ Startet Claude automatisch nach Reset neu
6. 🔄 Setzt Session nahtlos fort

**Sleep-Prevention:**
- Nutzt `systemd-inhibit` um Laptop wach zu halten
- Verhindert: Idle-Sleep, Suspend, Lid-Switch
- Automatisch deaktiviert wenn Skript beendet wird

## Sicherheit

⚠️ **Wichtig**: Das Skript kann viel Rechenzeit/API-Credits verbrauchen!

**Empfehlungen:**
- Starte mit `--max-iterations 3` um das Verhalten zu testen
- Überwache die erste Session aufmerksam
- Nutze `--timeout 240` (4 Min) oder höher für sehr komplexe Aufgaben
- Drücke `Ctrl+C` jederzeit zum Abbrechen

## Anpassung des Prompts

Der Fortsetzungsprompt steht in Zeile 44 des Skripts:
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
