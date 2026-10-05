# DD-021.02: Battlements-Vorschau im isolierten Host

Das Szenario `tools/groups/scenarios/dd02102-path-preview.cjs` wird über `DUNGEON_QA_ONLY_DD02102=1` in der Gruppe `material-pfad` ausgeführt. Es ist **statisch vorbereitet, noch nicht grafisch gelaufen**. Der Test benutzt einen eigenen QA-Vault; der Produktzweig und der Nutzervault bleiben unverändert.

## Ablauf und Beleggrenzen

1. Das geprüfte Dungeondraft-PCK und die direkte Originalaufnahme `04-horizontal-preview.png` werden anhand ihrer SHA-256-Werte identifiziert. Die Originalaufnahme zeigt die texturierte waagerechte Livevorschau auf einer 12×8-Karte bei 64 Pixeln pro Feld. Ein direkter Originalbeleg für Escape ohne Kartenmutation fehlt.
2. Im Host entsteht eine leere 12×8-Karte im dateilosen Pending-View. Das Szenario wählt die eingebaute Battlements-Kachel, schaltet Snap aus, stellt 64 Pixel pro Feld ein und setzt den ersten Punkt `(2;1,5)`. Der Zeiger bewegt sich ohne Endklick nach `(9;1,5)`.
3. Bei sichtbarer Vorschau werden volle Ansicht und Canvas aufgenommen. Der Host muss genau ein Mesh mit der Battlements-Textur zeigen, während Dokument, History und Speicherstatus unverändert bleiben. Die Originalaufnahme und `dd02102-horizontal-preview-canvas.png` sind anschließend **visuell zu paaren**: Breite, Motivmaß, Richtung, Anfang und Ende getrennt prüfen.
4. Escape entfernt den Entwurf. Eine erneute Vorschau wird durch Werkzeugwechsel abgebrochen. Beide Schritte müssen Mesh und Pfadentwurf entfernen, ohne Pfad-Entity oder zusätzlichen History-Eintrag.
5. Der erste sichtbare Save erzeugt eine `.dungeon`-Datei ohne Pfad. Ein frischer Obsidian-Prozess öffnet dieselbe Datei und bestätigt fehlende Pfadgeometrie und unveränderte Prüfsumme.

Hostbestehen allein setzt DD-021.02 auf `open`: Der direkte Bildvergleich und die Originalwirkung von Escape fehlen. Die uneinheitlich beobachtete Enter-Abschlussfolge, diagonale und geknickte Vorschauen, Endkappen und UV-Grenzen werden hier nicht abgenommen. Ein fehlendes Vorschau-Mesh oder zurückbleibende Geometrie wird als `fail` ausgewiesen.

## Start nach Freigabe des Grafikslots

Aus `/home/aaron/.cache/dungeon-native-qa/implementation-20261005/bau-dd02102-qa`:

```sh
DUNGEON_QA_ROOT=/home/aaron/.cache/dungeon-native-qa/implementation-20261005/qa/dd02102-preview-host \
DUNGEON_PLUGIN_ROOT=/home/aaron/.cache/dungeon-native-qa/implementation-20261005/release-dd02102 \
DUNGEON_QA_ONLY_DD02102=1 \
./tools/run-host.sh --group material-pfad

DUNGEON_QA_ROOT=/home/aaron/.cache/dungeon-native-qa/implementation-20261005/qa/dd02102-preview-host \
DUNGEON_PLUGIN_ROOT=/home/aaron/.cache/dungeon-native-qa/implementation-20261005/release-dd02102 \
DUNGEON_QA_ONLY_DD02102=1 \
./tools/run-host.sh --group material-pfad --restart
```

Für beide Phasen denselben QA-Root und denselben gebauten Pluginstand verwenden. `group-cases.json` und `dd02102-preview-steps.json` aus beiden Evidenzordnern bilden den technischen Hostbeleg. Die anderen Fälle der Gruppe werden in diesem Speziallauf automatisch als `open` geführt.
