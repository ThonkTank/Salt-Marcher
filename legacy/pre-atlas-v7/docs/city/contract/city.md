# Stadt: Geometrie, Gebäude, Generierung und Lebensdaten

Status: Geltender Fachvertrag; offene Erweiterungen sind als Ziele beschrieben.
Owner: city
Last Reviewed: 2026-10-29 (65 Inventarbindungen und direkte FTG-Teilprobe; vollständige Originalinventur offen)
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

## Offene Originalwirkungen vor den späteren Stadtlieferungen

Die folgende Präzisierung verwendet das bestehende CTY-/CO-Inventar, ohne dessen
IDs, Quellen oder Abnahmestände zu ersetzen. Die hier behandelten offenen
Stadtwirkungen gehören zum späteren Ausbau; sie sind keine zusätzlichen
Abschlusskriterien für Terrain/Meer oder den begrenzten Flussabschluss.
CITY-00 wird gezielt vor dem jeweils
betroffenen Ausbau bearbeitet und vor CITY-09 vervollständigt.

Die vorhandenen FTG-Einträge stammen aus Webbeobachtungen vom 09.10.2026,
`observedVersion` ist dort unbekannt. Für CO-FTG-0014 dokumentiert I02 das gelesene
Profil von Thawn Cobblekind mit Erscheinung, Persönlichkeit, Ziel und Wohnort
sowie den benannten Beziehungen parent/father/adoptive brother. Das belegt
weder Bearbeiten noch vollständige Beziehungstypen oder Persistenz; I18 war
eine erfolglose Zugangsprobe. Die referenzierten I02-Rohdateien unter
`city-plans/city00-i02-20261009` sind in diesem Checkout/Host nicht verfügbar.
Die datierten Registerauszüge bleiben erhalten; eine neue Originalwirkung wird
hier nicht als beobachtet behauptet.

| Bestehende IDs / spätere Lieferung | Konkrete Klärung vor der Umsetzung | Beispielszenario und daraus abzuleitendes Abschlusskriterium |
| --- | --- | --- |
| CO-WAT-0001, CO-FTG-0001/0002/0010/0022, CO-WAT-0011; CITY-02 | Welche Größen-/Layout-/Küsten- und Namensvorgaben ändern welches editierbare Ergebnis? Hamlet, einzelne Layout-/Permalinkwirkungen sind teilbelegt; weitere Größen, Settingsspeicherung und Ufertopologie fehlen. | Dorf mit Straße/Platz und Küste erzeugen, ein Gebäude korrigieren, Recipe erneut verwenden. Vor Bindung eines Teilausbaus dessen Wirkung, reproduzierbare Eingaben, Abbruch und Erhalt manueller Änderungen klären; weitere Varianten nicht aus dem Formular schätzen. |
| CO-FTG-0016, CO-WAT-0007/0008; CITY-04 | Welche Bereiche und geschützten Objekte verändert eine lokale Neuerzeugung oder Verformung tatsächlich? Bestehende Warp-Teilproben entscheiden vollständige Schutz-/Bindungs-/Undo-Wirkung nicht. | Viertel neben Haus mit Bewohner/Key erneuern; ableiten, welche Geometrie geändert werden darf und welche IDs/Inhalte unverändert bleiben. Quellenlücken vor der betreffenden Regenerationsfunktion schließen. |
| CO-FTG-0004/0008/0014/0017; CITY-06 Bewohner | Welche Bewohnermerkmale werden beim **Erzeugen** benötigt, welche sind **einzeln/gesammelt bearbeitbar**, welche bleiben bei Regeneration und Wiederöffnung **erhalten**? Verteilungen, Religion und Lebensstandard sind nur als Formularbereiche belegt; Profilattribute und Zweier-Namensänderung/Cancel nur teilweise. | Zwei Bewohner mit unterschiedlichen Haushalten/Berufen erzeugen, ein Merkmal einzeln und eines gesammelt ändern, abbrechen, regenerieren und neu öffnen. Vor diesem Teilausbau erforderliche Felder/Defaults und Änderungswirkung belegen; der bereits festgelegte Erhalt von World-IDs/Texten/Bindungen bleibt Pflicht. Keine pauschale Zusage „vollständige FTG-Funktion“ als fertige Feldspezifikation. |
| CO-FTG-0014/0026 sowie 0005/0007; CITY-06 Beziehungen/Fraktionen | Welche Typen/Gegenrichtungen, Familien- und Regierungs-/Wachenwirkungen sind eigenständig erforderlich? Gelesene Beziehungen/Familienansicht und sichtbare Formulare entscheiden weder vollständige Typen noch Änderung/Entfernung/Neugenerierung. | Zwei Personen verbinden, Gegenrichtung/Familiennavigation prüfen, Zugehörigkeit ändern und eine Person entfernen/übertragen. Vor diesem Ausbau fehlende Originalwirkungen belegen und dem bestehenden Paar-/Worldvertrag zuordnen; abweichende fachliche Regeln als Entscheidungsbedarf führen. |
| CO-FTG-0018/0042/0011 und übrige CO-Darstellungsfälle in CITY-07 | Welche Kalender-/Overridepolitik gilt bei großen Sprüngen und Wiederöffnung? Welche noch unbeobachteten Darstellungskontrollen ändern eigenständige sichtbare Ergebnisse? Arbeits-/Ruhetag bei gleicher Zeit sowie einzelne Stil-/Lichtwirkungen sind teilbelegt. | Derselbe Bewohner an Arbeits-/Ruhetag, über Tagesgrenze und Restart; geplante Aktivität und tatsächlichen Standort unterscheiden. Vor Zeitintegration offene Wirkung klären; übrige Grafik-/Asset-/Gruppenwirkungen vor ihrem jeweiligen CITY-07-Ausbau mit Übersicht/Detail beobachten. |
| CO-FTG-0020/0021/0023–0025/0029, CO-WAT-0005 und übrige CITY-08-Fälle | Welche Daten und Sichtbarkeitsgrenzen liefern die Ausgabe-/Integrationsdialekte tatsächlich? FTG-Menüs oder deaktivierte temporäre Funktionen belegen keine empfangene Datei; Watabou-Dateibelege sind begrenzt vorhanden. | Identischen Ausschnitt samt Lebensdaten ausgeben und Datei/Öffnung prüfen; vor dem jeweiligen Adapter Format, Datenumfang und Quellen-/Lizenzgrenze klären. Gerätespezifische Darstellung/Fallback und Metropole erst nach Code-/Fragenprüfung schätzen. |

Übrige offene CTY-/CO-Fälle bleiben an ihrer vorhandenen CITY-Zuordnung erhalten,
einschließlich Straßen/Topologie (CITY-05), POIs/Gebäudedaten (CITY-06), Assets,
Gruppen, Street View und grafischer Optionen (CITY-07/08). Vor jedem betroffenen
Teilausbau werden zuerst dessen vorhandene Belege gelesen und nur die fehlenden
Nutzerwirkungen im Original untersucht. Version bzw. unbekannte Webversion mit
Datum/Build, Quell-URL, Ausgangsszenario, tatsächlich beobachtete Wirkung und
abgeleitete Anforderungs-/Lieferzuordnung festhalten. Gleichwertige Ergebnisse
genügen; Originalgesten schaffen keine zusätzliche Lieferpflicht. Ohne geklärte
Wirkung nur Klärungsaufwand planen; erst nach Codeprüfung Umsetzungsspannen
angeben. Fachliche Änderungen gegenüber dem Stadtauftrag bleiben offen zu
entscheiden und werden nicht durch einen Teilabschluss ratifiziert.

## Ergebnisverträge und bestehende Inventarbindungen

Alle 65 vorhandenen CO-Kennungen besitzen jetzt in
`acceptance.json.cityPlans.functionalInventory[].scopeContractReview` eine
bestehende Anforderungs-ID, diesen Fachvertrag, ein konkretes Abnahmeszenario,
die bisherige CITY-Lieferung und die weiterhin offene Originalwirkung. `gap`,
`sourceUrl`, Versionsangaben, historische Proben und PASS-Zustände wurden nicht
ersetzt. Die Szenarien sind **Ziel-/Prüfaufträge**, keine nachträglich erfundenen
Originalbeobachtungen. Unbekannte Varianten bleiben damit weiterhin unvollständig.
Die CTY-Fälle prüfen den gemeinsamen Atlasweg; sie ersetzen kein eigenständiges
CO-Ergebnis. Die neue [Originalteilprobe](../../reference/scope-contracts-20261029/README.md)
trennt Beobachtung, Dialoghinweis und nicht ausgeführte Wirkung.

Für jeden folgenden Vertrag gilt die Folge Ausgangslage → Aktion → sichtbares
Ergebnis → gespeicherte Wirkung → Wiederöffnung → geschützte Bearbeitung.
Die jeweilige Inventarzeile ergänzt das konkrete Beispiel. Nach Apply gehören
Undo/Redo, Antwortverlust ohne Doppelwirkung, Kontextwechsel und Fresh-Reopen
zum späteren Hostbeleg; Cancel hinterlässt keine Records oder History. Sichtbare
Namen sind kein Nachweis stabiler gespeicherter IDs. Quellen-/Gerätezugang,
Implementierung, automatischer Beleg, Nativeprüfung und Ownerabnahme bleiben
getrennte Aussagen.

### Ergebnisvertrag Bearbeitung

Ausgangspunkt sind zwei Häuser, eine Straße und ein beschriebener Ort. Der GM
zeichnet, bewegt, dreht oder entfernt ausgewählte Geometrie. Die Vorschau zeigt
betroffene Elemente und Bindungen; Übernahme ändert genau diesen Umfang in
einer gemeinsamen Historyaktion. Gespeichert werden native Geometrie und stabile
Ownerreferenzen; Wiederöffnung erhält Maße und Texte exakt. Kamera, Stilwahl
und reine Inspektion verändern keine Autorenwerte. CTY-001.01/002.01–02 und
CO-FTG-0015/CO-COK-0006–07 liefern CITY-01/03. Die im Original erfolglosen
CoK-Undo-Versuche streichen unsere bereits zugesagte Undo-Wirkung nicht.

### Ergebnisvertrag Erzeugung

Ausgangspunkt sind Fläche, vorhandene Straße/Platz, Terrain/Wasser und geschützte
Gebäude. Größe, Layout, Namen und fachliche Vorgaben führen zu einer abbrechbaren
Vorschau mit sichtbarer Anzahl, Topologie und Zuordnung. Die Annahme erzeugt
editierbare Records und speichert Recipe, Seed, Algorithmus-/Parameterstand und
Basisrevisionen; Reopen liest diese Records statt neu zu würfeln. Dieselben
versionierten Eingaben erzeugen denselben Vorschlag. Manuelle Korrekturen bleiben
bei bloßem Laden/Recipeöffnen erhalten. CTY-001.02–03/008.01, CO-WAT-0001/0011
und CO-FTG-0001/0002/0010/0022 liefern CITY-02; Link-/Settingsausgabe zusätzlich
CITY-08. Reale Größen-, Küsten-, Verteilungs- und Gebäudebedarfsvarianten bleiben
bis zum beobachteten Ergebnis offen, auch wenn ihre Eingabefelder bekannt sind.

### Ergebnisvertrag Regeneration

Ausgangspunkt ist ein Viertel mit frei generierten Häusern/Bewohnern, einer
manuell geänderten Person, deren Beziehungen und einem Haus mit Key/Innenraum.
Der GM wählt den Änderungsbereich und sieht vor Annahme eine vollständige Liste
veränderbarer, geschützter und nicht zuordenbarer Elemente. Ungeschützte generierte
Geometrie und generierte Lebensdaten dürfen als expliziter Ersatzvorschlag
verändert werden; manuelle Personendaten, IDs, Wortlaut, Beziehungen,
Wohn-/Arbeits-/Fraktionsbindungen und geschützte Gebäude bleiben wertgleich.
Eine Ersatzzuordnung darf keine zweite Person oder verwaiste Beziehung erfinden;
nicht zuordenbarer Inhalt bleibt sichtbar erhalten. Änderung eines geschützten
Elements benötigt dessen ausdrückliche Freigabe und einen erneut prüfbaren
Vorschlag. Freigabe allein löscht nichts. Ein Commit und seine Rücknahme erfassen
den gesamten gültigen Ersatz; Reopen erhält exakt das angenommene Ergebnis.
CTY-003.01–02, CO-WAT-0007–08 und CO-FTG-0016 liefern CITY-04, mit CITY-06 für
Lebensdaten. Der FTG-Dialog vom 29.10. kündigt dagegen Löschen/Neuerzeugen aller
Bewohner ohne Undo an. Das wurde nicht ausgeführt; der jüngere ausdrückliche
SaltMarcher-Schutzvertrag entscheidet unsere abweichende Schutzwirkung bereits.

### Ergebnisvertrag Topologie

Ausgangspunkt sind Regionalweg, Fluss, Tor, Stadtstraße, Platz und ein gebundenes
Haus. Der GM setzt/ändert Anschluss, Breite, Brücke oder Befestigung; Vorschau
zeigt verbundene Teile und erklärt unzulässige Kollisionen. Annahme speichert
stabile Knoten-/Kanten-/Grenzbindungen; Reopen behält denselben zusammenhängenden
Weg. Keine Doppelstraße oder Verbindung allein durch grafische Nähe. Änderung
von Tor/Küste darf geschützte Häuser und deren Innenräume nicht verformen.
CTY-004.01–02, CO-WAT-0003/0010 und CO-COK-0008 liefern CITY-05; CO-WAT-0001 und
CO-FTG-0010 liefern die Generatorvorbereitung in CITY-02. Gemeinsames Terrain und
Flussbett bleiben beim Terrainowner; Änderung ihrer Basis invalidiert den alten
Stadtvorschlag und verlangt eine neue Vorschau, keinen zweiten Wasserstand.

### Ergebnisvertrag Lebensdaten

Ausgangspunkt sind zwei World-NPCs, Haushalt, Wohn-/Arbeitsgebäude und Fraktion.
Der GM ändert Personendaten, einzelne oder gemeinsam ausgewählte Felder,
Beziehungen und Zugehörigkeiten. Ergebnisprofil, Suche, Familienansicht und
Gebäudeinspector zeigen dieselben vorhandenen Identitäten. Gespeichert werden
World-Personen/-Fraktionen und deren Stadtzuordnungen; Reopen erhält Wortlaut,
Typen und Referenzen. Aussehen, Persönlichkeit, Ziel, Religion und Werte sind
konkrete Profilwirkungen; weitere Erzeugungs-/Verteilungsregeln sind noch zu
belegen. Eine neue Friend-Kante darf neben einer Familienkante zur selben Person
bestehen: die Originalprobe belegt beide Ansichten gleichzeitig. Der bestehende
Paarvertrag besitzt ausdrücklich gekoppelte Gegenrichtungen; er verbietet keine
weiteren unabhängigen typisierten Kanten. Ein Familienbaum projiziert denselben
Graphen, keine neue Personenliste. Batch-Cancel ändert keine Person;
Regeneration und Transfer erhalten manuelle Daten und vollständige Referenzclosure.
CTY-004.03, CO-FTG-0004–0008/0014/0017/0026–0028/0030 und CO-WAT-0006 liefern
CITY-06. Regierungs-/Wachen-, Religionsverteilungs-, Ereignis- und weitere
Beziehungseffekte sind trotz dieses geklärten Kerns nicht vollständig beobachtet.

### Ergebnisvertrag Wirtschaft

Ausgangspunkt sind ein Gebäude, referenzierte Item-/Serviceangebote und Generator-
Bedarfe. Der GM ändert Angebot, Qualität/Preis oder Gebäudetypvorgaben und sieht
betroffene Angebote bzw. tatsächliche erzeugte Anzahlen. Definition, Stadtangebot
und gebuchter Stock/Handel bleiben getrennt; Preise erzeugen keine heimliche
Ledgerbuchung. Wiederöffnung liest dieselben Angebotsreferenzen und Parameter.
Manuelle Shops/Ownerbindungen werden bei Erzeugung/Regeneration geschützt.
CO-FTG-0012–13 liefern CITY-06 mit dem bestehenden Shop-/Katalogowner; initiale
Anzahl über Limit, Fraktionsausnahmen, Mindestgröße sowie Küsten-/Rohstoffbedarf
sind im Original bisher nur erklärt, noch nicht durch Erzeugung bewiesen.

### Ergebnisvertrag Zeit

Ausgangspunkt ist dieselbe bestätigte Campaignzeit mit Bewohner, Wohnort,
Arbeitsort, Kalender und Tagesplan. Der GM bestätigt Zeit oder setzt einen
Ruhetagoverride. Geplante Aktivität, aktueller Aufenthaltsort und beständige
Wohn-/Arbeitsbindung bleiben unterscheidbar. Ein Plan allein bewegt keinen
Actor und startet keine Autonomie. Persistiert werden Plan/Override und vom
jeweiligen Owner bestätigte Laufdaten; Restart und Retry führen keine gemeinsame
Zeitfolge zweimal aus. CO-FTG-0011/0018/0042 liefern CITY-07, Zeitintegration
SMR-07/AC-09. Das Original zeigt Arbeit/Heimruhe bei gleichem Zeitpunkt; Reichweite,
Lebensdauer und Kalenderverhalten des Overrides bei Tagesgrenze/großem Sprung
bleiben offene Originalfragen. CITY-07 darf dafür keine eigene Uhr erfinden.

### Ergebnisvertrag Gestaltung

Ausgangspunkt ist derselbe bestätigte Karten-/Bewohnerstand mit einer bekannten
Objektauswahl. Stil, Material, Assetvariante, Gruppe, Licht, Wetterbild oder
Perspektive ändern ihre jeweils ausgewiesene Darstellung bzw. Pose. Bereits
platzierte Instanzen ändern sich nicht allein durch die nächste Assetwahl.
Darstellungswerte und Assetprovenienz werden gespeichert; erneutes Öffnen und
Bildausgabe zeigen denselben Stand. Vorlage/Lichtwechsel regeneriert keine Stadt.
Layerverbergen löscht keine Objekte; Sperren schützt vor Bearbeitung. Ein tatsächlicher
Geometrieeffekt wie Watabou-Processing ist als eigener Änderungsvorschlag mit
Schutzregeln zu behandeln, statt als harmlose Farboption. CO-COK-0001–04/0009–12,
CO-WAT-0002/0004/0009 und CO-FTG-0003/0009/0019/0031/0033–36/0039/0041 liefern
CITY-07. Die vorhandenen Phasenbindungen im Register bleiben maßgeblich.

### Ergebnisvertrag Ausgabe

Ausgangspunkt ist ein bestätigter Ausschnitt mit Gebäuden, Bewohnern, Beziehungen
und öffentlichen/privaten Texten. Der GM wählt Format, Maßstab, Detail und
Sichtbarkeit; er erhält die tatsächliche Datei bzw. einen erklärten Fehler.
Bild- und Datenausgabe lesen denselben Stand ohne Autorenmutation. Ein erneutes
Öffnen der erzeugten Datei im vorgesehenen Empfänger prüft Maße, Geometrie,
Zeichen und Referenzen; Bildexport ist kein Nachweis editierbarer Lebensdaten.
Complete-Kopie folgt dem entschiedenen Campaignvertrag mit lokalen IDs, kein
Formatadapter darf eine abhängige Referenz auf die Quellkampagne hinterlassen.
CO-COK-0005, CO-WAT-0005 und CO-FTG-0020–25/0029/0032/0037–38/0040 liefern CITY-08;
CTY-006.03/007.01/008.02 qualifizieren gemeinsamen Inhalt und Größe. Tatsächliche
FTG-Dateien, Premiumintegration, Fallback und Metropole bleiben unbewiesen.

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
Tastatur/100 % und tatsächliche physische Eingabe bleiben direkte Hostabnahmen.
