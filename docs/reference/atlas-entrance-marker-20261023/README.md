# Eingänge als Marker ohne erfundene Gebäude – 23.10.2026

Der native Mitternachtslauf auf `7ebaabf08098cdb553dd3fb96e44015c7e9fb657`
zeigte neben dem Innenraum ein zusätzliches Dach. Ursache: `terrainObjectSources`
erzeugte für jeden Eingang ein Rechteck von 2 × 1,2 m, 2,5 m Wände und 0,5 m Dach.
Der normale Atlas zeichnete gleichzeitig bereits seinen auswählbaren Eingangsmarker.
Dieser wurde über die gemeinsame Höhenzuordnung zusätzlich auf das Dach angehoben.

Drei Optionen wurden verglichen: nur das Mesh ausblenden würde die falsche
Markerhöhe erhalten; ein neues 3D-Portalsymbol würde eine weitere Darstellung
hinzufügen; der bestehende Marker kann seinen tatsächlichen Höhenanker verwenden.
Gewählt ist die dritte Option. Eingänge liefern keine Grundfläche, Wand- oder
Dachhöhe mehr. Der Mesh-Aufbau weist Eingänge ausdrücklich ab. Die bestehende
Höhenzuordnung, Auswahl und Raumöffnung bleiben erhalten. Die Sonderfarbe für
nicht mehr erzeugte Eingangswände wurde entfernt. Keine Speicheränderung.

## Nativer Vorher-/Nachher-Vergleich

[Vorher](before/result.json) und [nachher](after/result.json) öffnen dieselbe
synthetische Gebäudekonfiguration über Kampagne → normaler Atlas. Geprüft werden
Draufsicht, 45° Neigung, Eingangsmarker auswählen, Geländeversatz auf 4 m setzen,
feste Höhe auf 55 m setzen, Raum öffnen und die Werte nach einem frischen Start
wiederfinden. Die Raumgeometrie bleibt während aller Änderungen exakt erhalten.
Vier Prozesse endeten normal mit Code 0; alle PIDs verschwanden, keine Rendererfehler.

- Draufsicht: [vorher](before/01-top.png), [nachher](after/01-top.png).
- Neigung mit ausdrücklich gesetztem Höhenversatz: [vorher](before/02-tilted.png),
  [nachher](after/02-tilted.png).
- Feste Eingangshöhe: [vorher](before/03-fixed.png), [nachher](after/03-fixed.png).

Alle sechs Bilder wurden betrachtet. Nachher fehlt das erfundene Haus; der
Marker folgt der gesetzten Höhe. Bei einem positiven Versatz liegt er deshalb
weiterhin über dem Gelände, aber ohne zusätzliche automatische Dachhöhe.
Der [Pixelvergleich](entrance-marker-pixel-comparison.json) beschränkt sämtliche
Bildänderungen auf den Eingangsbereich. Gebäude, Räume, Beschriftungen und UI
außerhalb dieses Bereichs sind in diesen drei Paaren pixelgleich.

Reproduktion auf dem jeweiligen Quellstand nach `npm run build:desktop`:
`QA_EVIDENCE_DIR=.build/entrance-marker-after timeout 180s python3 tools/ui-session.py node tools/test-desktop-entrance-marker.mjs`.
Für den ursprünglichen Renderer wurde dieselbe Probe mit `--baseline` verwendet;
dieser Schalter erwartet die frühere zusätzliche Markerhöhe von 3 m. Die
Renderer-Buildhashes sind in den Ergebnissen abgelegt; beide Prototypen liefen
vor dem Commit auf einer Arbeitskopie von `7ebaabf08`.

Der erste Probeaufbau scheiterte vor dem App-Start an einer falsch ausgerichteten
synthetischen Höhenkachel. Die Probe liest nun die bereits gültigen gespeicherten
Kacheln. Dies war ein Fehler des neuen Prüfers, kein Produktfehler.

[Sechs Geländeobjekt-Tests](entrance-marker-tests.log) und
[vier Hauptansicht-Tests](entrance-marker-main-tests.log) bestehen; App- und
Desktop-Typprüfung sowie Desktop-Build ebenfalls. Der vorhandene Bindungstest
prüft nun ausdrücklich, dass der Eingang keine Geometrie erzeugt und der Marker
seine tatsächliche Ankerhöhe erhält. Testdateien wurden im Capability-Katalog
verknüpft. Dies ist keine vollständige Reise- oder Produktabnahme.

## Weiter offen

Die Weltgestaltung, fehlendes sichtbares D&D-Innenraster und teilweise fehlende
Raumnamen aus dem vollständigen Autorenlauf werden hier nicht behoben. In dieser
kleinen Probe sind die Namen sichtbar; die Ursache des Unterschieds ist noch
nicht isoliert. Die Leistung auf Pentium 7505/UHD bleibt ungeprüft.
