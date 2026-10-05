# DD-001.04: isolierte Hostabnahme für den ersten Save

Szenario: `tools/groups/scenarios/dd00104-first-save.cjs`. Es nutzt die vorhandene Gruppe `verwaltung-karte-datei` und wird nur bei `DUNGEON_QA_ONLY_DD00104=1` über deren QA-Weiterleitung ausgeführt. Der gemeinsame Runner legt einen isolierten Obsidian-QA-Vault an; das Szenario berührt keine produktive Vault-Datei. Es wurde **statisch vorbereitet und nicht grafisch ausgeführt**. Der zu prüfende Pending-Session-Kandidat liegt getrennt von diesem QA-Zweig; sein gebauter Plugin-Pfad muss als `DUNGEON_PLUGIN_ROOT` angegeben werden.

Nach expliziter Vergabe des Grafikslots im integrierten Build mit einem frischen QA-Root ausführen:

```sh
DUNGEON_QA_ROOT=/home/aaron/.cache/dungeon-native-qa/implementation-20261005/qa/dd00104-host \
DUNGEON_PLUGIN_ROOT=/home/aaron/.cache/dungeon-native-qa/implementation-20261005/bau-dd00104 \
DUNGEON_QA_ONLY_DD00104=1 \
./tools/run-host.sh --group verwaltung-karte-datei

DUNGEON_QA_ROOT=/home/aaron/.cache/dungeon-native-qa/implementation-20261005/qa/dd00104-host \
DUNGEON_PLUGIN_ROOT=/home/aaron/.cache/dungeon-native-qa/implementation-20261005/bau-dd00104 \
DUNGEON_QA_ONLY_DD00104=1 \
./tools/run-host.sh --group verwaltung-karte-datei --restart
```

`DUNGEON_PLUGIN_ROOT` kann auf den zu prüfenden gebauten Kandidaten zeigen; der Runner schreibt dessen `main.js`-Prüfsumme in `build.json`. Beide Phasen müssen denselben QA-Root und denselben Build verwenden. `group-cases.json` und `dd00104-first-save-steps.json` beider Phasen sind zusammen zu lesen. Die anderen `verwaltung-karte-datei`-Fälle stehen in diesem Speziallauf ausdrücklich `open`. Erst die Frischstartphase darf DD-001.04 als Ganzes auf `pass` setzen; die erfolgreiche Editphase allein bleibt wegen des ausstehenden Neustarts `open`.

## Fallgleiche Schritte

1. New → Name `DD00104FirstSaveQA…` → 8×8 → Anlegen. Sichtbarer Canvas im dateilosen Pending-View und 8×8-Dokument, noch keine `Dungeons/<Name>/Karte.dungeon`, Undo/Redo leer.
2. Über die sichtbare Werkzeugleiste **Beleuchtung → Lichtquelle** wählen und bei Feldmitte (4,4) klicken. Eine Licht-Entity und Undo müssen entstehen, die Kartendatei weiterhin fehlen.
3. Sichtbar Rückgängig und Wiederholen klicken. Das Licht muss entfernt und mit identischen Entity-Daten wiederhergestellt werden; vor Save darf weiterhin keine Kartendatei entstehen.
4. Sichtbar Speichern klicken. Erst jetzt muss die V3-Kartendatei existieren, 8×8 und das Licht enthalten. Die laufende Session muss in den Datei-View übergehen und der zuvor entstandene Undo-Schritt erreichbar bleiben.
5. Nach Save sichtbar Undo und Redo klicken. Die Licht-Entity muss verschwinden und identisch zurückkehren. Die gespeicherte Kartendatei muss bei beiden History-Schritten bytegleich bleiben.
6. Obsidian-Prozess schließen, denselben isolierten QA-Vault neu starten und die gespeicherte Karte öffnen. Größe 8×8, dieselbe Licht-Entity, sauberer Speicherstatus und unveränderte Datei-Prüfsumme sind erforderlich.

Jede Stufe schreibt einen Screenshot und JSON mit Dokument-/History-Zustand. Der Originalbeleg ist `DD-001-04-NATIVE-RESULT.md` samt Original-Screenshots und Karte; Oberfläche und Dateiformat dürfen abweichen. Interne Draft-Sidecars sind erlaubt und werden nicht als `.dungeon`-Kartendatei bewertet. Ein Zielnamenskonflikt, ein Speicherabbruch und History über einen Prozessneustart sind in dieser Folge **nicht** abgenommen.

## Integrationsvertrag und Grenze

Das Szenario greift auf den sichtbaren `DungeonEditor` im aktiven Obsidian-View zu. Der Pending-`ItemView` muss seinen Editor wie der vorhandene `DungeonView` als `view.editor` halten. Vor Save muss `dungeon-native-pending` ohne `TFile` sichtbar sein; nach Save `dungeon-native-map` mit demselben Session-Objekt. Falls die Core-Umsetzung den Editor anders kapselt, muss nur der QA-Adapter `editorState`/`placeLight` angepasst werden; die prüfbaren Schritte bleiben gleich. Die Implementierung des ungespeicherten Drafts und des History-Handoffs gehört ins Core-Paket, nicht in dieses Szenario.
