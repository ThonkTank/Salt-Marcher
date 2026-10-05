# Schneller Auswahl-Hosttest

Der Test startet eine eigene Obsidian-Instanz mit isoliertem Test-Vault und prüft Licht-Auswahlgriffe bei 50, 75 und 100 Prozent, die exakte 32-Pixel-Grenze, Rahmen-Wiederwahl und jeweiliges Undo. Sein Startskript sperrt weitere Schnelltests und prüft laufende isolierte Obsidian-Prozesse; mit der breiten Hostregression wird der Grafikslot zusätzlich abgestimmt.

Aus dem Pluginverzeichnis:

```bash
tools/fast-selection-run.sh
```

Der Lauf prüft das bereits gebaute `main.js`. Nach Quelländerungen deshalb zuerst `npm run build` ausführen. Das maschinenlesbare Ergebnis liegt stabil unter:

```text
/home/aaron/.cache/dungeon-native-qa/fast-selection/latest-result.json
```

Jeder Lauf erhält zusätzlich ein eigenes Verzeichnis unter `fast-selection/evidence/`. Der Test verwendet synthetische Zeigergesten auf einer kleinen Karte; er ersetzt weder physische Eingabe noch Save/Reopen-, Großkarten- oder vollständige Hostregressionen.
