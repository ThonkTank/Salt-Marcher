# Farbdetaillierung auf der GPU im normalen Atlas

22.10.2026. Implementierter Kostenschritt; vollständige Weltkarten-Leistungsabnahme offen.

Beim Verschieben und Zoomen kopierte beziehungsweise skalierte der UI-Thread
zusammengesetzte Farb- und Waldbilder. Lokale Geländeänderungen kopierten diese
Bilder erneut, um betroffene Bereiche zu löschen. Die Profilstichproben des
vorherigen Indexschritts enthalten dafür 120,4 ms kumulierte CPU-Samples während
der Navigation und 110,7/150,6 ms während zweier Pinselzüge. Das sind keine
Einzelaufrufzeiten. Rohprofile: `.build/persistent-index-profile-warm`.

## Entscheidung und Zuständigkeit

| Option | Vorteil | Verbleibender Aufwand |
| --- | --- | --- |
| CPU-Zeilenkopien weiter optimieren | Einfacher Anschluss, bisheriger Pixelpfad | Große Kopien und Allokationen bleiben im UI-Thread. |
| Zusammensetzung in einen dauerhaften Worker verlagern | Pixelschleifen blockieren Eingaben weniger | Pufferübertragung, Besitzwechsel und vollständige GPU-Uploads bleiben. |
| Vorhandene Farbbilder auf der GPU zusammensetzen | Pan, Zoom und örtliches Löschen brauchen keine CPU-Megapixelbilder | Expliziter Bildbesitz, Shaderstart, Farbkanäle und Wiederaufnahme müssen stimmen. |

Gewählt wurde die dritte Option mit begrenzten 2D-Renderzielen. Ein umfangreicheres
System aus Texturseiten und indirekten Adressen ist dafür noch nicht notwendig.
Die bisherigen Terrainworker und Main/SQLite bleiben unverändert zuständig für
Lesungen und Autorendaten. Die Hauptkamera bleibt die einzige Atlasansicht.

- `terrain-color-frame.ts` beschreibt angenommene unveränderliche Kachelpuffer,
  eine kleine Verfügbarkeitsmaske und die Identität des Vorgängerbildes. Der
  Vorgänger enthält weder Pixel noch eine rekursive Historie.
- `terrain-detail-tiles.ts` hält Quellenprüfung, 32-MiB-LRU und die Ladefolge.
  Während asynchroner Lesungen hält er kein vollständiges Vorgängerbild fest.
- `terrain-color-surface.ts` besitzt GPU-Komposition, örtliches Löschen und
  Uploads. Es hält höchstens zwei Bilder mit je 2304×2304 Pixeln und fünf Bytes
  je Pixel: RGBA-Farbe plus Waldkanal, zusammen höchstens etwa 50,6 MiB während
  eines Wechsels. Ein Pan auf demselben Raster lädt bereits übernommene Kacheln
  nicht erneut hoch. Der GPU-Besitzer hält keine alten CPU-Kachelpuffer fest.
- `terrain-detail-material.ts` bindet diese Texturen. Kleine bestätigte
  Pinselpatches behalten ihren eigenen CPU-Antwortvertrag. Shader werden vor
  der Detailverfeinerung vorbereitet; die Übersicht bleibt dabei bedienbar.

Die 32 MiB begrenzen ausschließlich den Kachelcache. Aktuell angezeigte
Kachelpuffer, Worker, Grundbilder und weitere GPU-Ressourcen kommen hinzu.
Die Speicherangaben sind keine Gesamt-RAM-Garantie oder Langzeitqualifikation.
Die ersetzte CPU-Bildübernahme und ihr Optimierungsbenchmark wurden entfernt.
Ein einfacher CPU-Pixelvergleich bleibt ausschließlich in den Prüfwerkzeugen.

## Prüfung

83 betroffene Tests bestehen: Quellenwechsel, lokale Invalidierung einschließlich
Rasterrand, unveränderte entfernte Kacheln, Gestenabbruch, Wiederanlauf,
Verfügbarkeit, Waldbilder und Kameraanschluss. Typprüfungen und Desktopbuild
bestehen; [Quellenhashes und Prüfprotokolle](checks.json).

[Native GPU-Gegenprobe](gpu.json): 25 RGBA-/Waldvergleiche stimmen bytegenau,
einschließlich Pan, Zoom, Teiländerungen, fehlendem Vorgänger und Welt→Raum-Sprung.
Vier Vergleiche des tatsächlichen `TerrainSpatialView` sind pixelgleich:
Draufsicht und 45°-Neigung, jeweils normale und gekachelte Ausgabe. Nach Freigabe
beider Besitzer bleiben null Texturen. Im Panfall entstehen keine erneuten
Kacheluploads; örtliche Änderungen erzeugen keine zusätzlichen GPU-Texturen.

Die Shader-Vorbereitung benötigte 17,2 ms synchrone Einreichung und 41,2 ms bis
zur Bereitschaft. Kalte Bildbereitstellung/Uploads sind getrennt in `sourceMs`
aufgeführt. Kleine Kompositionszeiten allein belegen keine flüssige App.

[Repository-Entwicklungsstart](development.json): inkrementelle Farbkacheln,
Navigation vor vollständiger Verfeinerung, dieselbe Kamera bei Neigung und
Rotation sowie echter GPU-Kontextverlust mit Canvas-Rückfall und ausdrücklichem
Kameraneustart bestehen. Der Rückfall brauchte 3,24 Sekunden. Die Wiederaufnahme
belegt eine nutzbare Terrainansicht, keine zeitlich qualifizierte vollständige
Detailverfeinerung. [Bild nach Wiederaufnahme](recovered.png).

## Volle gemischte Prüfwelt und offene Ziele

Die native Prüfwelt enthält 100.000 Geländezuordnungen, 5.000 Orte,
5.000 eingerichtete Gebäude, 50 Details und 4.001 Dungeonräume, insgesamt
108.076 Landschaftsrecords. Die Geländezuordnungen sind keine 100.000 separat
bearbeiteten Reliefzellen. Gemessen wurde auf Intel UHD 620 des Entwicklungsrechners,
nicht auf dem Pentium Gold 7505 des Nutzers. Der Sculpt-Radius beträgt 2.500 Meilen.

| Messung | Navigation p95 / p99 | Erste sichtbare Pinselantwort, Zug 1 / 2 |
| --- | --- | --- |
| Vorheriger Indexstand | 37,0 / 66,7 ms | 233,6 / 136,4 ms |
| Erster GPU-Lauf | 27,0 / 66,6 ms | 178,4 / 119,3 ms |
| Abschließender GPU-Lauf | 24,8 / 71,4 ms | 253,3 / 175,0 ms |
| Ziel | ≤16,7 / ≤33,3 ms | p95 ≤100 ms |

Vorheriger Stand: [Indexprüfung](../atlas-persistent-index-20261022/world-edit.json).
[Erster GPU-Lauf](world-first.json) und [abschließender Lauf](world-final.json)
halten Quellen-/Buildhashes und getrennte Abläufe fest. Der abschließende Lauf
prüft zusätzlich Hover und vollständige Verfeinerung nach beiden Zügen; er ist
kein identisches Wiederholungspaar. Die ersten zwei Stichproben ergeben keinen
statistischen Pinsel-p95. Erfasst wird die erste asynchron ausgelesene geänderte
Pinselinnenfläche einschließlich Ausleseverzögerung, kein garantierter Displayzeitpunkt.

Beide Änderungen wurden gespeichert, beide Ausschnitte bis 48/48 Kacheln
verfeinert. Hover erzeugte null Shaderprogramme und ersetzte die Szene nicht.
Die erste Terrainübersicht benötigte trotz warmem Index und früher Kamerageste
4,33 Sekunden; das Zwei-Sekunden-Ziel bleibt verfehlt. Alle nativen Prozesse
endeten normal, Fehlerlisten sind leer. Das [Weltbild](world.png) ist eine
technische Rasterfixture und keine gestalterisch abgenommene Fantasykarte.

Die Arbeit entfernt einen gemessenen CPU-Aufwand. Sie erfüllt weder die
unmittelbare Weltbearbeitung noch das Pinselziel. Weitere Arbeit betrifft
verbleibende Frame-/Uploadkosten, Detailstufen und Öffnungslatenz. Eine
30-minütige Navigation **mit Bearbeitung**, Pentium-Qualifikation und die
vollständige gestalterische Autorenreise bleiben offen. Main/CI und Release
werden getrennt von diesen lokalen Belegen bewertet.
