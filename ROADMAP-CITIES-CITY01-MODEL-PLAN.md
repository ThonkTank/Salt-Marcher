# CITY-01-Vorbereitung: natives Stadtmodell und Codec

## Start und Grenze

CITY-01-PREP-P01 folgt dem [Anschlussplan](ROADMAP-CITIES-CITY01-INTEGRATION-PLAN.md). Der Hex-Besitzer hat den isolierten Modell-/Codec-Anteil ausdrücklich als kollisionsfrei bestätigt. Er liefert weiterhin gemeinsame Besitzer, Platzierung, Welttransform, Kamera, History und Datei-Transaktion. Die Stadtintegration und ihre Hostabnahme beginnen nach geprüfter HEX-05-Übergabe. Dieses vorbereitende Paket schließt keine CTY-/CO-Pflicht.

Der noch ungeprüfte FTG-Skalierweg aus I40 bleibt offen. Die dokumentierte Browser-Scrollsignatur besitzt keinen Modifierparameter; es wird kein unbelegter zusätzlicher Steuerweg eingesetzt. Statt weiterer Referenzschleifen wird jetzt der bereits konkret geplante unabhängige Datenanteil gebaut. Die geplante I41-Wirkungsprobe wird zurückgestellt, nicht als erfolgreich ausgegeben.

## Konkreter Dateivertrag

Neue Dateien: `src/features/city/model.ts`, `src/features/city/codec.ts`, gezielte Tests unter `tests/core/city-codec.test.ts`. Nur ein Import im vorhandenen Testeinstieg; keine Hostregistrierung, keine Atlasänderung, keine eigene History oder Speicherpipeline.

| Daten | Vertrag |
|---|---|
| Stadt | `kind: "city"`, `version: 1`, ID, Name, `units: "meters"`; Arrays für Straßenknoten, Straßen, Plätze, Grundstücke, Viertel und Gebäude. Kein Weltursprung, kein Atlas-Elternpfad und keine feste Kartenbreite/-höhe. |
| Kennungen | Dokument-/Element-IDs nach vorhandenem Atlasvertrag `[A-Za-z0-9_-]{1,128}`; Element-IDs innerhalb des Dokuments eindeutig. Konstruktor nimmt die Dokument-ID vom Aufrufer; Laden erzeugt keine Kennungen. |
| Straßenknoten | ID und Punkt in lokalen Stadtmetern. |
| Straße | ID, Anfangs-/Endknoten-ID, innere Verlaufspunkte und positive endliche Breite in Metern. Endpunkte werden aus den Knoten abgeleitet, nicht doppelt gespeichert. Referenzen und Nullsegmente prüfen. Unverbundene Komponenten sind kein Formatfehler; Netzplanung folgt ihren Fachregeln. |
| Platz / Viertel | ID, Name und Polygon mit Außenring und Löchern in Stadtmetern. |
| Grundstück | ID und Polygon, optional gültige Viertel-ID. |
| Gebäude | ID, Name, lokaler Grundriss mit Außenring/Löchern, Position in Stadtmetern, endliche Drehung in Radiant, positive endliche Skalierung je Achse; optional gültige Grundstücks-ID. Elternplatzierung der gesamten Stadt bleibt im Atlas. Orts-/Dungeonbindungen werden nach dem tatsächlichen HEX-Vertrag ergänzt. |

Polygonringe sind implizit geschlossen, haben mindestens drei endliche Punkte und keine wiederholte Schließkopie. Vorhandene Polygon-Topologieprüfung aus `src/geometry.ts` verwenden; keine zweite Algorithmenkopie. Für die Prüfung den Polygonursprung abziehen, ohne gespeicherte Werte zu verändern. Der vorhandene Epsilonwert `1e-9` wird ausdrücklich in lokalen Meterkoordinaten getestet; numerisch nicht prüfbare/degenerierte Geometrie wird abgelehnt. Der Codec behauptet keine Straßen-/Gebäudekollisionsfreiheit oder fertige Netzplanung.

## Umsetzung

1. `model.ts` liefert ausschließlich readonly Typen und eine Formatkonstante. Vorhandene Point-/Polygon-Typen wiederverwenden; Einheiten semantisch über den CityDocument-Vertrag festlegen.
2. `codec.ts` liefert `newCityDocument`, `parseCityDocument` und `serializeCityDocument`. Eingaben vollständig prüfen und als eigene tief unveränderliche Daten zurückgeben. Keine fremde Eingabe mutieren/einfrieren; keine Generator-, Datei- oder Hostaktion.
3. Fehlende/unbekannte Versionen, Einheiten, Felder, doppelte IDs, fehlende Referenzen und ungültige Geometrie vor Übernahme ablehnen. Auch Serialisieren validiert vor JSON-Konversion, damit unbekannte Inhalte nicht still verschwinden. Namen, IDs, Reihenfolge und materialisierte Koordinaten bleiben wertgleich erhalten.
4. Grundstück-/Viertel-/Straßenreferenzen in einem zweiten Durchlauf nach ID-Erfassung prüfen. Gebäudepose auf numerisch gültige Ergebnisse prüfen; keine implizite Winkelnormalisierung oder Neugeneration.
5. Gezielte Regressionen in den vorhandenen Testlauf einbinden. `npm run check`, `npm test`, `npm run build` nacheinander ausführen; keine parallele grafische Testinstanz. Produktbuild wird nicht im Nutzervault installiert.

## Prüfanforderungen

Nachweisen:

- Eine kleine Stadt mit Straße, Platz und zwei Häusern samt Grundstücks-/Viertelbezügen rundet wertgleich durch den Codec; keine Pixelgrenzen oder neu erzeugten IDs.
- Negative und große lokale Positionen, gedrehte/asymmetrisch skalierte Grundrisse und Innenhöfe behalten Meterwerte und Reihenfolge.
- Unbekannte Daten, endliche Grenzfälle, Nullbreite/Nullskalierung, doppelte IDs, fehlende Referenzen, Nullsegmente, Selbstschnitt, ungültige Löcher und nicht prüfbare Pose werden abgelehnt.
- Parser/Konstruktor liefern eigene tief gefrorene Daten; der Serializer verändert das Eingabeobjekt nicht und verliert keine unbekannten Felder durch JSON-Konversion.
- Drei Basisprüfungen und gezielte Fälle tatsächlich grün; Quell- und Testergebnisse extern dokumentieren. Daraus keine funktionierende Stadtoberfläche, gemeinsame History, Mehrdateispeicherung oder Parität ableiten.

Aufräumen prüft konkrete Abhängigkeiten, doppelte Typ-/Geometrielogik, wiederholte Validierung, nicht benötigte öffentliche Schnittstellen und die Einheitenannahmen. Tatsächliche Entscheidungen werden in `ARCHITECTURE.md` ergänzt.
