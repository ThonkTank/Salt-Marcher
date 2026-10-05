# DD-020 Musterpaket: Hex/Accept und gebündelte Hostfolge

Stand 05.10.2026. Entwicklungszweig `area/material`; keine grafische Ausführung,
kein Vault- oder Integrationszweig-Edit. Referenz Dungeondraft 1.2.0.1.

## Umfang und direkte Quelle

Das priorisierte Paket enthält DD-020.01/.02/.05/.06/.12–.14/.16/.17/.20–.29
(19 Pflichtfälle). Die vorhandenen Originalaufnahmen in
`audit-20261004/flaechen-material/DD-020/native/shots/` zeigen Werkzeugpanel,
Musterrechteck, Polygonskizze/Escape, Undo/Redo und die gespeicherte
`X`-Farbfläche mit `#3366cc`, Alpha 160/255. Der modfreie Nachlauf
`audit-20261004-vollstaendigkeit/material/gui-run/evidence/40-pattern-magenta.png`
zeigt Hex `ff00ff` nach Accept. `39-pattern-picker-symbol-map-click.png`
zeigt nach Karten-Pipette RGB 110/96/89 statt zuvor 124/108/93. Diese
Aufnahmen belegen jeweils den engen sichtbaren Zustand; sie bestimmen weder
alle Picker-Grenzwerte noch die Pipettenquelle unter mehreren Ebenen.

## Implementiert

- `src/features/material/pattern-color-picker.ts` kapselt Hex-Eingabe,
  8-Bit-Alpha und Accept als gemeinsame Änderung. Ungültige Eingaben ändern
  die Fläche nicht; Abbrechen verwirft den Entwurf. Ein optionaler
  `sampleMapColor`-Callback stellt die direkt beobachtete Pipettenübernahme
  bereit, sobald der Editor einen echten Kartenpixel liefern kann.
- `src/properties.ts` bindet den Baustein für Musterflächen ein. Bei einer
  bestehenden Fläche erzeugt Accept genau einen `update`-Aufruf für RGB und
  Alpha; bei künftigen Flächen ändert es nur die Werkzeugvorgabe. Die Pipette
  wird ohne Karten-Sample-Callback noch nicht angezeigt.
- `tools/groups/scenarios/material-muster.cjs` bereitet eine Edit-/Reopen-Folge
  für Werkzeugöffnung, Hex/Accept, ein `X`-Rechteck, Undo/Redo,
  Polygonvorschau/Escape und Speichern/Frischstart vor. Das Szenario erzeugt
  `group-cases.json` über den gemeinsamen Runner; nicht ausgeführte Fälle
  bleiben mit konkreter Lücke `open`. Die Szene wurde **nicht grafisch**
  ausgeführt. `tools/host-test.cjs --group material-muster` kann sie nach
  Integration und exklusiver Testzeit laden.

## Ergebnisgrenzen und Anschlüsse

Der vorhandene Main-Stand besitzt bereits 8-Bit-Alpha DD-020.13,
Outline-OFF-Startwert und Grundformen. Diese Funktionen wurden nicht
dupliziert. DD-020.02 bleibt im Szenario offen, weil die vorbereitete
`X`-Farbfläche kein identisches gemustertes Originalrechteck ist. DD-020.17
bleibt auch bei erfolgreichem Reopen offen, bis Material, Rotation, Outline
und bearbeitete Form im gleichen Frischstartpaar geprüft sind.

Für DD-020.28 benötigt `Properties` einen Editor-Hook, der nach einem
Pipettenklick **genau einen** sichtbaren Kartenpixel als 24-Bit-RGB liefert,
ohne Dokument/History zu verändern; Auswahl von Ebene und Lichtzustand sind
am Original noch zu messen. Der Baustein nimmt diesen Wert über
`sampleMapColor()` entgegen, integriert ihn aber nicht eigenmächtig in den
Renderer. DD-020.20 (Rückkehrfarbe), .21–.25 (Farbfeld/Hue/einzelne Kanäle)
und .14 (Outline-Breite/Farbmischung) haben weiterhin konkrete
Original-Wirkungslücken im Gruppenmanifest. Kein Reset oder Kanalverhalten
wurde aus einer statischen UI abgeleitet.

Nichtgrafisch geprüft: TypeScript-Typprüfung, Produktbuild,
`node --check` für die Gruppenszene und zwei gezielte Hex-Tests. Der
Hostlauf und der unabhängige Vergleich am installierten Build stehen aus.
