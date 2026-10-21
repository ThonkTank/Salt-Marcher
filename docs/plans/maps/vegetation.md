# Bewuchs und Felsen im Atlas

Nutzerentscheidung vom 20.10.2026: Landschaftsflächen setzen Vorlage, Bodenbild
und Geländeart gemeinsam. Sie erzeugen beständigen, geländeabhängigen Bewuchs.
Einzelobjekte sind gezielte Korrekturen innerhalb dieser Flächen. Änderungen
an Höhe, Wasser, Wegen und Bebauung passen automatisch erzeugte Bestände an;
ausdrücklich bearbeitete Einzelobjekte bleiben erhalten.

Dies konkretisiert Waldwerkzeuge aus HEX-18 und verwendet die Höhenabfragen
aus [Relief R1/R2](terrain-relief.md). Die Originalanforderungen und
Quellenbindungen bleiben erhalten. Gebirge werden weiterhin mit
**Land formen** modelliert.

## Roadmap und Zielabgleich

Arbeitsfolge aus dem bestätigten Vegetationsplan dieses Tasks. Der vollständige
ursprüngliche Entwurf ist vorübergehend in
`.build/vegetation-roadmap-original.md` gesichert. Die Relief-Roadmap beschreibt
eine eigene Entwicklung; deren R5–R7 sind keine Vegetationsphasen.
Die folgende Tabelle dokumentiert die frühere lokale Phasenqualifikation.
Für die weitere Umsetzung gilt die [gemeinsame Atlas-Roadmap](unified-spatial-atlas.md);
insbesondere ersetzt sie die damals getrennten Ansichten durch die Hauptkamera.

| Phase | Umfang und notwendiger Beleg | Stand |
| --- | --- | --- |
| V0 – Prototyp | Wald am Hang, Lichtung mit Straße und Geröll; stilisierte Modelle; gleiche Bestände in Draufsicht und räumlich | Prototyp vorhanden und nativ geprüft; drei Maßstäbe zusätzlich im Produkt unter V3 geprüft. |
| V1 – Landschaftsbestand | Sechs Vorlagen mit Boden und Geländeart; stabile Flächen, lokale Korrekturen, geschützte Einzelobjekte, Ortsverknüpfung; Wasser, Straßen, Gebäude und Hangneigung; Vorlagenschnappschuss; Main/SQLite, History und begrenzte Bereichsabfrage | Implementiert; lokale Daten- und Bedienbelege vorhanden. |
| V2 – Linien | Natürliche Säume und regelmäßige Reihen mit Breite und Meterabstand; gleicher Bestand und dieselbe History | Implementiert; lokale Daten- und Bedienbelege vorhanden. |
| V3 – Darstellung und Bedienqualifikation | Drei Maßstäbe und beide Ansichten; brauchbare Auswahl unter Baumkronen; Editor-/Exportgleichheit; Anpassung nach Gelände-, Straßen- und Gebäudeänderungen; Erhalt feiner Bereiche, Lichtungen und Einzelkorrekturen; Undo/Redo, Neustart und Transfer; Navigation mindestens 30 FPS, Pinselrückmeldung höchstens 100 ms messen | Lokal funktional qualifiziert; 58–60 FPS bei geladenen Kameragesten, beide Pinsel unter 38 ms. Folgegesten bleiben beim Nachladen erhalten. [Vollständiger Zielabgleich](../../reference/vegetation-20261020/qualification/README.md). Kaltes Öffnen der großen Prüfkarte dauerte 34–97 s, Karten-PNG 54 s; diese Ladezeiten bleiben eine wesentliche Leistungsgrenze. |

Zum Abschluss ist jede ursprüngliche Regel nochmals einzeln abzugleichen:
Vorlagenabhängige Abstände, stabile Kandidaten beim Zoomen, geschützte
Konfliktfälle, ausdrücklich anzuwendende Vorlagenänderungen, unveränderte
Spielregeln und erhaltene Symbole/Nutzerassets. Fehlende Belege bleiben offen;
ein grüner Testlauf allein schließt die Roadmap nicht ab. Wachstumssimulation
und Modell-/Materialeditor gehören weiterhin nicht zu diesem Entwurf.
Main-/Candidate-CI, Paketinstallation und Nutzerabnahme werden getrennt
von der lokalen Phasenqualifikation berichtet.

## Bedienung

Unter **Landschaft → Bewuchs & Felsen** stehen sechs Vorlagen zur Verfügung:
Laubwald, Nadelwald, Wiese, Buschland, Geröllfeld und felsiger Boden.
Baumart, Dichte, Höhe, Unterwuchs, Steinanteil, Gruppierung, Rand und maximale
Hangneigung lassen sich vor dem Malen oder an einer bestehenden Fläche ändern.
Zahlenfelder übernehmen auch leere oder ungültige Eingaben in den Entwurf;
Speichern verwendet niemals stillschweigend den letzten gültigen Wert.
Karte, Einzelinspektor und räumliche Ansicht prüfen vor dem Autorenauftrag
denselben fachlichen Vertrag wie Main. Nach einer Korrektur lässt sich der
erhaltene Entwurf abschließen. Gültige Dezimalwerte sind innerhalb der
Fachgrenzen frei wählbar, beispielsweise eine Baumdichte von `0,33`.

| Werkzeug | Wirkung |
| --- | --- |
| Landschaft malen | Ein gedrückter Pinselzug speichert eine Fläche als einen Undo-Schritt. |
| Landschaft umgrenzen | Eckpunkte anklicken und den Punktzug abschließen. |
| Hecke / Baumreihe | Verlauf zeichnen; natürlicher Saum oder regelmäßige Reihe mit Meterabstand. |
| Freihalten | Automatische Objekte dauerhaft im bemalten Bereich unterdrücken. Der Boden bleibt erhalten. |
| Ausdünnen / Verdichten | Lokale Dichtekorrektur, ohne den restlichen Bestand neu zu würfeln. |
| Einzelbaum / Felsen | Innerhalb einer Landschaftsfläche ein geschütztes Objekt setzen und abschließen. |
| Bewuchs auswählen | Baum oder Felsen anklicken; Typ, X/Y, Größe und Drehung ändern, entfernen oder Einzelkorrektur zurücksetzen. Der Typfilter erreicht Felsen oder Unterwuchs auch unter Baumkronen. |

**Als besonderen Ort anlegen** verknüpft das Einzelobjekt mit einem normalen
Kampagnenort. Ortsprosa und Bewuchs bleiben getrennte Datensätze; eine
Kampagnenkopie übernimmt beide mit neuen Ortskennungen.

Neigen und Drehen stehen im Ansichtsmenü des normalen Atlas. Dieselbe
perspektivische Hauptkamera zeigt Gelände, Bewuchs, Wege und Gebäude; der
frühere Dialog **Räumliche Landschaft** ist entfernt. Verschieben, Mausrad
und weitere Kameragesten bleiben beim Nachladen möglich. Bearbeitung verlangt
einen bestätigten Frame des aktuellen Ausschnitts.
Malen, Flächen, Reihen und lokale Dichtekorrekturen treffen das Gelände per
Raycast und verwenden dieselben Autorenbefehle. Auswahl öffnet den gemeinsamen
Inspektor. Undo/Redo gehören zum Atlas. Die perspektivische PNG-Ausgabe verwendet den
nativen Speicheranschluss und prüft den Quellenstand.

## Daten und Darstellung

`LandscapeRecord.kind = vegetation` speichert Polygonfläche, Auflösung,
Vorlagenschnappschuss, Seed, Verteilungsart, Abstand, Korrekturflächen und
Einzelkorrekturen. Format 52 schützt diese Inhalte vor älteren Apps; der
Übergang von Main-Format 51 verändert weder vorhandene Höhen noch den Undo-Verlauf.

Automatische Kandidaten besitzen weltadressierte Kennungen. Kamera,
Kachelgrenzen und Dichteänderungen ändern ihre Positionen nicht. Geländehöhe,
Hangneigung, Land/Wasser, Straßenbreite und Stadtgebäude bestimmen ihre
Eignung. Bäume bleiben aufrecht, Felsen richten sich an der Bodennormale aus.
Feiner definierte Landschaften haben Vorrang vor gröberen. Einzelkorrekturen
und Löschvermerke sind dauerhaft; ungeeignete geschützte Objekte werden als
Konflikt markiert und nicht automatisch entfernt.

Die Kartenansicht zeigt bei mehr als 80 m/Pixel vorwiegend Bodenflächen,
zwischen 2 und 80 m/Pixel eine ausgedünnte Kronendarstellung und bis
2 m/Pixel die lokalen Einzelobjekte. Die Übersicht wählt ihre Vertreter
als verschachtelte Teilmengen weltfester Zellen. Ein gröberer Vertreter ist
immer ein bereits vorhandener Vertreter der feineren Stufe. Identität,
Position, Größe und Eignungsprüfung bleiben die der lokalen Kandidaten.
Automatische Kronen wachsen anhand der aktuellen Kameratiefe auf eine kleine
Bildschirmgröße; ihre Höhe bleibt maßhaltig. Vor dem nächsten Quellwechsel
blenden nicht mehr benötigte Kandidaten weich aus. Größen- und
Sichtbarkeitsänderungen benötigen weder einen Bereichsread noch neue
Instanzmatrizen. Die CPU-Trefferprüfung verwendet dieselben Regeln.
Große gepufferte Ausschnitte wählen nötigenfalls eine gröbere Stufe derselben
Hierarchie, bevor mehr als 24.000 natürliche Kandidaten geprüft würden.
Unterwuchs entfällt in diesen zusammengefassten Stufen; die Autorenbestände
bleiben unverändert. [Detailzoom-Regression](../../reference/forest-detail-20261021/README.md).
Geschützte Einzelobjekte behalten ihre Maße und bleiben erhalten. Der
Canvas-Fallback verwendet dieselben Ausblendschwellen. Die Hauptansicht verwendet
instanzierte, geometrisch erzeugte Low-Poly-Meshes. Gras und Unterwuchs sind
kleine geometrische Büschel. Es gibt keine importierten Fremdassets und keine
Wachstums- oder Ökosystemsimulation.

Höhen bleiben kanonisch in den vorhandenen Höhenkacheln. Die räumliche
Bearbeitungsansicht verwendet ein nach Ausschnitt und Höhenauflösung
abgeleitetes Gitter mit 33 bis 257 Punkten je Achse und das gemeinsame
gezeichnete Bodenbild. Der einfache Bewuchs-Leseanschluss und der isolierte
Prototyp verwenden weiterhin 65 × 65 Punkte. Diese Gitter schreiben niemals
in die Höhenkacheln zurück.
Eine Ansicht ist auf 20.000 sichtbare Bestandsobjekte und 4 MiB begrenzt.
Zu große Anfragen werden mit einer erklärten Zoomaufforderung abgewiesen.
Dies ist noch kein Nachweis für beliebig große Welten.
Bei dichter Kartenbelegung bleibt die Rasterübersicht begrenzt; geschützte
Objekte werden innerhalb des Antwortbudgets zusätzlich als auswählbare
Einzelobjekte übertragen. Der Übergang zur Übersicht darf keine vollständige
Landschaftsebene wegen zu vieler lokaler Kandidaten verschwinden lassen.

| Verantwortung | Einstieg |
| --- | --- |
| Vorlagen, Validierung, stabile Kandidaten und Ausschlüsse | `src/app/vegetation.ts`; verschachtelte Detailstufen: `src/app/vegetation-lod.ts` |
| Kanonische Befehle und räumliche Datenprojektion | `src/app/storage/atlas-landscape.ts`, `src/app/storage/vegetation.ts` |
| History, Main/Preload und Kampagnenkopie | `src/app/storage/store.ts`, `desktop/main.ts`, `desktop/preload.ts`, `src/app/storage/campaign-data.ts` |
| Kartenbild, Geländegrund und Bereichsprojektion | `src/app/vegetation-view.ts`, `src/app/landscape-raster.ts`, `src/app/storage/atlas-landscape-region.ts` |
| Werkzeuge und gemeinsame Einzelbearbeitung | `src/app/atlas-landscape-ui.ts`, `src/app/vegetation-controls.ts` |
| Bewuchs in der gemeinsamen Hauptkamera und isolierte Bildfixture | `src/app/atlas-spatial-vegetation.ts`, `src/app/vegetation-display.ts`, `src/app/terrain-spatial-view.ts`, `tools/vegetation-prototype/app.ts` |
| Abgeleitetes Geländenetz, Bodenbild und schreibfreie Landpinselvorschau der räumlichen Bewuchsansicht | `src/app/spatial-terrain.ts` |
| Datenregression, Auswahl und echte Desktop-Bedienung | `tests/vegetation.test.mjs`, `tests/vegetation-spatial.test.mjs`, `tools/test-desktop-vegetation.mjs`, `tools/test-desktop-vegetation-qualification.mjs` |

Der [lokale Prüfbeleg](../../reference/vegetation-20261020/README.md) trennt
automatische Tests, native Bedienung und Leistungsbeobachtung. Die vollständige
Relief-Roadmap bleibt eigenständig: R5 betrifft die direkte räumliche
Geländebearbeitung, R6 unter anderem Dächer und Objektbindungen, R7 große
Welten und Ausgabe. Main/Candidate CI,
Paketinstallation und gestalterische Nutzerabnahme sind getrennte Schritte.
