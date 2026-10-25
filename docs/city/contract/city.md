# Stadt: Geometrie, Gebäude, Generierung und Lebensdaten

Status: Geltender Fachvertrag; offene Erweiterungen sind als Ziele beschrieben.
Owner: city
Last Reviewed: 2026-10-24 (Struktur und Quellen; Fachabnahme separat)
Source of Truth: Dieses Dokument besitzt das benannte Thema; Code belegt den Iststand, das Abnahmeregister den Prüfstand.

Stand: 11.10.2026. [Stadtziele](../requirements/city.md) und das vollständige
CTY-/CO-Inventar in `acceptance.json.cityPlans.functionalInventory` besitzen
den fachlichen Umfang. [ARCHITECTURE](../../project/architecture/overview.md) besitzt den gemeinsamen
Kern; dieser Plan entscheidet die stadtspezifischen Daten-/Geometriewirkungen.
Die bisherigen City-v1-APIs sind Istbefund, keine vorgeschriebene Zielstruktur.

## Stand und offene Arbeit

Der historische Atlasstand und die datierten H01/H02-/#92/#93/#98/#132-Belege
stehen im [Atlasplan](../../atlas/requirements/atlas.md#atlas-auf-einen-blick), `acceptance.json`
und `docs/reference/`. Assistierte Bebauung war im untersuchten Bestand
Kandidat PR154, kein Grund für eine Architekturübernahme. Vollständige
Original-/Funktions-/Bedienabnahme bleibt offen. Die alten Implementationsdetails
sind in `116c16af48b6a073216685c8d8e2cc74fada82c3:ROADMAP-CITIES-IMPLEMENTATION-PLAN.md`
nachlesbar; diese Datei ersetzt ihren normativen Anspruch.

## Stadtmodell und Codec

City referenziert dieselbe World-Orts-ID wie Atlas und Planner. Ihre lokale
Metergeometrie besitzt Straßenknoten/-kanten mit Klassen/Breiten, Plätze,
Grundstücke, Viertel und Gebäudeinstanzen. Hausname und Pose sind authored
Werte; ein namenloses Haus benötigt keine eigene Markdowndatei. Keine Kopie
von Ortsnotizen, Bewohnerstatblocks oder Fraktionswahrheit im Cityrecord.
Straßen-/Fluss-/Tor-/Brückenbindungen sind stabile topologische Verweise;
Geometrieupdate prüft und aktualisiert nur betroffene Bindungen.

Der Zielstore verwendet kleinere revisionierte Records. City-v1-Dateien bleiben
explizite geprüfte Adapter, keine zweite kanonische Datenbank. Unbekannte
V1-Felder dürfen nicht still verloren gehen. Datenübernahme erhält bestehende
Haus-/Room-/Floor-/Section-IDs, Wortlaut, sichtbare Links und metrische Werte;
bekannte externe Formate ändern sich nur durch einen versionierten Adapter.

## Gemeinsamer Gebäudezustand: erste Umsetzung

**Ein Gebäude besitzt einen gemeinsamen lokalen metrischen Geometriestand**
für Außenhülle, Geschosse, Innenwände, Räume und Dach. Die Karte zeigt daraus
bei kleinem Maßstab die Außenform, bei Detailzoom die Räume. Kein zweites
City-Footprint neben einer independently editierbaren Dungeonkontur.
Gemeinsamer Raumvertrag und Abwägung zum Dungeonraster stehen ausschließlich
im [Runtimeplan](../../atlas/contract/spatial-runtime.md#ein-raumvertrag-passende-geometrieformen).

Die schlanke Repräsentation ist eine pro Geschoss validierte ebene Grundriss-
teilung mit gemeinsamen Grenzsegmenten und metrischem Höhenintervall.
Room verweist auf seine zusammenhängende räumliche Bereichsmenge, die mehrere Geschossteile/Höhenintervalle umfassen kann; Autoreninhalt bleibt geometrieunabhängig. Ein Atrium/Mehrhöhenroom wird nicht für Geschossprojektion oder Vererbung in mehrere Autorenrooms zerlegt.
Außenwandabschnitt wird aus derselben Grenze gelesen, nicht aus einer neu
berechneten geratenen Polygonhülle. Teilkeller, versetzte Geschosse und andere
Dachkontur sind möglich; sie werden nicht auf einen gemeinsamen Umriss gezwungen.
Exakte Kurven können als versionierte Kontursegmente geführt werden, wenn der
Werkzeugumfang sie verlangt; Tesselierung ist eine abgeleitete Ansicht.

| Aktion | Wirkung und prüfbare Grenze |
| --- | --- |
| Innenraum anlegen | Die gemeinsame [Raumgruppenvorschau](../../atlas/contract/room-groups.md#anlegen-und-bearbeiten) bestimmt Räume, Türen, Treppen und Möbel vor der Übernahme. Eine freie Gruppe darf leer beginnen. Bloßes Öffnen oder Zoomen erzeugt keine Daten. |
| Wandzug, Default | Nur ausgewähltes Geschoss; betroffene gemeinsame Grenze, anschließende Räume und gebundene Türen/Features als eine Vorschau. Selfintersect/leere Flächen werden vor Annahme erklärt. |
| Derselbe Wandverlauf in mehreren Geschossen | Nur geometrisch übereinanderliegende Abschnitte desselben Verlaufs; Umfang wird angezeigt. Keine Verformung anderer Wände oder pauschale Skalierung aller XYbounds. |
| Gesamtes Haus horizontal skalieren | Alle Grundrisse/Wände/Dach und lokalen Anker erhalten denselben positiven Faktor; Höhen und Geschossabstände bleiben identisch. 3 m ×1,1 = 3,3 m, ohne Rasterrundung. |
| Verschieben / Drehen | Ändert die metrische Pose; Raumgrößen, Höhen und relative Anker bleiben gleich. Freie Drehung benötigt keinen Voxelumbau. |
| Roomteilung/-merge | Entspricht dem gemeinsamen Room-Lifecycle: alte passende Identität behalten; andere neue/leere bzw. unzugeordnete Inhalte erhalten. Keine Textduplikation oder Löschung. |

Keys, Features, Quellbindungen, Bewohner und Generatorprovenienz hängen an
stabilen IDs. Jeder gemeinsame Zug wird in einem DBcommand gespeichert und
mit derselben Wirkung rückgängig gemacht. Actorposition/Route wird, falls
betroffen, im gleichen Preview/Commit geprüft; der Gebäudeeditor erhält keine
eigene Uhr, History oder Reiseplattform.

**Übergang:** Vorhandene unabhängige Cityhaus-/Dungeonbindungen werden gelesen
und im Importvergleich mit Pose, Einheiten, Konturen und Geschosshöhen gezeigt.
Konsistente Bindungen können deterministisch zusammengeführt werden; mehrere
abweichende Konturen oder fehlende Höhen benötigen die sichtbare Auswahl des
GM. Originale und bisherige Prosa/IDs bleiben erhalten. Kein Ratemaßstab,
kein automatisches Umzeichnen beim Laden, kein dauerhafter Synchronisations-
dienst zwischen zwei kanonischen Geometrien.

## Generation, Gestaltung und Ausgabe

Generator erhält Polygon, bestehende Hindernisse, Straße/Platz/Wasser,
Seed, versionierte Parameter, Algorithmusversion und gebundene Basisrevisionen.
Straßen, Blöcke/Grundstücke und Bebauung sind deterministische Schritte.
Ergebnis ist eine abbrechbare Vorschau mit native editierbaren Records;
Annahme ist ein Command. Geladene Stadt wird niemals neu erzeugt.
Gespeicherte Geometrie ist die Wahrheit; Recipe erklärt Herkunft und ermöglicht
einen **neuen** Vorschlag, ersetzt aber keine von Hand korrigierte Form.

Herkunft pro Element und ausdrücklicher Schutz sind notwendige Daten.
Manuelle Geometrieänderung, Keys, Innenräume, Bewohner-/Ortsbindungen schützen
das Element automatisch. Lokale Regeneration behandelt geschützte Elemente
als Hindernisse und erhält ihre IDs/Inhalte exakt. Freigabe hebt nur den Schutz
auf, löscht keine Inhalte. Ein Ersatzvorschlag zeigt ID-/Bindingmapping und
erfordert Annahme; nicht zuordenbarer Inhalt bleibt auffindbar unzugeordnet.
Cancel hinterlässt weder Autorenwerte noch History-/Dirtyfolgen. Unmögliche
Vorgaben werden erklärt statt still gelockert. Zufällige Seedwechsel erfordern
eine neue ausdrücklich ausgelöste Variante.

Stilwerte für Papier, Linien, Dachfarben/-formen, Vegetation und Props ändern
Darstellung; sie starten keine Generierung. Straßen/Mauern/Tore/Brücken und
Regionanbindung behalten editierbare Topologie. Native Ausgabe kommt aus dem
gleichen bestätigten Stand; PNG/JPEG, SVG und die vorhandenen JSON/GeoJSON/CSV/
WEBP/VTT-/Originaldialekte erhalten eigene versionierte Adapter nach der
vollständigen CITY-08-Inventur. Ein Bildexport verändert keine Autorenwerte.
Oook-/andere Bildimporte bleiben Referenzbilder, keine unbelegte Nativeconversion.

## Lebensdaten in der bestehenden Lieferfolge

Bewohner sind World-NPCs, Fraktionen World-Fraktionen. City ergänzt
Haushalts-/Wohn-/Arbeitszuordnung, Beruf, Religion/Demografievorgaben und
Tagespläne als campaignlokale Records. Beziehung ist gerichtet und typisiert;
ein explizit gekoppeltes reziprokes Paar wird gemeinsam erzeugt/geändert.
Familienansicht ist Projektion dieser Beziehungen, keine zweite Stammbaumdatei.
Unbekannte Originalattribute werden in CITY-00 konkret inventarisiert, nicht
vorsorglich durch beliebige Metaobjekte ersetzt.

Der kanonische [Paarvertrag](../../../src/app/campaign/world-relation-pair-contracts.ts) benennt
beide Gegenrichtungen ausdrücklich. Der [Paarwriter](../../../src/app/storage/world-relation-pair.ts)
legt sie atomisch an oder löst sie gemeinsam; Receipt und gespeicherter Prüfauftrag
klären verlorene Antworten. Seine persistente Paar-History führt beide Kanten
gemeinsam zurück oder erneut aus. Eine spätere Änderung an einer beteiligten
World-Notiz sperrt den Schritt, damit Texte und weitere Beziehungen erhalten bleiben.
[Familientypen](../../../src/features/world/world-notes.ts) sind Elternteil/Kind, Geschwister
und Partner. Die [Familienansicht](../../../src/app/campaign/world-links-ui.ts) filtert nur ausdrücklich
typisierte Kanten; freie Beziehungsnamen bleiben unverändert. Für den Erhalt von
Typen, Gegenrichtungen, History und offenen Aufträgen beim Neustart und unabhängigen
Kopieren gelten die [Transferregeln](../../campaign/contract/authored-text-references.md#beziehungspaare-beim-kampagnentransfer).

| Pflichtquelle | Lieferung und Orakel |
| --- | --- |
| CO-FTG-0014/0004/0017 | CITY-06: Bewohner, Haushalt, Beruf/Demografie und Batchänderung. Zwei Bewohner bearbeiten, Wohn-/Arbeitsort ändern; Regeneration schützt ihre IDs/Notizen und Bindungen. |
| CO-FTG-0014/0026 | CITY-06: Beziehungen/Familienprojektion; Änderung/Remove/Undo/Copy hält die vollständige Referenzclosure ohne NPCduplikate. |
| CO-FTG-0007/0005 | CITY-06: Fraktionen, Regierung/Wachen und Zugehörigkeiten; gleiche World-IDs in Inspector, Suche und Ausgabe. |
| CO-FTG-0018/0042 | CITY-07: Tagesablauf/Ruhetag/Override aus bestätigter Worldzeit, kein Citytimer. Tagesgrenze/großer Sprung/Retry/Restart erzeugt dieselbe Aktivität und keine doppelte Worldfolge. |

Manuelle Lebensdaten brauchen keine Autonomie. Generierung ist ein gesonderter
geschützter Vorschlag; spätere Autonomie darf weder Bewohnerdefinitionen
ersetzen noch heimlich Zeit vorantreiben. Owner-Trash/Restore erhält Wohnungen,
Shops und Beziehungen kohärent; endgültige Löschung folgt der gemeinsamen
geschlossenen Erasuregrenze.

## Technische Arbeitspakete

| Phase | Kleinster ausführbarer Anschluss / Abnahme |
| --- | --- |
| CITY-00 | Drei Vorbilder vollständig inventarisieren; Inventarkennung, direkte Ergebnisprobe und eigenes Nutzerziel. Keine Architekturentscheidung allein aus Vorbildcode. |
| CITY-01 / Work 4a | Meterrecords, Straße/Platz/Haus, gemeinsame Auswahl/Griffe/History/DBpersistenz; Draw/Move/Undo/Neustart in demselben Atlas. Reine bestehende Geometrie nur nach passender Query-/Werteprobe übernehmen. |
| CITY-02 / Work 4a | Abbrechbare reproduzierbare Bebauung; Fläche/Straße/Platz → Vorgaben → Preview → ein Commit; Taverne einzeln korrigieren und frisch öffnen. |
| CITY-03 / Work 4b | Gemeinsame leere Hausinnenhülle und mehrere Geschosse. Wandreichweite, Pose und Gesamtskalierung nach obigem Vertrag; Originalimportvergleich und atomarer Fehler-/Undo-/Restartlauf. |
| CITY-04 | Herkunft/Schutz/lokale Regeneration; Haus mit Key/Innenraum/Bewohnerbindung bleibt unverändert, Ersatzmapping ist sichtbar. |
| CITY-05 | Regionalweg → Tor → Straße → Platz, Brücke/Mauer/Turm mit stabilen lokalen Bindungen; keine Chunklücke. |
| CITY-06 | Viertel-/Gebäudenutzung und manuelle Lebensdaten vor optionaler Generierung; gemeinsamer World-/Such-/Transferanschluss. |
| CITY-07 | Gestaltung, Detailprops und zeitabhängige Tagesabläufe; Stil ohne Regeneration, Zeit über gemeinsamen Port. |
| CITY-08 | Vollständige Ausgabe-/Importdialekte mit Quellen-/Lizenz- und Sichtbarkeitsvertrag; geschlossenes Native-/Campaigntransfer. |
| CITY-09 | Vollständige Fach-/Bedienparität und 5.000-Gebäude-Profil, drei Vorbilder und reale GM-Aufgaben. |

Jedes Paket zuerst Work: sichtbar bearbeiten, Preview abbrechen, atomar
annehmen, Undo und Reopen. Efficient verbessert Wiederholung und gemessene
Engpässe; Beautiful verbessert Grafik/Lesbarkeit. Notwendige A11y, Eingabe,
Schutz und Performance des jeweiligen Grundwegs gelten bereits bei Work.

## Atlasanschluss

Stadt benutzt dieselbe Kamera, Hit-/Objektauswahl, Commandgrenze, Assetverwaltung
und Exportprojektion. Treffer bieten bei Überlagerung eine eindeutige Auswahl;
keine versteckte City-Dungeonpriorität. Docksuche findet Stadt/Haus/Room über
Identität und zeigt dasselbe Atlasziel. Textname erhält Whitespace und IME;
eine erfolgreiche spätere Eingabe darf nicht durch ein altes Rendercallback
überschrieben werden. Canvasneubau darf den aktiven Textdraft nicht vernichten.
Tastatur/200 % und tatsächliche physische Eingabe bleiben direkte Hostabnahmen.
