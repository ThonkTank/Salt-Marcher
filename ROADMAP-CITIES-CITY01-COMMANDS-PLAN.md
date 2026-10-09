# CITY-01-Vorbereitung: Stadtbefehle in der gemeinsamen History

## Start, Besitzer und Grenze

CITY-01-PREP-P02 plant den nächsten unabhängigen Baustein nach dem reviewten [Modell und Codec](ROADMAP-CITIES-CITY01-MODEL-PLAN.md). Der Hex-Besitzer bestätigt die vorhandene `AtlasHistory` aus a95680e: stabile Stadt-Dokument-ID als Owner, Target `document`, vollständig codecvalidierte Vorher-/Nachherwerte. Sein Vertrag bleibt unverändert. Keine zweite History oder mutable Stadtquelle, keine Host-, Toolbar-, Transform- oder Speicheränderung. Der vollständige [CITY-01-Anschluss](ROADMAP-CITIES-CITY01-INTEGRATION-PLAN.md) und die Hostabnahme folgen weiterhin der geprüften HEX-05-Übergabe.

Die vorhandene History registriert jeden Owner einmal, lädt unveränderliche Ausgangswerte mit `hydrate`, liest über `read` und übernimmt mehrere Owner atomar mit `execute`. Stale Vorherwerte, doppelte Ziele und ungültige Nachherwerte werden vor Mutation abgelehnt. Ein gültiger No-op erhält Redo. Undo/Redo und Benachrichtigungen gehören ausschließlich dieser History.

Die aktuelle API hat kein `unregister`. Deshalb erzeugt der aufrufende Besitzer genau eine CitySource je geladener Stadt und Historylebensdauer; weitere Verbraucher teilen diese Quelle. Erneutes Anlegen einer Quelle für denselben Owner ist ein Fehler und darf weder hydrieren noch laufende Änderungen ersetzen. Dieses Paket ergänzt keinen Registry-/Disposevertrag; dessen Hostlebensdauer wird bei HEX-05 integriert.

## Konkrete Umsetzung

Nur `src/features/city/commands.ts`, `tests/core/city-commands.test.ts` und der bestehende Testimport werden ergänzt. Bestehende City-/Atlasdateien bleiben unverändert.

1. `CitySource(initial: CityDocument, history: AtlasHistory)` validiert und kopiert das gesamte Anfangsdokument **vor** der Registrierung mittels `serializeCityDocument`, danach JSON-Konversion. So werden auch Zusatzfelder, Sparse-Arrays und Getter vor der normalisierenden Atlas-Konversion abgelehnt. Die Quelle speichert ausschließlich History und Dokument-ID; keine zweite Baseline oder aktuelle Geometrie.
2. Owner-Validator als private Closure prüft Target exakt `document`, vollständiges Cityformat und identische Dokument-ID. `null` ist für ein vorhandenes Stadtdokument unzulässig; Stadtanlage/-entfernung samt Atlasplatzierung ist ein späterer gemeinsamer Besitzer-/Speichervertrag. Registrierung erfolgt einmal; doppelte IDs kollidieren auch mit Terrain-Ownern. Danach genau ein `hydrate` mit dem bereits geprüften Anfangswert. Ungültige Initialdaten dürfen keine Registrierung verbrauchen.
3. `read(): CityDocument` liest ausschließlich `history.read(id, "document")` und liefert über den strikten Codec eine eigene unveränderliche Stadtkopie. Keine mutable Rückreferenz, kein Nachladen, kein neuer Historyeintrag. Das vollständige Dekodieren ist zunächst bewusst; keine ungeprüften Casts oder Cacheinvalidierung.
4. `cityDocumentChange(before: CityDocument, after: CityDocument): AtlasChange` ist rein. Beide vollständigen Snapshots werden vor JSON-Konversion geprüft und besitzen dieselbe Dokument-ID. Rückgabe ist ein tief unveränderlicher Change mit Owner-ID, Target und geprüften Snapshotwerten. Dafür die bestehende generische `immutable`-Hilfe aus `src/model.ts` auf den frisch aufgebauten Change verwenden; keine zweite Freeze-/Kopierimplementierung. Keine Ausführung, keine Labelvorgabe und kein Lesen des aktuellen Zustands. Der Aufrufer kann Stadt-/Terrainchanges zu **einem** `AtlasCommand` verbinden.
5. Der Werkzeugentwurf hält `before = source.read()` beim Beginn fest, verändert nur seine transiente Kopie und baut am Abschluss den Change mit diesem Anfangsstand. Niemals den Vorherwert beim Abschluss erneut lesen: Das würde eine zwischenzeitliche Änderung überschreiben. Cancel erzeugt keinen Change und führt keinen Befehl aus. UI/Entwurf selbst bleibt außerhalb dieses Pakets.

Die JSON-Konversion ist die eindeutige Brücke zwischen den typisierten Cityinterfaces und `AtlasValue`; kein Indexsignature-Cast direkt auf unbekannte Cityeingaben. Die gemeinsame History kopiert JSONwerte vor ihrer Ownerprüfung. Ein roh direkt eingereichter Atlasbefehl kann daher fremde Objektmetadaten schon vorher normalisieren; der Cityadapter garantiert die strikte Prüfung **an seiner Eingabegrenze**, ohne die gemeinsame History umzubauen.

## Bedeutungsvolle Regressionen

- Laden erzeugt keinen Undo-/Dirtyeintrag; Lesen ist unveränderlich und verändert die Eingabe nicht. Ungültige Initialdaten lassen dieselbe ID anschließend gültig registrieren; doppelte Registrierung kollidiert.
- Kleine reale City mit Straßenreferenzen und Hausgrundriss: Straße und Haus in einem Snapshot ändern; gemeinsames Undo/Redo stellt exakt Namen, IDs, Metergeometrie und kanonische Codecbytes wieder her. Der Adapter besitzt keine Undo-/Redomethoden.
- Changekonstruktion führt nichts aus; veränderte fremde Eingaben ändern einen bereits gebauten Change nicht. Unbekannte Felder einschließlich Arrayzusätzen werden vor Konversion abgelehnt; falsche Dokument-ID ebenfalls.
- Echter `TerrainSource` mit `newOverworld`, geladenem Zellziel und echter Cityquelle an **derselben** History: beide Änderungen in einem Befehl, genau ein Undo, exakte gemeinsame Wiederherstellung und Redo.
- Mehrbesitzer-Ablehnung bei stale City-Vorherwert und bei formatwidrigem City-Nachherwert: Terrainchange steht zuerst, beide aktuellen Werte bleiben exakt erhalten, Undo-/Redo-Zustand und Benachrichtigungen ebenfalls. Zusätzlich umgekehrte Reihenfolge mit stale Terrainwert prüfen.
- Gültiger City-No-op nach Undo erhält Redo; stale No-op wird abgelehnt. Falsches Target, fremde Dokument-ID oder `null` in einem direkt eingereichten normalen JSON-Change werden vom Owner abgelehnt.
- Zwei CityOwner an derselben History bleiben unabhängig; Change/Undo der einen Stadt verändert die andere nicht. Owner-ID-Kollision mit dem echten TerrainSource wird kontrolliert abgelehnt.

`npm run check`, `npm test`, `npm run build` nacheinander; gezielte Fälle im vorhandenen Testlauf, keine weitere GUIinstanz und keine Vaultinstallation. Quellhashes und tatsächliche Prüfergebnisse extern unter `/home/aaron/.cache/dungeon-native-qa/city-plans/city01-commands-20261009/` sichern.

## Review und Aufräumen

Umsetzung I02, unabhängiger Review R03, erforderliche Nachbesserungen N02/R04 und Aufräum-P/I/R sind eigene Arbeitsläufe mit Start, Fokus und Ergebnis. Review prüft reale Owner-/Target-/Historyverwendung, strikte Konversionsgrenze, stale Gesten, Mehrbesitzer-Atomarität und keine zweite Stadtquelle. Gegenprobe am tatsächlichen Modul ergänzend zu den Regressionen. Gefundene Pflichtlücken vor Freigabe reparieren und neu reviewen.

Aufräumen prüft doppelte Validierung und notwendige Kopien, öffentliche APIfläche, Besitzerlebensdauer und Verweise. Keine Optimierung ohne belegten Bedarf, keine zweite Statusdatei. Verifizierte Entscheidungen in `ARCHITECTURE.md`, Nachweise bei den bestehenden CTY-Kennungen; aktueller/nächster Lauf ausschließlich in `checkpoint.cityExecution`. Alle 24 CTY-/65 CO-Fachabnahmen bleiben offen: Codebefehle allein belegen weder bedienbare Werkzeuge noch Atlasposition, Speicherung, frisches Öffnen oder bessere Bedienung.
