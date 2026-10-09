# CITY-01-Vorbereitung: Straßen- und Hausaktionen

## Auftrag, Start und Grenze

CITY-01-PREP-P03 folgt den separat reviewten [Stadtbefehlen](ROADMAP-CITIES-CITY01-COMMANDS-PLAN.md). CTY-002.01 verlangt Straßen zeichnen, ziehen, ergänzen und rücknehmen; CTY-002.02 verlangt Häuser auswählen, verschieben, skalieren, drehen und entfernen. Dieses Paket implementiert die dafür nötigen reinen Datenaktionen. Renderer, Trefferprüfung, Werkzeuggesten, Atlasplatzierung und Datei-/Hostaktionen bleiben im [Anschlussplan](ROADMAP-CITIES-CITY01-INTEGRATION-PLAN.md) nach geprüfter HEX-05-Übergabe. Keine gemeinsame API ändern und keine weitere GUIinstanz starten.

Die aktuelle Citygeometrie hält gemeinsame Straßenknoten statt kopierter Endpunkte. Häuser halten lokalen Grundriss, Position in Stadtmetern, Radiantdrehung und dimensionslose positive Achsenskalierung. Der Codec prüft eindeutige IDs, richtige Referenzen und gültige Geometrie. Die vorhandene CitySource liest ausschließlich die gemeinsame AtlasHistory. Diese Verträge werden wiederverwendet.

## Dateien und öffentliche API

Neue Datei `src/features/city/edit.ts`, gezielte Tests `tests/core/city-edit.test.ts` und ein Import im bestehenden Testeinstieg. Keine Erweiterung des Dateiformats, keine neue History oder Kopie der Topologieprüfung.

`CityEdit` ist eine readonly diskriminierte Union. Genau eine ausführende reine Funktion: `editCity(document: CityDocument, edits: readonly CityEdit[]): CityDocument`. Sie liefert eine eigene tief unveränderliche, vollständig geprüfte Stadt; sie liest keine History und führt keinen Befehl aus. Ein Aufrufer bildet `cityDocumentChange(gestureBefore, editCity(gestureBefore, edits))` und übernimmt ihn über die gemeinsame History. Mehrere Fachaktionen eines Zugs gehören in einen Change.

| Operation | Payload und Wirkung |
|---|---|
| `add-road` | Vollständige CityRoad plus Array neuer CityRoadNode. Neue IDs kommen vom Aufrufer. Vorhandene Anschlussknoten werden referenziert, nicht kopiert. Keine bestehenden Knoten oder Kanten überschreiben. |
| `move-node` | nodeId und vollständiger Point. Ersetzt nur den Punkt dieses vorhandenen Knotens; alle angrenzenden Straßen nutzen damit denselben Endpunkt. Innere Verlaufspunkte bleiben erhalten. |
| `replace-road` | roadId und vollständige CityRoad mit exakt derselben ID. Erlaubt Breite, Innenpunkte und Anschlussreferenzen zu ändern. Nur ein vorhandenes Ziel ersetzen. |
| `remove-road` | roadId. Nur die vorhandene Kante entfernen. Nicht mehr benutzte Knoten bleiben erhalten; keine implizite Bereinigung mit Identitätsverlust. |
| `remove-node` | nodeId. Nur ein vorhandenes Ziel entfernen; verbleibende Straßen dürfen nicht darauf verweisen. |
| `add-building` | Vollständige CityBuilding mit callerbestimmter ID. Neue Kontur wird erst als gültiger, abgeschlossener Grundriss übernommen. |
| `set-building-pose` | buildingId, Point position, rotationRadians, Point scale. Ersetzt ausschließlich die Pose, erhält ID, Name, Grundriss und Grundstücksbezug. |
| `set-building-footprint` | buildingId und vollständiges Polygon. Ersetzt nur den lokalen Grundriss, erhält Pose und übrige Daten; Innenhöfe sind Teil des Polygons. |
| `remove-building` | buildingId. Entfernt nur das vorhandene Haus. Grundstück, Viertel und andere Häuser bleiben erhalten. Keine externe Dungeon-/Ortsdatei löschen. |
| `add-plaza` | Vollständige CityArea. Ermöglicht den ersten CITY-01-Platz mit gültiger Kontur und callerbestimmter ID. |

Erweiterte Bindungen und deren Schutzregeln werden nach ihrem tatsächlichen HEX-Vertrag ergänzt; das heutige Modell besitzt keine Dungeon-/Ortsbindung. Dieses Paket behauptet keine Abnahme von Löschen oder Bewegen gebundener Häuser.

## Prüfung und Atomarität

1. Den vollständigen Anfangsstand durch `serializeCityDocument` und `parseCityDocument` prüfen und kopieren **bevor** irgendein Feld ersetzt/entfernt wird. Ungültige Anfangsdaten dürfen nicht durch Löschen des fehlerhaften Elements bereinigt und dabei still verloren werden.
2. Das Operationsarray muss eine dichte native Liste ohne Zusatzfelder, Getter oder Unterklasse sein. Jede Operation besitzt exakt die Felder ihres Tags und ausschließlich Daten-Descriptors; unbekannte Tags/Felder vor Zugriff ablehnen. Neue Daten werden unverändert in den Kandidaten aufgenommen und anschließend vom bestehenden Codec vollständig geprüft, keine verlustbringende JSON-Konversion ungeprüfter Payloads.
3. ID-Ziele müssen vorhanden und vom richtigen Typ sein; fehlende Ziele liefern eine konkrete Meldung statt stiller No-ops. `replace-road` darf die ID nicht ändern. Neue Elemente dürfen keine vorhandene ID aus irgendeiner Sammlung überschreiben. Der Codec prüft den endgültigen Kandidaten; APIvalidierung darf diese ID-/Geometrieprüfung nicht duplizieren.
4. Alle Edits sequenziell auf einem nur lokalen Kandidaten anwenden, dann **einmal abschließend** den gesamten Kandidaten codecvalidieren und kopieren. Keine Historymutation und kein Einfrieren fremder Eingaben. Ein Fehler an beliebiger Stelle liefert keinen Zwischenstand. Eine ausdrücklich geplante Knotenentfernung plus Kantenänderung ist im selben Paket erlaubt, wenn der Endzustand referenziell gültig ist; Referenzen nicht schon nach jeder Einzelaktion prüfen.
5. Endwerte aus Payloads und Anfangsstand dürfen mit dem Aufrufer keine mutable Referenz teilen. Leere Editliste liefert wertgleichen eigenen Stand. Keine neue ID, Sortierung, Winkelnormalisierung, Knotenverschmelzung oder automatische Hausregeneration. Straßen-/Hausüberlappung und automatische Netzplanung sind spätere Fachregeln, keine bereits belegte Leistung dieses Codecs.

## Regressionen und Fachreview

- T-Verzweigung: einen gemeinsamen Anschlussknoten bewegen, alle drei Kanten behalten seine ID und nutzen den neuen Punkt. Negative Meterpositionen und frei editierter Verlauf; IDs/Reihenfolge der unbeteiligten Elemente erhalten.
- Straße mit callerbestimmten neuen Knoten ergänzen und mit vorhandener Straße verbinden. Breite/Verlauf/Anschluss ersetzen; ein gemeinsamer Historyeintrag, exaktes Undo/Redo der gesamten Stadt. Nullsegment, fehlender Anschluss und doppelte ID einschließlich Haus-/Straßenkollision abgelehnt.
- Referenzierten Knoten allein entfernen wird abgelehnt; Kante entfernen/ersetzen plus Knoten entfernen im selben Paket mit gültigem Endzustand gelingt. Fehlende und falsch typisierte IDs werden nicht still übergangen. Orphanknoten ohne explizite Aktion bleiben erhalten.
- Haus verschieben, drehen und asymmetrisch skalieren: lokaler Grundriss/Innenhof, Name, Grundstücksbezug und ID wertgleich. Grundriss ersetzen erhält Pose. Haus entfernen erhält fremde Elemente und Grundstück/Viertel. Millimeterkontur, große/negative Position, ungültige oder numerisch kollabierte Pose abgelehnt.
- Platz und zwei Häuser auf einer kleinen Straße anlegen; kanonischer Codecroundtrip mit gleicher Reihenfolge und IDs. Hauskontur mit Selbstschnitt/ungültigem Loch, Nullskalierung und unbekannte Payloadfelder abgelehnt.
- Eingabestand und alle Payloads bleiben ungefroren und unverändert. Nachträgliche Mutation fremder Eingaben ändert das Ergebnis nicht; Ergebnis tief gefroren. Ungültige Anfangsdaten bleiben auch bei entfernender Aktion abgelehnt.
- Sparse-/Accessor-/Zusatzfeld-Operationslisten, unbekannte Tags/Shapes und ID-Wechsel ablehnen; Getter darf nicht aufgerufen werden. Fehler im zweiten Edit veröffentlicht keinen ersten Edit. Leerpaket wertgleich; gemeinsamer No-op erhält Redo.
- Mit realer CitySource/AtlasHistory prüfen: ein Paket aus Straßen- und Hausänderung ist ein Undo; konkurrierende Änderung nach Gestenbeginn verhindert die gesamte Übernahme, ohne anderen Besitzer zu verändern.

`npm run check`, `npm test`, `npm run build` nacheinander. Externe Quellenhashes/Prüflogs unter `/home/aaron/.cache/dungeon-native-qa/city-plans/city01-edit-20261009/`. I03, R04 und gegebenenfalls N/R sind getrennte Läufe mit Start/Fokus/Ergebnis. Separate Gegenproben für Referenzänderung im Paket und ungültige Anfangsdaten. Erst nach fachlich geschlossenem Review Aufräum-P/I/R: öffentliche API, doppelte Validierung, fremde Referenzen und Einheiten prüfen, Architektur aktualisieren. Kein hostloser Codecheck schließt CTY-/CO-, Bedien-, Speicher- oder Paritätsabnahmen.
