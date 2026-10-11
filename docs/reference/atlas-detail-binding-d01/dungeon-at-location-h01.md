# Dungeon am Ort: H01 und freier GM-Eingang

Parent [#80](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/80),
Hex, E2E-01 Nutzerzeile 13, `E2E01-HEX-SPACE-RUNTIME-NAVIGATION-001`.
Der [quellgebundene H01-Beleg](dungeon-at-location-h01.json) bestätigt ausschließlich
die native synthetische Producerprobe; freie GM-Nutzung und gemeinsames E2E bleiben offen.

## Startbarer Eingang

Produktquelle: `17339c29c8494658d0cadf4d2d1c059b056c3184`.
`src`, Styles, Manifest und Lockfile sind gegenüber der unabhängig geprüften
Integration `ef07a3ab6d7dbb27c3b680b9311ba65bb7e7c81e` unverändert.
Node 22, `npm ci` und `npm run build` erzeugen das Plugin. H01-Buildidentität:

| Datei | SHA-256 |
| --- | --- |
| main.js | 207659485bce43855c07233398dd9dffab9a5d203cd0529af0980e5d6ebfe634 |
| manifest.json | 2acb4649cad04120636e891c96c5cbb9c84d5b91b1e4e378705b0f58d7a4bd64 |
| styles.css | 687a6063bb8ce31e627e65bb48f503c742a0f17c96983b90a9c30456825727f3 |

Native synthetische Fixture:
`tests/fixtures/atlas-e2e-spatial-v2/manifest.json`, Version `e2e01-spatial-v2`,
Manifesthash `23735bb6c95107b7dec93ffa56ec66405a0f4fe0ec3822fc0476d90d2920188d`.
Die sieben `input`-Dateien und zusätzlich `campaign.input` an ihre jeweiligen
`path`-Ziele in einen **neuen eigenen isolierten Testvault** kopieren; Byteanzahl
und SHA-256 stehen im Manifest. Plugin-Build nach `.obsidian/plugins/dungeon-editor/`
kopieren und dort ausschließlich `dungeon-editor` aktivieren. Bestehende eigene
Cloud-Obsidianmontage verwenden, Nutzervault und fremde Geräte erhalten.

Normaler Einstieg im Dateibaum des isolierten Vaults:
`Atlanten/Gemeinsamer-Testatlas.overworld`. Die native Kampagne ist
`Kampagnen/SaltMarcher/E2E-01-Atlas-Save.campaign.json`. Es gibt zwei vorhandene Orte
(Alte Mühle und Torheim), einen vorhandenen Dungeon mit Torraum und eine Stadt.
Die Orts-, Dungeon-, Placement- und Raumkennungen bleiben dieselben. H01s lokal
gespeicherter Testvault liegt unter
`/home/aaron/.cache/dungeon-native-qa/hex-04/dungeon-at-location-h01-20261011/vault`;
dieser lokale Pfad ist kein Cloud-Zugriff. Der Cloud-GM nutzt die versionierte Fixture.

## Freies Nutzerziel

Einen vorhandenen Dungeon an einem Ort verwenden, den zugehörigen Raum-Key
bearbeiten und zum Atlas zurückkehren. Ortswechsel, Fehlerkorrektur und dauerhafte
Wiederverwendung im normalen Produkteinstieg selbst erkunden. Keine vorbereitete
Klickfolge. Auffindbarkeit, Kontext-/Texterhalt, Tastatur und passende Vergrößerung
beobachten. Ergebnis oder konkreten Host-/Produktblocker an #80, Parent bleibt bei Hex.
Kein neuer Dungeon oder neue Placementidentität wird von diesem Anschluss erzeugt.

## Native Producerprobe reproduzieren

Nach neuer ausdrücklicher Koordination des lokalen Slots, aus dem Repositoryroot:

```sh
DUNGEON_QA_ROOT=/home/aaron/.cache/dungeon-native-qa/hex-04/eigener-h01-test \
  bash tools/run-host.sh --hex04-dungeon-at-location
DUNGEON_QA_ROOT=/home/aaron/.cache/dungeon-native-qa/hex-04/eigener-h01-test \
  bash tools/run-host.sh --hex04-dungeon-at-location --restart
```

Dieser bestehende lokale Flatpak-/Playwright-Runner öffnet die Fixture als
kontrolliertes Setup, bedient danach sichtbare Controls und beendet jeden Prozess
normal. Das ist keine freie GM-Prüfung. `--restart` erhält die gespeicherten Dateien,
öffnet einen separaten Prozess und vergleicht die gespeicherte Byteoracle.
Die Oracle bleibt unter dem eigenen QA-Root; die Quellfixture wird nicht geändert.
Copy/Discard/Recovery behalten ihre vorherigen Core-/DOM-/Fachbelege; H01 führt
keine neue native Fehlermatrix dafür aus. Physische Bedienung, Originalparität,
Großkarten, Nutzervaultinstallation und gemeinsame Gesamtfreigabe bleiben offen.

## N02: schmale native Nachprobe

[H02](inspector-n02-native-h02.json) bindet den separat integrierten N02-Inspector
an zwei tatsächlich normale Obsidian-Prozesse, Save-/Byteoracle und1024×800-Layout.
Seine Produkt-/Buildidentität ersetzt die historischen H01-Hashes ausschließlich
für diesen neuen Nachtest. Der sichtbare Ablauf und die Rohartefakte sind im Beleg
gebunden; freie Cloud-GM-Nutzung und unabhängige H02-Evidenzqualifikation bleiben offen.

Nach frischer Slotkoordination dieselben isolierten Aufrufe wie oben mit zusätzlichem
`--hex04-inspector-n02`; `--restart` verwendet denselben eigenen Testvault.
Der neue Consumer prüft direkt Escape aus Orts-/Raumfeldern, invaliden Ortsdraft,
„Zur Karte“, gecachte Rückkehr, gemeinsames Undo/Redo, Save und frischen Reopen.
Er ruft keine Produkthandler zur Ersetzung einer UI-Aktion auf; Modellreads und
Dateihashes sind Diagnose-/Nachorakel. Keine neue Copy/Discard/Recoverymatrix,
physische Bedienung, Original-/Großkarten-/Nutzervault- oder Gesamt-E2E-Abnahme.
