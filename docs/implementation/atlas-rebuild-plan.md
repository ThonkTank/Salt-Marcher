# Atlas-Neubau und Aufräumen: ausführbarer Implementierungsplan

Dieser Plan erhält den vollständigen Zielumfang **F01–F19 mit D01–D11** und die
Pakete P0–P9. Die **Architekturkorrektur vom 9. November 2026 in Abschnitt 5**
ersetzt den bisherigen P0-Restauftrag. Ausgangspunkt ist PR #1469 auf
Commit 96637b0e399fa9da73a73cd8bfb9dd6c8df10ba3.

**Zielentscheidung nach der Recherche vom 9. November 2026:** Mehrskalenautoren,
numerische Übersichten, feste Renderbasis und die vier Besitzer bleiben.
R1 hat die einfache räumliche Stempelverteilung C0 mit unabhängiger
Zeit-/Inhaltsreferenz geprüft. Der begrenzte Wiederbesuchsfall unten widerlegt
C0 an der lokalen Wirkungsschranke. Der einzige Gegenkandidat C1 verwendet
deshalb eine einmalige räumliche Mindestwirkung mit Anrechnung auf die Zeitwirkung. Eingabeende, vollständige
Aktionsübernahme und Darstellung werden getrennt; angenommene Restarbeit darf
in kurzen budgetierten Schritten fertig werden. Eine lokale Grenze umfasst
bereits angewandte und angenommene, noch nicht angewandte Wirkung.
Ein eingefrorener Renderstand und zusammengeführte neuere Änderungen begrenzen
die Grafikarbeit. Normale Rundungsreste bleiben im GPU-Pfad.

Die Vorbilder und ihre Beweisgrenzen stehen in Abschnitt 9. Sie stützen die
gewählten Prinzipien, qualifizieren aber weder diesen PR noch die konkreten
Zeitziele. R1 wählt C1 samt unabhängiger Referenz; R2 integriert den ausgewählten
Höhenweg. R2–R4 müssen gemeinsam Inhalt, normale Wirkung, Latenz und Ressourcen belegen.

**R2 und der begrenzte Renderpfad aus R3 sind funktional integriert;
die vollständige Leistungsabnahme bleibt offen.**
Der aktuelle Produktvertrag beschreibt C1 mit Reservierungen, begrenzter
Fortsetzung und gemeinsamem Aktionsabschluss. Der [Status](status.md) nennt die
neu geprüften Belege und das weiterhin offene CPU-Ziel. R4/R5 und die gemeinsame
Leistungsqualifikation sind nicht abgeschlossen; der Gesamtzielzustand ist
nicht positiv qualifiziert.
Abschnitt 2 dokumentiert die gewählte D10-Änderung und D11-Umsetzung.
Abschnitt 6 trennt Korrektheit, Hardware-Richtungsentscheidung und Freigabe.
K1–K6 werden nicht erneut umgesetzt.

[Status](status.md) nennt allein den geprüften Commit, Messergebnisse, offene
Fehler und Umgebungsgrenzen. [Produktvertrag](../product-contract.md) und
[Architektur](../architecture.md) beschreiben den implementierten Zustand.
Dieser Plan enthält künftige Entscheidungen, Restarbeit und ihre Abschlusskriterien.
Ausgangsvertrag für den vollständigen Ersatz bleibt
`1bb3932fcffcb2d5fea47fae616c3b69489443bc`; V7 bleibt bis zur Ablösung regulärer Einstieg.

## 1. Auftrag und Ausführung

Ein späterer ausdrücklicher Umsetzungsauftrag auf diesen Plan mit **„erledige das“**
umfasst P0–P9 bis zum regulär gestarteten, auslieferbaren Atlas.
Eine ausdrücklich begrenzte Richtungsprobe umfasst nur ihre benannten Fälle.
Ein Planungsauftrag ist keine Implementierungsfreigabe.

### Ziel und erhaltener Nutzerumfang

Eine gemeinsame flache Weltkarte lässt sich vom Raum bis zur Welt navigieren
und bearbeiten. Navigation, lokale Eingriffe und Weiterarbeiten nach einem
Ortswechsel bleiben zügig, auch neben Speichern und längeren Berechnungen.
Arbeit hängt von Ausschnitt, Maßstab und tatsächlich geänderten Daten ab.

**Gleiche Nutzerfunktionalität bedeutet F01–F19 mit D01–D11.** Zeitabhängige
Pinselwirkung, sichtbare lokale Grundlage und Schutz vor einer Nachholdosis
bleiben erhalten. D10 beschreibt eine einmalige räumliche Mindestwirkung, die
auf die kumulierte Zeitwirkung angerechnet wird; die Eingabehäufigkeit erzeugt
keine zusätzliche Dosis.
Das bisherige globale Warten zwischen Dosen wird durch getrennte Annahme,
begrenzte Ausführung und lokale Wirkungsbegrenzung ersetzt. Gewöhnlicher Weg
und Endpunkt dürfen wegen eigener ausstehender Darstellung nicht verschwinden.
Der Strich bleibt bis zum vollständigen Aktionsabschluss eine geordnete Einheit.
V7 bleibt Funktionsreferenz; der kleine Höheneditor ist nicht der Zielumfang.
Innere Formate, ungenutzte APIs und Implementierungstests haben keinen Bestandsschutz.

| Nutzerbereich                    | Erhaltener Umfang                                                                      |
| -------------------------------- | -------------------------------------------------------------------------------------- |
| Navigation und Bedienung         | F01–F04: Kamera, 14 Ansichten, Auswahl, Inspector, Kontext, Gesten und Fokus           |
| Gelände und Landschaft           | F05–F07: sämtliche Höhen-, Farb- und Landschaftswerkzeuge, Vorlagen und lokale Details |
| Straßen und Bebauung             | F08–F12: Straßen, Geländefolge, Parzellen, Erzeugung und freie/gebundene Häuser        |
| Innenräume                       | F13–F14: Räume, Geschosse/Keller, Identitäten, Türen, Durchgänge und Treppen           |
| Regionen, Wasser und Kartenbild  | F15–F18: Regionen, Flüsse/Seen, Nachführung und lesbare Fantasykartografie             |
| Projekte und sichere Bearbeitung | F19: Dateien, Shortcuts, History, Fehler-, Abbruch- und Sessionverhalten               |

### Vereinfachungsmaßstab

Ein Paket ist aufgeräumt, wenn seine Nutzerfälle bestehen und der ersetzte Weg
mit Aufrufern, Tests, Konfiguration und Dokumentation entfernt ist. Weniger
Dateien oder Zeilen sind kein eigenes Erfolgsmaß. Vor einer Änderung die
entfallende Zuständigkeit, Wartebedingung oder Wiederholungsarbeit benennen.
Notwendige Unterschiede zwischen Modell, History, Persistenz und Darstellung
bleiben erhalten; kein globales `fresh`-Flag und keine Hüllen allein wegen Dateilänge.

Bereits umgesetzt sind ein effektiver Controllerzustand mit React-Feldentwürfen,
maßstabsgerechte Reads, Quellenpatches statt Vollkopien, lokale sichtbare Freigabe,
begrenzte Dosis, gerichteter Frameablauf und Reads während asynchroner Saves.
Diese Grundlagen erweitern und gezielt absichern; nicht erneut als offene
Aufräumprojekte beginnen. Aktuelle Restarbeit steht ausschließlich in Abschnitt 5.
Zwei Hosts und Prüfpfade bleiben bis zur vollständigen Ablösung in P9 nötig.

### Arbeitsregeln

1. `AGENTS.md`, relevante Teile der vier kanonischen Dokumente und diesen Plan
   lesen. Head und fremde Änderungen feststellen. Seit dem Ausgangsstand
   hinzugekommene aktive Funktionen in F01–F19 einordnen.
2. A01–A10 im jeweils beauftragten Paket anwenden; keine generische Service-, Eventbus-,
   Plugin- oder Jobserver-Schicht. Bestehende brauchbare Komponenten erweitern.
   Ein Sprachwechsel oder die Erhaltung alten Codes ist kein eigenes Ziel.
3. Den tatsächlich beauftragten Teil der Fortsetzung aus Abschnitt 5 ausführen.
   Eine Planung aktiviert keine Produktimplementierung. Bei einem späteren
   Umsetzungsauftrag zunächst R1–R5 aus Abschnitt 5 ausführen. Nach positiver
   Hardware-Richtungsentscheidung nur den begrenzten gemeinsamen P3-Fall mit
   den dafür nötigen P1/P2-Erweiterungen bauen. P4–P9 setzen die vollständige
   P0-Abnahme und den bestandenen gemeinsamen P3-Fall voraus.
4. Jedes Paket benennt Nutzerergebnis, betroffene Pfade, entfallende Altlogik und
   gezielten Nachweis. Unabhängige Fachpakete können parallel bearbeitet werden;
   Dokumentautorität, Integration und gemeinsame Verträge haben einen Besitzer.
5. Hypothese und Widerlegungskriterium vor einem unsicheren Versuch festhalten.
   Nach ausbleibendem Erkenntnisgewinn Ursache/Ansatz neu entscheiden; keine
   Kette unbelegter Mikrooptimierungen. A01 erlaubt einen gezielten Gegenkandidaten.
6. Nachweise am ausgeführten Stand führen. Relevante Änderungen öffnen nur ihre
   betroffenen Nachweise. Die kurze Richtungsprobe und die vollständige native
   Leistungsabnahme sind verschiedene Prüfzwecke, keine verschiedenen Produktwege.
7. Die Arbeitsmatrix in Abschnitt 7 enthält nur Paketstatus und Verweise.
   Ergebnisse stehen ausschließlich im ersetzten Kurzstatus; Rohbelege liegen
   ignoriert unter `artifacts/atlas-rebuild/<run>/`. Keine parallelen Pläne,
   Fortschrittsberichte oder neuen Prüfframeworks.
8. Bei Umsetzung bestehende Branchregeln und `Candidate · exact-SHA aggregate`
   einhalten. Keine Schwellen absenken, Fehler verschlucken oder Prüfungen
   ungenutzter Software als Ersatz anführen. Äußere Blocker konkret benennen;
   nach erfüllten Kriterien abschließen, ohne weitere optionale Runden.

### Umfang und Nichtziele

Der aktive Produkteinstieg umfasst Atlas. Neue Encounter-/Lootfunktionen,
Globus/3D, Mehrbenutzerbetrieb, Cloud-Sync, Bild-/PDF-/SVG-Kartenexport,
Assetimporte, Möblierung, Zentimeterraster, zusätzliche Dachtypen und neue
Generatorprodukte sind nicht Teil dieses Auftrags. Der Fantasykartenstil,
Landschaftsdeckung und Lichtungen bleiben erhalten.

Es bestehen laut `AGENTS.md` keine zu migrierenden Produktionsdaten.
Ein neues Format ist zulässig; keine Altformatadapter auf Vorrat.
Fremde Dateien werden nicht gelöscht oder bei fehlgeschlagenem Öffnen überschrieben.

### Gesicherter V7-Ausgangsbefund

Der V7-Kamerapfad verändert den Zustand lokal (`useCamera.ts`); vorhandene
Darstellung kann während weiterer Reads gezeichnet werden. Raster und Geometrie
werden bereits teilweise wiederverwendet. Die Ursache der gemeldeten langsamen
leeren Navigation ist deshalb nicht allein durch einen angeblichen SQL-Roundtrip
jedes Zoomereignisses erklärt. Die Ursachenmessung trennt Eingabe, React-/Framevorbereitung,
Zeichnen, Nachladen und native Grafikdarstellung.

Bei Höhenabschnitten sind dagegen Quellenwrite, Gewässer-/Flussnachführung und
Darstellungsvorbereitung vor der Bestätigung tatsächlich gekoppelt
(`src-tauri/src/atlas/application/terrain_stroke.rs`). Reads, Fachbefehle und
Dateioperationen teilen den seriellen `src-tauri/src/document_worker.rs`.
Diese Befunde begründen die Entkopplung, aber noch keinen Geschwindigkeitsvorteil
einer bestimmten Sprache oder Desktopumgebung. Die bisherigen drei-Striche-Werte
und grünen Funktionstests sind keine aktuelle native Zoom- oder Leistungsabnahme.

## 2. Bewusste Änderungen gegenüber Atlas V7

Die übrigen beobachtbaren Fachregeln des Ausgangsstands bleiben erhalten oder
werden fachlich gleichwertig umgesetzt. Andere Änderungen an Produktverhalten
brauchen eine konkrete Begründung im Plan; interne Transport-/Cacheformate,
Testanzahl und exakte Canvas-Antialiasingpixel müssen nicht erhalten werden.

| ID  | Festgelegter Zielvertrag                                                                                                                                                              | Konsequenz für Umsetzung und Abnahme                                                                                                                                                                                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D01 | Höhe besteht aus grober Form plus feineren relativen Abweichungen.                                                                                                                    | Grobes Anheben nimmt einen lokal ausgearbeiteten Graben mit. Relative Tiefe bleibt bis zur ausdrücklich geclippten natürlichen Höhengrenze ±100.000 Fuß erhalten. V7s Vorrang absoluter Feinhöhen wird ersetzt.                                             |
| D02 | Grobe Boden-/Landschaftsbearbeitung erhält ausdrücklich bearbeitete feinere Ausnahmen.                                                                                                | Eine Lichtung und lokal gesetzte Farbe bleiben erhalten. Grobe Striche schreiben keine feineren Quellen um. „Lokale Details zurücksetzen“ ist eine eigene Bereichsaktion mit Vorschau und Undo.                                                             |
| D03 | Große Geländeänderungen erzwingen keine synchrone globale Wasser-/Fundamentnachführung.                                                                                               | Die unten festgelegten Regeln für aktualisierte, veraltete und ausdrücklich neu berechnete Ableitungen gelten. Eine verspätete Wasserberechnung wird niemals unsichtbar an einen alten Undo-Schritt angehängt.                                              |
| D04 | Navigation verändert keine Autoren und startet keine neue Fachplanung allein wegen des Zooms.                                                                                         | Straßenrauheit wird bei Entwurfsbeginn aus dem damaligen Maßstab in Weltmaße umgerechnet und danach festgehalten. Neu planen geschieht bei Inhalt-/Parameteränderung oder ausdrücklicher Aktion.                                                            |
| D05 | Gewöhnliche lokale Bearbeitung verändert den aktiven Zustand direkt; Arbeitskopie und Projektdatei werden getrennt nachgeführt.                                                       | Im Editor geändert, abgeschlossene Aktion, in Arbeitskopie bestätigt und ausdrücklich gespeichert sind verschiedene Zustände. Die bisherigen Gesten-Abbruchregeln bleiben erhalten.                                                                         |
| D06 | Das neue `.saltatlas`-Format ist eigenständig versioniert.                                                                                                                            | Ausgangsformat 22 darf verständlich abgelehnt werden. Quelle und aktuelle Session bleiben bei fehlgeschlagenem Öffnen unberührt. Keine zweite Fachpipeline zur Altkompatibilität.                                                                           |
| D07 | Reine Altbestandstypen ohne aktuelles Erzeugungswerkzeug entfallen.                                                                                                                   | Die alten Materialpolygone und dekorativen Landschaftsstriche mit konkreten Assets werden nicht neu gebaut. Boden-/Felsfarbe und Landschaftsdeckung ersetzen sie vollständig. Entsprechende Legacy-Tests gezielt ausmustern; aktive Werkzeugfälle erhalten. |
| D08 | Grafik wird fachlich und visuell gleichwertig auf der GPU dargestellt.                                                                                                                | Reihenfolge, Positionen, Löcher, Materialien, Lesbarkeit und Auswahl stimmen; alte Canvas-Pixelbilder sind keine bindende Rastervorgabe.                                                                                                                    |
| D09 | Fachliche Einheiten und Weltumfang bleiben bestehen.                                                                                                                                  | Fuß als interne Längeneinheit, metrische Anzeige, 5-Fuß-Innenraster, vorhandene 14 Ansichten und maßstabsabhängige Werkzeugfreigaben. Kein zusätzlicher Produktumbau der Maßstäbe.                                                                          |
| D10 | Der vollständig angenommene Pinselweg einschließlich Endpunkt bleibt erhalten. Halten und langsames Ziehen erzeugen zusätzliche Zeitwirkung; bei Hängern entsteht keine Nachholdosis. | C1: einmalige Mindestwirkung je Stelle/Geste mit Anrechnung auf Zeit. Wiederbesuche verstärken durch Zeit, nicht durch erneute Mindestimpulse. Annahme und nicht rückgemeldete Wirkung bleiben begrenzt; Eingabeende und Aktionsabschluss sind getrennt.    |
| D11 | Bearbeitung beginnt auf sichtbarem, lokal bereitem Gelände; fehlende Bereitschaft ist sichtbar.                                                                                       | Keine Eingriffe oder vorgemerkten Striche auf noch unsichtbarem Gelände. UI, Eingabeannahme und Beobachtung verwenden dieselbe lokale Freigabe. Nach einer abgewiesenen Geste ist ein neuer Gestenbeginn nötig.                                             |

### D10/D11: gezielte Änderung der Eingabeverarbeitung

Der [P0-Produktvertrag](../product-contract.md#optionaler-atlas-p0-versuch)
beschreibt den integrierten R2-Code. Die Gegenüberstellung dokumentiert die
gezielte Änderung des ursprünglichen Dosierungs- und Abschlussvertrags.
Die Leistungsqualifikation bleibt trotz funktionaler Integration offen.

| Ausgangsmechanismus vor R2                                                | In R2 integrierter Mechanismus                                                                                                                              |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Eine ausstehende Dosis sperrt jede weitere Annahme.                       | Erfasste Geometrie, angenommene Wirkung und Darstellung haben getrennte Fortschrittsgrenzen; die lokale unquittierte Wirkung bleibt begrenzt.               |
| Jede Wirkung benötigt noch unverbrauchte Zeit.                            | Ein einmaliger räumlicher Mindestauftrag erhält die Bahn auch ohne neue Zeit; die darauf angerechnete Zeitwirkung erhält Halten und stärkere langsame Züge. |
| Eine erfolglose Zeichenchance kann Weg und Zeit gemeinsam verwerfen.      | Der erfasste, zulässige Weg bleibt erhalten. Überschüssige Zeit verfällt; echte Kapazitätsgrenzen werden vor Annahme sichtbar.                              |
| Pointerup verwirft einen wartenden Weg.                                   | Pointerup ergänzt den Endpunkt und versiegelt die Eingabe. Bereits angenommene Arbeit wird begrenzt als dieselbe Aktion fertiggestellt.                     |
| Eigene Änderungen machen die gesamte lokale Grafikfreigabe wieder falsch. | Neue Gesten verlangen aktuelle lokale Grundlage. Innerhalb einer Geste bleiben bekannte Grundlage und eigene kontrollierte Änderungen getrennt.             |

D11 bleibt für unbekannte Quellen, noch nie dargestellte Bereiche, neue
Ansichten, Kontextverlust und neue Gesten streng. Eine Geste darf nicht durch
gehaltenes Drücken auf einer Ladefläche vorgemerkt werden. Neue Bereiche ihrer
Bewegung brauchen ebenfalls eine nachgewiesene sichtbare Grundlage und die
vollständigen fachlichen Quellen einschließlich Halo. Nur die eigenen laufenden
Änderungen dürfen diese Grundlage nicht ständig wieder sperren.

**Nach R1 gewählte D10-Semantik:** C1 hält je Stützstelle das Maximum aus
kumuliertem angenommenem Zeitauftrag und einmaliger räumlicher Mindestwirkung
der vollständigen erfassten Spur. Der Anfangsklick gehört zu dieser Mindestwirkung.
Sie wird auf spätere Zeit angerechnet, nicht zusätzlich aufaddiert. Wiederholtes
Überfahren mit gleicher oder bereits verbuchter Zeit erhöht die Mindestwirkung
an einer schon vollständig erfassten Stelle nicht erneut. Neue Spurflächen,
Halten und zeitlich langsamere Züge behalten ihre Wirkung. Die konkrete Änderung
gegenüber dem verworfenen additiven C0 ist beabsichtigt und unten begründet.

Die Ziele werden nicht durch die Formel als erledigt erklärt. Bereits verbuchte
Haltezeit wird bei verspäteten Bewegungen weder neu erzeugt noch umverteilt.
Die kausale Zeitregel kennt keine noch nicht zugestellten Zwischenpositionen.
Der unabhängige Zeitnachweis zählt auch den durch die Mindestwirkung bereits
vorausbezahlten Zeitanteil genau einmal. Ein bloßer Receipt oder Abschluss
verändert weder Mindest-/Zeitkonto noch Autoren. Rate, Kernel, 50-%-Raumanker,
90-%-Normalzeit, örtliche 50-ms-Grenze und sämtliche Zeitziele bleiben erhalten.
Es gibt dafür keinen zusätzlichen Nutzerregler.

Der bestehende 5-Fuß-Grundrastervertrag bleibt bestehen: Ein sehr kleiner Pinsel
zwischen Stützstellen kann ohne Höhenwirkung bleiben. Weltradius und Rasterabstand
werden angezeigt; solche fachlichen Nullfälle zählen niemals als positive
Weg- oder Performancenachweise. Die normalen Bewegungsproben verwenden eine
unabhängig nachgewiesene positive Sollwirkung entlang ihrer gesamten Prüfspur.

**Abschlussvertrag:** Up versiegelt Endpunkt, Parameter und zugelassene Zeit-/
Wegbeiträge. Bereits angenommene, reservierte Arbeit darf danach Quellen ändern;
neue Eingaben oder zusätzliche Zeitwirkung entstehen nicht mehr. Der vollständige
Aktionsabschluss erzeugt genau einen Undo-Schritt. Erst danach gilt: kein
verspäteter Callback dieser Geste darf Autoren erneut verändern. GPU-Receipts und
Write-Acks erzeugen selbst niemals Pinselwirkung. Die gesamte Fertigstellung
einschließlich Darstellung verbraucht dasselbe Up-Zeitbudget aus Abschnitt 6.
GPU-Abschluss bleibt ein Rückmeldesignal, kein physischer Präsentationsbeleg.

### D03 konkret: Wasser, Flüsse, Fundamente und History

- **Fundamente** sind abgeleitete Darstellung aus Hausgrundfläche, Einstellungen
  und aktueller natürlicher Oberfläche einschließlich bestätigter Flussbetten.
  Betroffene sichtbare Fundamente werden mit begrenztem Budget nachgeführt;
  entfernte erst bei Bedarf. Innenraumdaten und Hausidentitäten ändern sich nicht.
  Eine Ableitungsaktualisierung ist kein eigener Autoren-/Undo-Schritt.
- **Bestätigte Flussprofile und Seemasken** bleiben bei einer späteren
  Terrainänderung zunächst erhalten. Die betroffenen Abhängigkeiten erhalten
  einen Veraltet-Status. Dieser Status gehört zu den gespeicherten Quelldaten
  beziehungsweise lässt sich beim Öffnen eindeutig aus deren Versionen ableiten.
  Fehlende Neuberechnung darf nicht als aktuelle hydrologische Lösung erscheinen.
  Dafür räumliche Quellen-/Bereichsversionen verwenden: Ein großer Terrainstrich
  durchläuft nicht alle Flüsse, Seen oder Häuser, um sie einzeln zu markieren.
  Betroffene sichtbare Ableitungen erkennen den geänderten Eingabestand bei Bedarf.
- **Darstellung lokaler Seen** verwendet die bestätigte Wasserfläche und ihren
  Pegel, geclippt gegen die aktuelle natürliche Oberfläche. Terrain oberhalb des
  Pegels ist sichtbar trocken. Eine dauerhafte Entfernung solcher Teile aus der
  gespeicherten Wasserfläche erfolgt erst durch „Gewässer an Gelände anpassen“.
  Erneutes Absenken vor dieser Aktion kann daher wieder Wasser sichtbar machen;
  dies ist eine ausdrückliche Änderung gegenüber V7s sofortiger Trockenlegung.
- **„Gewässer an Gelände anpassen“** berechnet für den gewählten Bereich alle
  betroffenen Seen und verbundenen Flusskomponenten, einschließlich nötiger
  Anschlüsse außerhalb des Ausschnitts. Eine versionierte Aufgabe erzeugt einen
  korrigierbaren Vorschlag. Übernahme ist eine eigene atomare Compoundaktion;
  Undo stellt Wasser-/Profilstand und Veraltet-Markierungen wieder her.
  Der Berechnungsstand besitzt inhaltliche Quellidentitäten, die Undo/Redo mit
  den Quellen restauriert. Sie sind von monotonen Ausführungsrevisionen zu
  unterscheiden: Terrain A → B → Undo zu A macht ein korrektes Profil für A
  wieder aktuell, obwohl die Ausführungsrevision inzwischen höher ist.
- **Neuer See, neuer/veränderter Fluss und Geländefolge einer Straße** bleiben
  vollständige Werkzeuge. Ihre aufwendige Planung läuft im Hintergrund. Nötige
  hydrologische Abhängigkeiten werden innerhalb dieser Aufgabe auf ihren
  Eingabestand gebracht; vorgeschlagene Quellenänderungen werden gemeinsam mit
  dem Ergebnis übernommen. Kein Commit wartet auf eine globale Weltbereinigung.
  Profile und Masken verwenden dabei den vollständigen unveränderlichen Kandidaten
  einschließlich eigener Terrainabsenkung/Uferpatches. Quellen, Wasserergebnis
  und Berechnungsidentität gehören zu derselben Übernahme und deren Undo/Redo.
- Direkte Terrainbearbeitung, nachfolgende Hydrologiekorrektur und deren Undo
  sind bewusst getrennt. Normale Terrainstriche warten nicht auf ein Flussnetz.
  Fertige Straßen werden wie bisher nicht durch spätere Höhenmalerei umgeplant.
- Ein Abbruch verwirft die noch nicht übernommene Aufgabe. Ein veralteter Vorschlag
  kann neu berechnet werden; er überschreibt keine zwischenzeitlichen Änderungen.

### Beobachtbare Grob-/Fein- und Gewässerszenen

Diese Bedienentscheidungen sind ausdrücklich Teil der Produktabnahme:

- **D01:** Einen feinen Graben innerhalb einer gleichmäßig angehobenen Region
  prüfen. Außerhalb des Übergangsrands und ohne Höhensättigung steigen Umgebung
  und Graben gleich weit; die relative Tiefe bleibt erhalten. Ein eigener
  Grenzfall prüft die einmalige Sättigung bei ±100.000 Fuß. P0c prüft die
  Grundfolge, P3 zusätzlich Detailrückkehr, Undo/Redo und Dateirundlauf.
- **D02:** Eine fein maskierte Lichtung überlebt grobe Waldänderung. Eine lokale
  Farbe und ausdrücklich transparente Feinmaske überleben grobe Farbänderung.
  „Lokale Details zurücksetzen“ zeigt Bereich und Felder, stellt dort Vererbung
  wieder her und lässt sich vollständig rückgängig machen. P3 prüft Landschaft,
  P4 zusätzlich Farbe und Bereichsaktion.
- **D03:** Bestätigtes Flussprofil, See und Haus in einer vorbereiteten Szene
  verwenden. Nach grober Anhebung behält das Flussprofil zunächst seine absoluten
  Höhen; sein Bett kann daher weiterhin tief einschneiden. Den Veraltet-Zustand
  und die Aktion „Gewässer an Gelände anpassen“ an der betroffenen Darstellung
  auffindbar machen. Sichtbares Seewasser wird gegen das aktuelle Gelände
  begrenzt, seine gespeicherte Maske bleibt bis zur Anpassung erhalten. Das
  Fundament folgt dem aktuellen Gelände einschließlich bestätigtem Flussbett.
  P3 zeigt diese Folgen mit echten vorbereiteten Quellen, bevor alle
  Gewässerwerkzeuge angebunden sind. P7 ergänzt Anpassung als eigenen atomaren
  Undo-Schritt, A → B → Undo nach A, stale Jobs und Reopen.

Die D03-Vorführung ist eine frühe fachliche Prüfung, kein zusätzlicher
Bestätigungsdialog für Aaron. Die beschriebenen Regeln bleiben der Vertrag;
eine andere Gewässersemantik darf nicht still als Performancekorrektur entstehen.

## 3. Architekturentscheidungen

### A01 — Bevorzugte Grundlage, frühe Auswahl und wenige Besitzer

**Bevorzugter Neubauansatz:** TypeScript für den Editor, React für Panels,
PixiJS 8 mit ausdrücklich gewähltem WebGL-Renderer, Electron als Desktoprahmen
und SQLite über `better-sqlite3` in einem eigenen Utility-Prozess. Electron Forge
baut mindestens Linux/RPM. Ein gemeinsamer Sprachraum und eine festgelegte
Chromium-Laufzeit begründen diesen Ausgangspunkt; sie beweisen keine Atlas-Latenz.
Passende stabile Versionen in P0 prüfen, gemeinsam pinnen und während des Umbaus
keine ungeplanten großen Versionssprünge durchführen.

Die Auswahl optimiert den einfachsten kohärenten Zielzustand. Bereits vorhandener
Code begründet keinen Bestandsschutz; ein vollständiger Sprachwechsel ist
umgekehrt kein Produktziel. P0a–P0f prüfen den bevorzugten Ansatz und bestätigen
den gewählten Ansatz vor dem vollständigen Quellen-, Datei- und Werkzeugausbau
nativ.

| Entscheidung      | Bevorzugte Wahl und Begründung                                                                                | Wann ein Gegenkandidat geprüft wird                                                                                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kartendarstellung | Pixi/WebGL: gemeinsame individuelle Darstellung von Kacheln, Fantasy-Symbolen, Werkzeugen und Hausinnenräumen | Nur bei konkreter Vereinfachung oder verfehltem Renderziel einen passenden Kartenrenderer prüfen; eigene ebene Koordinaten nicht pauschal als Ausschlussgrund für OpenLayers/MapLibre anführen. |
| Desktoprahmen     | Electron: festgelegter Chromium-Unterbau und zusammenhängender TypeScript-/Prüfpfad                           | Bei belegtem hostbezogenem Problem oder konkret einfacherer vollständiger Integration denselben kleinen Editorfall beispielsweise in Tauri prüfen.                                              |
| Fachkerne         | Gemeinsamer TypeScript-Kern für aktive Quellen und häufige lokale Änderungen                                  | Reine bestehende Berechnungen nur nach A08 übernehmen; keine pauschale Portpflicht und kein zweiter Dokumentserver.                                                                             |

Pixi liefert Grafikbausteine, nicht das Mehrstufen-, Nachlade- oder Undo-Modell.
Kartenbibliotheken können Kamera, Kacheln und Labels übernehmen, lösen aber nicht
automatisch Atlas-Pinsel, Detailerhaltung und Innenraumlogik. Diese Kosten kurz
im vorhandenen Status gegeneinander abwägen; keine allgemeine Bibliotheksstudie.

Eine positive Wahl verlangt den gemeinsamen Nachweis von Inhalt, erhaltener
normaler Wirkung, Ergebnistakt, Latenz und Ressourcen im benannten Umfang.
Fehlende Gegenbeispiele, grüne CI oder niedrige Latenz nur angenommener Eingaben
reichen dafür nicht. Die derzeit nachgewiesenen Fehler liegen im eigenen
Eingabe-/Renderablauf; deshalb bleibt der Stack für den begrenzten Gegenkandidaten
zunächst fest.

Nur eine benannte, überprüfbare Ursache oder Vereinfachung rechtfertigt je
Entscheidung einen passenden Gegenkandidaten im gleichen kleinen Szenario.
Erfüllen beide die Ziele, den einfacheren vollständigen Produktions- und Prüfpfad
wählen. Liegt der Fehler im gemeinsamen Algorithmus, diesen ändern; ein weiterer
Hostwechsel ersetzt keine Ursachenklärung. Keine zwei vollständigen Editoren
und kein allgemeines Mehrhost-Framework bauen.

Die gewählte Laufzeit, Speicheranbindung und Abweichungen mit Grund und
Nachweis im Status festhalten und die Zielstellen dieses Plans angleichen. Fehlender GPU-/Display-/Paketquellenzugriff ist
ein Umgebungsblocker und kein Beweis gegen einen Stack. Ein alternativer Host muss
dieselbe native Datei-, Paket- und Präsentationsabnahme ermöglichen.

**Auswahl des Pinselverfahrens:** R1 hat C0 am unten fixierten begrenzten
GPU-/Wiederbesuchsfall widerlegt und genau einen Gegenkandidaten C1 geprüft.
C1 ist durch R2 in den Höhenweg integriert. Verfeinerung der Rückmeldebelege allein war kein
Dosierungswechsel: Schon der reine C0-Wegauftrag überschritt das feste Limit.
Der gemeinsame Höhenkern, die positive Splineprojektion und der Renderpfad
bleiben Grundlage. Die geprüften C1-Inhalts-/Reservierungsregeln sind noch keine
integrierte oder native Leistungsfreigabe. Ein weiterer ungezielter Kandidat
gehört nicht zum Auftrag; ein R2/R4-Fehler verlangt eine konkrete neue Entscheidung.

Die Anwendung hat diese vier Besitzer, keine generische Serverarchitektur:

| Besitzer                     | Darf                                                                                                                                | Darf nicht                                                            |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `EditorDocument` im Renderer | Aktive Quellen, geordnete Änderungen, Gesten, Auswahl, History und Versionsstand besitzen                                           | Eine vollständige hochaufgelöste Welt im RAM voraussetzen             |
| `EditorController`           | Wirksame Einstellungen, Eingabe, Gestenzeit, Quellenbedarf, den einzigen Frameablauf und gemeinsame Rechenjobzulassung koordinieren | Autoren oder eine zweite Schreibwarteschlange besitzen                |
| `WorldRenderer`              | Aktuelle Kamera und begrenzte sichtbare Darstellung zeichnen                                                                        | Autoren verändern oder eine globale Bearbeitungsfreigabe bestimmen    |
| `ProjectSession`             | Einen geordneten Writer, Projekt-/Savedmetadaten, Recovery und Dateisperren besitzen                                                | Ein zweites Änderungsjournal oder eine zweite Autorenautorität führen |

Außerhalb des UI-Threads führt `ProjectStore` räumliche Reads, geordnete
Persistenz und Dateigrenzen aus. Er rechnet keine Fachentscheidung nach.
Hintergrundworker kommen erst für konkrete längere Fachjobs hinzu; sie erhalten
unveränderliche Eingaben und liefern versionierte Ergebnisse oder Vorschläge,
kein unabhängig veränderliches Dokument.

Beim Electron-Default besitzt Main nur Fenster, Dialoge, Prozesslebenszyklus und
die schmale Anbindung. Renderer: `contextIsolation: true`, kein direkter Node-/
Dateisystemzugriff, lokale Ressourcen und begrenzte Preload-API. SQLite und
Generatoren laufen weder im Renderer noch im Main-Prozess. Native SQLite-
Abhängigkeit früh gegen die tatsächliche Electron-ABI bauen und im installierten
Paket prüfen. Eine bestätigte Alternative erhält dieselben Zuständigkeiten,
Schutz- und Nichtblockierungsregeln mit ihrem konkreten schmalen Speicher-/Dateiadapter.

### A02 — Koordinaten und Kacheln

- Welt: ebene Fläche innerhalb `[-100_000_000, +100_000_000]` Fuß je Achse,
  kein Wraparound; Höhen endlich innerhalb der bestehenden fachlichen Grenzen.
  Zoom `0.000002` bis `25.6` CSS-Pixel pro Fuß, 14 benannte Ansichten wie bisher.
- CPU-Geometrie: JS-Doubles; Hauszellen: ganzzahlige lokale Koordinaten und
  bestehendes 5-Fuß-Raster. Für GPU-Positionen den Kamera-/Kachelursprung zuerst
  mit CPU-Genauigkeit abziehen. Große absolute Weltwerte nicht vorher in Float32
  umwandeln. Picking verwendet dieselbe Transformation und echte Geometrie.
- **Autorenkacheln:** 64 × 64 Werte, unabhängig von der Bildschirmauflösung.
  Höhenabstand `5 * 2^level` Fuß, Level 0–21. Boden-/Felsfarbe und Landschaft
  `2^level` Fuß, Level 0–24. Schlüssel `(layer, level, tileX, tileY)`.
  Negative Koordinaten mit `floor`, Halbintervalle und feste Randbesitzregel.
- **Darstellungskacheln:** normalerweise 256 × 256 Pixel plus nötigem Halo;
  DPR und sichtbare Auflösung dürfen diese Darstellung anpassen, niemals die
  Autorenauflösung. Quellen, Übersichten und GPU-Texturen sind getrennte Typen.
- Leere Welt: Metadaten mit Ozean, Meeresspiegel 0 und Grundhöhe −100 Fuß.
  Keine vorbereitete Quadtree-Vollbelegung, leeren Objektlisten pro Weltzelle oder
  hochaufgelösten Ozeanraster anlegen. Eine Sparse-Tabelle mit Levelschlüsseln reicht.

### A03 — Zusammensetzung und numerische Übersichten

**Autoren bleiben die einzige fachliche Wahrheit.** Der kanonische Sampler
rekonstruiert positive kubische Restfelder, addiert sie zur Grundhöhe und begrenzt
erst die vollständige Summe auf ±100.000 Fuß. Oberfläche, Küste und exakte
Werkzeugabfragen verwenden diese Mathematik. Grobe Änderungen lassen feinere
Restwerte unverändert; Quellen und abgeleitete Darstellung sind verschiedene Typen.

Boden-/Felsfarbe besteht aus lokaler Maske und vormultiplizierten RGBA-Werten,
Landschaft aus Maske und vier normierten Gewichten. Fehlender Autor erbt;
explizit transparente Farbe/leere Landschaft unterdrückt den gröberen Wert.
Eine Maske ist kein Farbalpha. Beim Feinmalen zuerst den gültigen geerbten Wert
ermitteln. Glätten/Einebnen betrifft die gewählte Formstufe; vollständiges
Zurücksetzen lokaler Ausnahmen ist eine eigene Bereichsaktion mit Vorschau und Undo.
Sie trifft die gewählten Felder, keine Häuser, Räume oder Straßen.
Zu große atomare Aktionen verständlich ablehnen oder begrenzt vorbereiten.

**Bevorzugter kleiner Versuch für Höhe:** Pro weltverankerter Darstellungsstufe
numerische Samples der feineren additiven Beiträge speichern. Grobe Autoren
werden aus wenigen passenden Quellen separat hinzugerechnet. Erst danach
Höhenlimit, Land/Wasser und Materialdarstellung bestimmen.
Die Übersicht speichert keine Autoren und kein bereits eingefärbtes Bild.

1. Rasterursprung, Abtastpunkte, Halo und die Grenze zwischen zusammengefassten
   feinen und direkt ausgewerteten gröberen Stufen einmal festlegen. Jeder Beitrag
   geht genau einmal ein. An einem Render-Abtastpunkt ist die Zusammenfassung die
   Summe derselben kubischen Basis; simples 2×2-Mitteln verschobener Samplepunkte
   oder eingefärbter Pixel ist kein gleichwertiger Ersatz.
2. Ein Quellenpatch aktualisiert nur betroffene Übersichtssamples in seinem
   kubischen Stützbereich auf den darüberliegenden Darstellungsstufen.
   Kein Lesen oder Invalidieren sämtlicher feiner Nachfahren bei grober Änderung.
   Stufenanzahl, wirklich berührte Zellen, Reads und Bytes mitzählen.
3. Der Pointerpfad ändert Quellen und nur die aktuell benötigte Darstellung.
   Der Store führt abgeleitete Übersichtswerte mit derselben reinen Deltafunktion
   innerhalb seiner geordneten Commit-Grenze nach. Er trifft keine Fachentscheidung.
   Quellen und zugehörige Übersicht einer bestätigten Sequenz bleiben konsistent.
4. Noch nicht in einer gelesenen Übersicht enthaltene lokale Patches werden
   genau einmal darüber projiziert. Ihre Entfernung setzt voraus, dass die
   aktive Basis bereits auf denselben Stand fortgeschrieben wurde. Ein
   Persistenz-Ack allein macht eine alte geladene Übersicht nicht aktuell.
   Alte Antworten dürfen weder Änderungen ausblenden noch doppelt anwenden.
5. Keine neue unbeschränkte Patchchronik oder zweite veränderliche Welt bauen.
   Bestehende unbestätigte Patches, Quellidentitäten und begrenzte aktive
   Darstellungsdaten reichen als erster Kandidat. Fehlende/alte Übersicht ist
   ausdrücklich unbekannt, nicht Höhe null oder Ozean.
6. Übersichtsaufbau und laufende Pflege getrennt nachweisen. Vorbereitete Fixtures
   sind erlaubt; globale Vorbereitung nicht vor jedem Open/Zoom wiederholen.
   Save/Undo/Redo/Reopen prüfen konsistente Zusammenfassung und unveränderte Autoren.
   Delta-Drift, negative Koordinaten, Halo, Höhensättigung und Küstenschwellen gegen
   unabhängig erwartete Werte prüfen. Ein hoher Bestand darf nicht hinter
   Vorladen oder einem nachträglich geleerten Cache verschwinden.

Der Höhenpfad ist implementiert; sein erreichter Nachweisumfang steht im Status.
Farb-/Landschaftsausbau und native Leistung bleiben eigenständig zu beweisen.
Eine feste Stufenzahl allein beweist keine ausreichende Geschwindigkeit. Nur ein
konkreter neuer Befund rechtfertigt eine andere Übersichtslösung.

Farb-/Landschaftsübersichten folgen ihren Masken-/Vererbungsregeln, nicht der
additiven Höhenformel. P3/P4 erweitern den Höhenbeweis darauf.
Landschaftskandidaten bleiben ortsfest/reproduzierbar und nur sichtbar erzeugt.
Ferne Wälder verwenden Deckung, entfernte Häuser keine Innenpayloads.

### A04 — Aktive Daten und gezielte Ladebereitschaft

`EditorDocument` besitzt aktive Autoren, angenommene Änderungen und History.
Bestätigte entfernte Daten dürfen verdrängt werden. Unbestätigte Patches,
aktive Gesten und notwendige Undo-Vorherwerte bleiben gehalten oder liegen in
begrenzter temporärer Ablage.

Der aktive Quellenbestand und seine Bereitschaftsbelege werden gemeinsam nach
**Bereich und Stufe** begrenzt. Ein gültiger Flächenbeleg setzt voraus, dass alle
vorhandenen Quellen seiner Stufen, deren kubischer Einflussbereich ihn schneidet,
noch im aktiven Dokument gehalten werden.
Fehlende Einträge ohne Beleg sind unbekannt; dafür entsteht kein dauerhafter
Eintrag je früher besuchter Quelle. Eine nachweislich leere Neuanlage beginnt mit
einem gewöhnlichen Ganzweltbeleg, nicht mit einer dauerhaften Ausnahme von diesen
Regeln. Die konkrete Reparatur einschließlich alter Reads steht in Abschnitt 5.

Es gibt zwei Lesezwecke mit einer gemeinsamen, typisierten Antwortgrenze:

- **Exakte Bearbeitung:** benötigte Quellstufen/-schlüssel plus Eltern/Halo und
  relevante Owner-/Kollisionsdaten. Ein grober additiver Höhenpinsel verlangt
  keine vollständigen feineren Autoren.
- **Darstellung:** zum Maßstab passende numerische/Geometrieübersichten und
  die benötigten groben Quellen. Keine Vollständigkeitsfreigabe sämtlicher
  Feindaten des sichtbaren Weltbereichs.

SQLite-RTree begrenzt räumliche Auswahl und Quellenstufe vor der Enumeration.
Für zusätzliche aktive Geometrie einen kleinen räumlichen Index nutzen. Objektliste,
Labels, Auswahl und Kollision laden nicht sämtliche Weltobjekte; ausgewählte
vereinfachte Straßen/Flüsse erhalten exakte Header. Innenpayloads bleiben getrennt.

Die vorhandenen Quellenzustände, lokale Freigabe und gemeinsame Antwortprüfung
stehen in der Architektur. Neue Felder/Objekte müssen dieselben Session-,
Sequenz- und Patchprojektionsregeln verwenden; keine zweite Ladestrategie aufbauen.
Der aktuelle Werkzeugbedarf bleibt von einer Modellgeste unabhängig. Bereits
zulässige Hausgesten dürfen nötige Offscreen-Owner revisionsgleich auflösen;
daraus entsteht keine globale Sichtbarkeitsfreigabe. M10 erweitert den bestehenden
kalten Höhenfall auf die neuen Quellen und Werkzeuge.

### A05 — Befehle, Gesten und direkte Bearbeitung

Gemeinsame reine Typen und Funktionen unter `src/editor/model/` besitzen
Koordinaten, Kachelschlüssel, Bounds, Patches und fachliche Validierung.
Store und Worker verwenden sie; native Binärcodecs und Vertrauensgrenzen bleiben
an ihren jeweiligen Eingängen. Grenzen werden nicht durch unvalidierte Casts ersetzt.
Alle Werkzeuge verwenden dieselbe Fachmathematik und denselben atomaren
Übernahmepfad; keine zweite Vorschau-/Commit-Logik oder Werkzeug-eigene Queue.

Wirksame Einstellungen, Fehler und Auswahl haben genau einen Besitzer im
Editorzustand. React hält nur echte noch nicht übernommene Feldentwürfe.
Saved/Dirty wird aus den tatsächlichen Grenzen abgeleitet. Session, Quellrevision,
abgeschlossene Aktion, bestätigte Arbeitskopie und gespeicherte Datei bleiben
verschieden; sie dürfen nicht zu einem einzelnen `fresh`-Flag zusammenfallen.

- Kamera und hochfrequente Pointerzustände bleiben außerhalb von React-State.
  Ersetzbare Darstellung/Vorschau darf `latest wins` sein, angenommene
  Quellenänderungen nicht. D10/D11 gelten mit der bewussten Präzisierung aus
  Abschnitt 2 und dem Aufnahme-/Abschlussalgorithmus aus Abschnitt 5.
- Aktive Gesten halten Originalwerte und geänderte Bereiche. Kleine Änderungen
  verändern bereite Quellen direkt; große Geometrie-/Netzoperationen werden
  Hintergrundaufgaben. Ein Pinselbatch verändert eine betroffene Quellkachel
  höchstens einmal und veröffentlicht einen unveränderlichen Nachherstand.
  Rendern darf mehrere solche Stände zusammenfassen; das Dokument verliert
  dadurch keinen Abschnitt. Andere Flächenpinsel erhalten ihren räumlichen Pfad
  und bei Farbfluss die Zeit.
- **Boden/Landschaft/Region/Gewässer:** Up versiegelt die Eingabe; die begrenzte
  Fortsetzung bleibt bis zur atomaren Aktionsübernahme Teil derselben Geste.
  Escape, Blur, Pointercancel und Werkzeugwechsel vor Up setzen die aktive Geste
  auf ihre Vorherwerte zurück. Live-Anzeige benötigt deshalb echte Rücknahme.
  Nicht abgeschlossene abbrechbare Gesten nicht als dauerhafte Aktion speichern.
  Ein bereits versiegelter Abschluss wird durch späteres Escape/Blur nicht
  widerrufen. Höhen behalten ihre abweichende Erhaltungsregel aus Abschnitt 5.
- **Mehrknotenentwürfe:** Enter, Button oder Rechtsklick übernehmen nur gesetzte
  Geometrie; Escape verwirft den Entwurf, innerhalb eines Drags zunächst den Drag.
  Feld-Enter/-Escape wirken nur im Feld. Eine angenommene Aktion wird durch
  nachfolgende Navigation, Escape oder UI-Remount nicht verloren.
- Parameter, Weltradius und Autorenstufe am Gestenbeginn festhalten. Bestehende
  Regel „kein Zoom mitten im aktiven Pinselstrich“ erhalten; Pan/Zoom zwischen
  Gesten und während Hintergrundaufgaben bleibt verfügbar.
- Compoundaktionen prüfen ihre vollständige lokale Abhängigkeitsmenge und
  übernehmen atomar. IDs erst bei Annahme vergeben. No-ops erzeugen keinen
  Historyeintrag und verwerfen keinen Redozweig. Undo/Redo verwenden dieselben
  Invalidierungs- und Persistenzwege wie normale Änderungen.

### A06 — Ein aktueller Dokumentstand, begrenzte Darstellung

Die Kamera transformiert vorhandene Darstellung ohne Autorenänderung, SQL oder
erneute Höhenrekonstruktion. Der Renderer besitzt ausschließlich abgeleitete
Daten. Die normale Autorenmutation bleibt zunächst im UI-Prozess; ihr Aufwand
ist durch die radiusabhängige Autorenstufe lokal begrenzt und wird in R1/R2
gemessen. Angenommene Restarbeit darf in kurzen Schritten innerhalb des gesamten
8-ms-CPU-Ziels weiterlaufen. Up verlangt keine unteilbare Restberechnung.
Die Fortsetzung gehört zur einen Geste des EditorDocument; sie schafft weder
eine zweite Autorenwelt noch eine allgemeine Befehlswarteschlange. Ein Worker
ist erst bei einem gemessenen Bedarf für eine reine begrenzte Teilrechnung
zulässig; autorenändernde Vorschläge übernimmt allein das Dokument. Abgeleitete
Projektionsresultate prüft und übernimmt dagegen der Renderer.

**Ein neuester Wunsch und ein eingefrorener Renderstand:** Quellenänderungen
führen pro Schlüssel zum neuesten unveränderlichen Nachherstand und vereinigen
ihre Dirtyrechtecke. Sobald Grafikarbeit beginnen darf, friert der Renderer
einen Stand R mit seinen Quellen, Übersichten, Basis-/Vorbereitungskennungen,
sichtbaren Zielkacheln und Session/Ansicht ein. Ausgewählt wird zuerst der aktuelle
Werkzeugbereich mit der vollständigen sichtbaren Einflussmenge der in R1
gewählten lokalen Belegeinheiten. Alle dafür nötigen Autoren und Übersichten müssen bereitliegen.
Unabhängige kalte, fehlerhafte oder auf einen Ausnahmejob wartende Gebiete bleiben
im neuesten Wunsch; sie belegen den normalen Renderplatz nicht. Diese Rendergruppe wird in kurzen
Paketen fertiggestellt. Spätere Änderungen sammeln sich nur im nächsten neuesten
Wunsch. Es gibt keine Liste historischer Renderjobs und keine Warteschlange
vollständiger Frames. Geborgte Quellpuffer bleiben bis zur Rückmeldung gehalten;
Liveautoren dürfen sie nicht verändern.

Der Unterschied wird vom zuletzt übernommenen Quellenstand zum neuesten
eingefrorenen Stand gebildet; nur den letzten einzelnen Patch zu übernehmen
würde beim Zusammenfassen Änderungen verlieren. Das gilt ebenfalls für
numerische Feinübersichten. Sämtliche zusätzlich gehaltenen Quell- und
Übersichtspuffer werden als eindeutige physische Puffer gegen das
CPU-Darstellungsbudget reserviert. Die Aktionsgrenze von 512 Kacheln ist keine
allgemeine Obergrenze einer aus mehreren Gesten zusammengesetzten Darstellung.
Rückmeldebelege und reservierte Restarbeit der Geste werden in Abschnitt 5
gesondert begrenzt; eine vollständige Rückmeldekopie je Stützstelle ist keine
vorgegebene Datenstruktur.
Bei fehlender Reserve keine bereits angenommene Änderung verwerfen.
Vor Arbeitsbeginn auch den Spitzenbedarf des nächsten kleinen Schritts samt
abschließendem Scene-Receipt reservieren, einschließlich Workerinputs/-outputs
und noch fencegebundener Altressourcen. Ein voller Cache darf nicht gerade den
Speicher blockieren, den sein eigener Abschluss zum Freigeben braucht.

R umfasst die gesamte sichtbare kubische Einflussmenge der ausgewählten
Quellenbereiche. Dirtyrechtecke bestimmen die nötigen Displaykacheln; feinere
Masken sind nur nötig, wenn die gewählte lokale Begrenzung sie benötigt.
Eine Quellkachel mit Änderungen bei A und B darf nicht vollständig quittiert
werden, wenn nur A gezeichnet ist. Teilquittungen erfordern einen vollständigen
Beleg genau ihres Bereichs. Eine konservativ gröbere Belegeinheit ist zulässig,
wenn sie die lokalen Wege und normalen Leistungsziele ebenfalls erfüllt. Eine neue Änderung an einer bereits
vorbereiteten Kachel überschreibt R nicht. Nach R folgt direkt der dann aktuelle
Wunsch; überholte Zwischenstände entfallen. Dirtyrechtecke bleiben vereinigt,
bis der entsprechende neuere Stand tatsächlich gezeichnet wurde. Undo, neue
Quellen und geänderte Übersichten laufen durch dieselbe Versionsgrenze.

Eine begonnene entfernte Hintergrundgruppe weicht einer neuen lokalen Geste
spätestens nach ihrem bereits eingereichten Terrainpaket. Noch nicht eingereichte
Restarbeit geht in dieselbe Dirtyunion zurück, fertige Cacheteile bleiben erhalten;
keine angehaltene zweite Kohorte aufbewahren. Weitere Moves derselben aktiven
Geste brechen ihre laufende Gruppe dagegen nicht dauernd ab. Hintergrundarbeit
erhält zwischen lokalen Gruppen verbleibende Kapazität, ohne lokale Quittungen
an unabhängige Ladefehler zu binden.
Dirtyteile nur entfernen, wenn ihre Version noch genau R entspricht und genau
dieser Bereich vollständig übernommen wurde. Den zugehörigen neuesten Eintrag
erst entfernen, wenn alle seine erforderlichen Bereiche übernommen sind; spätere
Änderungen bleiben erhalten. Eine unterbrochene Vorbereitung
zieht die übernommene Quell-/Übersichtsbasis nicht vor. Ihre kleine Einheit wird
vollständig veröffentlicht oder verworfen; keine halb angewendete Differenz mit
bereits fortgeschriebener Versionskennung. Der Übernahmestand gilt für diese
abgeleitete Teilfläche, nicht pauschal für noch unbearbeitete Gebiete derselben
Autorenkachel.

**Vorbereitung wird vor ihrer Ausführung begrenzt.** Priorität: aktueller
Werkzeugbereich, übriger sichtbarer Bereich, Navigationsrand. Höchstens
2 ms CPU-Vorbereitung je RAF innerhalb des gesamten 8-ms-Ziels für Eingabe und
Framevorbereitung. Einzelaufgaben müssen klein genug sein, dass eine Zeitprüfung
zwischen ihnen wirkt; volle CPU-Raster oder komplette große Quellvalidierungen
sind keine unteilbaren Frameaufgaben. Validierung erfolgt beim Import oder bei
einer tatsächlichen Quellenänderung. Stufen-/Raummetadaten und lokale Magnituden
werden dort gepflegt, statt je Displaykachel alle residenten Quellen zu scannen.
Harte Arbeitszähler bleiben zusätzlich als maschinenunabhängige Grenzen.

Uploads bleiben beim Ressourcenbudget aus A09, anfangs höchstens 4 MiB je Frame.
Sie belegen ebenso wie Clears,
Puffertransfers und Cacheprojektionen einen freien Terrain-Slot; auch ein reines
Uploadpaket erhält Fence und Flush. Zwei wartende Draws dürfen nicht von weiteren
Uploads in der Treiberqueue begleitet werden. Benutzte Texturen und Pages bleiben
bis zum letzten sie referenzierenden Fence gehalten und werden erst danach
umgewidmet oder verdrängt. GPU-Teilpakete enthalten vollständige
lokale Schritte horizontal → numerisch → Farbe. Ein halbfertiges numerisches Ziel
wird nicht als aktuelle Farbkachel eingeblendet. Ziel für ein Terrainpaket sind
höchstens 4 ms GPU-Zeit auf der qualifizierten Referenz; nachgewiesene Paketkosten
kalibrieren die Auswahl, ohne Produktgrenzen zu erhöhen. Eine nicht präemptierbare
Teilaufgabe oberhalb des Budgets wird kleiner geschnitten. Ein einzelnes Tile
darf nicht pauschal eine beliebig lange Aufgabe bleiben.

**Grafikstau bleibt begrenzt:** höchstens zwei unquittierte GL-Einreichungen,
davon höchstens ein Terrainpaket und ein günstiger Scene-/Kameradraw.
FIFO-Fences werden mit Timeout null abgefragt. Der nächste Kamerawunsch ersetzt
den vorherigen; er darf mit fertigen Farbkacheln gezeichnet werden, während die
gesamte Rendergruppe R noch nicht fertig ist. Ein Cursor als DOM-/CSS-Overlay
hängt nicht an der Terrainkomposition und gilt niemals als Geländenachweis.
Es gibt keinen zusätzlichen Canvas-Transform-/Bitmapkopierpfad. Bei tatsächlich
hängender GPU können auch zwei Slots voll sein; dann bleiben Eingabe und neuester
Kamerawunsch erhalten, ohne weitere GL-Arbeit zu stapeln. Physisch flüssige
Grafik trotz hängender GPU wird nicht behauptet.

**Eine inhaltlich vollständige Rückmeldung:** Erst wenn alle erforderlichen
sichtbaren Zielteile von R in einer Scene eingereicht und hinter deren Fence
abgeschlossen sind, darf R die Rückmeldebelege der lokalen Wirkungsgrenze
fortschreiben. Teilpakete, bloße Uploads oder ein Draw des alten Bildes geben
keine weitere Wirkung frei. Der Receipt identifiziert die unveränderlichen
Quellstände von R, den vollständig quittierten Bereich, Session, Ansicht,
Gestenbezug und Vorbereitungskennung.
GPU-Readback ist dafür nicht erforderlich. Die Rückmeldung kann älter als der
neueste Dokumentstand sein; sie darf gerade nicht diesen neueren Stand bestätigen.
Der letzte Scene-Draw darf im selben RAF direkt nach dem letzten Terrainpaket
eingereicht werden; GL-Reihenfolge erhält die Abhängigkeit. Nicht zunächst auf
dessen Fence warten und dadurch eine weitere obligatorische Frameperiode
einbauen. Erst der eigene Fence dieses Scene-Draws quittiert R.
Der Renderer meldet kein physisches Präsentationsdatum.

Der feste warme Höhenweg bleibt zunächst
H_aktuell = H_basis + (C_aktuell − C_basis). Die separable Projektion berechnet nur
die tatsächlich geänderten Rechtecke. Die feste Basis darf über mehrere
zusammengefasste Modelländerungen bestehen bleiben. Kalter Aufbau, echte
Stufenwechsel, Fehlerbudget, höchstens 32 Basisübernahmen und Kontextwiederaufbau
bleiben versioniert und budgetiert. Eine Verbesserung dieses bestehenden
Renderwegs ist ein Kandidat, keine vorweggenommene Leistungszusage.

**Normale Zahlen bleiben im GPU-Pfad.** Quellwerte bleiben Float64. Beim abgeleiteten
GPU-Encoding dürfen ausschließlich skalierte Beträge unter 1e-30 als null
repräsentiert werden. Positive normalisierte Splinegewichte begrenzen den dadurch
zusätzlich entstehenden Höhenfehler einer kanonischen Projektion über 22 Stufen
und Rückskalierung 32 auf höchstens 7,04e-28 Fuß. Für den warmen Weg Basisfehler
und beide Projektionsfehler konservativ addieren; echte Basisübernahmen führen
dieses Fehlerbudget bis zum spätestens nach 32 Übernahmen nötigen Neubau fort.
Zum übrigen Projektions-/Basisfehlerbudget hinzurechnen; keine Autorenwerte oder
gespeicherten Quellen ändern. Die bestehende
Darstellungstoleranz von 1e-6 Fuß und die fachliche CPU-Referenz bleiben erhalten.
Die normale Zoomfolge um Skala 0,01 darf deshalb keine CPU-Fallbackkachel erzeugen.

Echte extreme Koeffizienten, unsichere Auslöschung oder fehlende numerische
GPU-Unterstützung verwenden einen begrenzten Float64-Job außerhalb des UI-Threads:
höchstens ein aktiver Ausnahmejob mit unveränderlichen lokalen Quellen, kleinen
Arbeitsabschnitten, Abbruchkennung und Prüfung seines exakten Eingabestands bei
Übernahme. Ein in derselben Session noch benötigter älterer Stand R darf wie im
GPU-Pfad dargestellt und quittiert werden; Gleichheit mit den neuesten Liveautoren
ist keine Übernahmebedingung. Neue Pointerbatches dürfen den Ausnahmejob nicht
dauernd neu starten. Inkompatible Session/Ansicht oder nicht mehr benötigte Ziele
verwerfen sein Ergebnis.
Er zählt zur festgelegten gemeinsamen Grenze von zwei rechenintensiven Jobs.
Mit dem ersten produktiven Ausnahmejob in R3 besitzt der `EditorController` die
minimale gemeinsame Belegung, Priorität und Abbruchverwaltung; der diagnostische
Lastworker verwendet dieselbe Zulassung. Ein Abbruch
macht das Ergebnis sofort ungültig; den Slot gibt erst das tatsächliche Ende
oder die bestätigte Beendigung der Berechnung frei. `WorldRenderer`/`HeightField`
fordern die Ausnahmeprojektion an und prüfen ihren Eingabestand vor Übernahme;
die gemeinsame Zulassung wird keine weitere Datenautorität. Spätere Fachjobs
in P1/P3 verwenden dieselbe Verwaltung, keine eigene Queue je Werkzeug.
Nur der neueste noch benötigte Ausnahmestand bleibt vorgemerkt.
Kalte betroffene Flächen zeigen Warten; bestehende
Bilder bleiben sichtbar und als veraltet erkennbar. Eine normale Referenzgeste
darf ihre Zeitziele nicht durch diesen Ausnahmeweg umgehen.

Längere Fachjobs erhalten unveränderliche Eingaben und vollständige lokale
Readsets einschließlich bestätigter Abwesenheit und räumlicher Abfragen.
Nur das aktive Dokument übernimmt geprüfte Vorschläge. Neue Objekte im
Readset invalidieren alte Vorschläge; unabhängige Änderungen anderswo nicht.
Maximal zwei rechenintensive Jobs, wirksame Priorität lokaler Arbeit und keine
unbegrenzte Queue. P3 prüft echte Bebauungs-/Hydrologiearbeit neben Save.
Quellgültigkeit, abgeleitete Aktualität, GPU-Abschluss und Präsentation bleiben
getrennte Fakten.

### A07 — Arbeitskopie, Projektdatei und Fehler

- Neues Projekt beginnt in einer temporären SQLite-Arbeitskopie. Abgeschlossene
  Aktionen erhalten eine Sequenznummer und werden in Reihenfolge transaktional
  geschrieben. Die Bestätigung benennt die letzte gesicherte Arbeitssequenz.
- Projektdatei bleibt `.saltatlas`; neue eindeutige Versionskennung. Der aktuelle
  P0-Kern verwendet Format 24 für persistierte numerische Übersichten; der frühere
  Versuch verwendete 23 statt V7s 22. Bei weiterer Schemaänderung die nächste
  freie Version wählen. Das vollständige Schema umfasst Metadaten/Versionen, Quellkacheln mit Masken,
  Objektheader, getrennte Innenpayloads, Regionen/Katalog und Hydrologiedaten.
  Räumliche Indizes und Vorschauen sind abgeleitet und rekonstruierbar.
- Arbeitskopie und Quellenrevisionen werden nicht bei jeder Navigation geschrieben.
  Metadatenänderung oder Hausbewegung liest keine vollständigen Hauszellen.
  Öffnen lädt Metadaten und nötige Ausschnitte, nicht alle Innenräume in den RAM.
- **Speichern/Speichern unter** reserviert eine abgeschlossene Sequenz S, erstellt
  einen konsistenten SQLite-Snapshot und ersetzt das Ziel über eine benachbarte
  synchronisierte temporäre Datei atomar. WAL-Dateien nicht blind kopieren.
  Ein nach Up angeforderter Save wartet über die vorhandene Aktionsgrenze auf
  die vollständig angenommene Restarbeit und schließt diesen Strich in S ein.
  Niemals stillschweigend die vorherige Sequenz als fertigen Save ausgeben.
  Navigation bleibt frei; spätere Änderungen bleiben gegenüber S ungespeichert.
  Die Implementierung muss den Snapshot von S auch bei weiterlaufenden Writes
  beweisen, etwa durch eine passende SQLite-Lesesnapshot-/Backup-Grenze.
- **Dringende Reads:** Die vorhandene Trennung synchroner Reads von geordneten
  Mutationen und asynchronen Dateioperationen erhalten. Neue Lesezwecke verwenden
  dieselbe Session-/Sequenzprüfung und lokale Patchprojektion; keine weitere
  Datenbankverbindung oder zweite Queue für Quellenänderungen auf Vorrat.
- Saved-Status hängt am erfolgreich ersetzten Ziel, nicht an einer Workerantwort
  über die temporäre Arbeitskopie. Speicherdialogabbruch verändert kein Ziel.
  Fehler behalten den aktuellen Zustand und die vorherige gültige Zieldatei.
- Undo: bis zu 100 Aktionen; zusätzlich ein ausdrücklich dokumentiertes
  Bytebudget. Große Vorherwerte dürfen in der temporären Historyablage liegen.
  Älteste komplette Aktionen begrenzt entfernen, niemals Teile einer Compoundaktion.
  History wird nicht als dauerhafter Projektinhalt wieder geöffnet.
- Workerabsturz/Schreibfehler: noch nicht bestätigte Änderungen erhalten,
  verständlichen Fehler melden und keine unsichere Aktion blind doppelt senden.
  Über Sequenz und Transaktionskennung abgleichen. Notfalls weitere Schreibannahme
  begrenzen; Kamera und Lesen bereits vorhandener Daten bleiben bedienbar.
- Undo/Redo und weitere mutierende Befehle passieren die Abschlussbarriere der
  einen versiegelten Geste. Undo nimmt anschließend den vollständigen Strich
  genau einmal zurück. Keine werkzeugeigene Folgequeue einführen.
- Neu/Öffnen/Schließen verwenden den vorhandenen Save/Discard/Cancel-Vertrag.
  Save wartet auf die genannte Aktionsgrenze. Ein bestätigtes Discard invalidiert
  die alte Session und ihre Fortsetzungen atomar mit dem erfolgreichen Wechsel
  beziehungsweise Schließen. Beim Öffnen wird die Ersatzdatei zuvor vollständig
  validiert; ein fehlgeschlagener Wechsel erhält alte Session und angenommene
  Restarbeit. Cancel lässt sie ebenfalls bestehen. Späte Ergebnisse einer
  verlassenen Session dürfen niemals das neue Dokument verändern.
  Fehlerhafte Dateien, unbekannte Versionen, ungültige Referenzen oder beschädigte
  Payloads werden atomar abgelehnt. Aktives Dokument und Quelldatei bleiben erhalten.

### A08 — Fachkerne nach Integrationsaufwand und Nachweis wählen

Aktive Quellen, Gesten, History und der häufig aufgerufene Surface-Sampler liegen
im gemeinsamen TypeScript-Kern. Direkte Bearbeitung darf keine synchrone native
Anfrage pro Sample benötigen. Für aufwendige oder klar abgegrenzte Fachberechnungen
ist die Sprache eine Implementierungsentscheidung, kein Abnahmekriterium.

Den hauslokalen Solver aus `src-tauri/src/interior/` und geeignete reine Teile von
Straßen-, Bebauungs- und Gewässerberechnungen vor ihrem jeweiligen Fachpaket kurz
prüfen. Bevorzugt in den gemeinsamen TypeScript-Pfad übernehmen. Ein vorhandener
Rust-Kern darf stattdessen isoliert weiterverwendet werden, wenn alle Bedingungen
erfüllt sind:

1. Er erhält begrenzte unveränderliche Eingaben und liefert reine Ergebnisse oder
   Vorschläge. Er besitzt weder Dokumentzustand noch History, Persistenz oder eine
   eigene Commitgrenze. Der Innenraumsolver bleibt hauslokal und unabhängig von
   SQL, Kamera, Weltkoordinaten und Desktoprahmen.
2. Adapter, Versionierung, Fehlerbehandlung, Paketbau und reale Tests sind zusammen
   konkret einfacher als ein Port, oder ein gemessener Vorteil wird für ein
   verbindliches Ziel benötigt. Vorhandene Codezeilen allein reichen als Grund nicht.
3. Vorschau und Übernahme verwenden denselben Kern und dieselbe Fachmathematik.
   Die gemeinsamen Quellen-/Oberflächenverträge, Abbruch-/Stale-Regeln und Budgets
   gelten auch über die Sprachgrenze. Keine unabhängige zweite Terrainlösung.
4. Verhaltenstests und neue Desktop-/Lastfälle prüfen den tatsächlich ausgelieferten
   Pfad einschließlich seines Adapters. Ein isolierter Rust-Test allein genügt nicht.

Die Wahl mit den betroffenen Modulen im vorhandenen Status festhalten. Ein
übernommener Kern braucht keinen zusätzlichen vollständigen TypeScript-Port.
Ein Port darf den alten Kern vorübergehend für isolierte Referenzfälle nutzen;
danach dessen ungenutzte Kopie entfernen. Ein zweiter autoritativer Dokumentserver
ist in beiden Varianten ausgeschlossen.

Für Polygon-Union, Difference, Intersection und Buffer im TypeScript-Pfad JSTS
hinter einem kleinen Adapter verwenden; RBush dient der aktiven räumlichen Suche.
Ein nach obigen Kriterien übernommener Kern darf seine bewährte Geometriebibliothek
behalten. Lokale Ursprungsverschiebung, Toleranzen, Ringkanonisierung und Kollisions-
verträge aus den vorhandenen Parzellen-/Regionstests gelten unabhängig davon.
Keine konkurrierenden Vorschau-/Commitberechnungen desselben Vorgangs und keine
eigene allgemeine Geometrieengine oder neues Plugin-/ECS-Framework bauen.

Aufwendige Fachaufrufe laufen als versionierte Hintergrundaufgaben. Seed und Rezept
bestimmen reproduzierbare Ergebnisse; bestehende Häuser werden durch neue Varianten
nicht neu gewürfelt. Die Innenraumfälle für Identitäten, Raumteilung/-vereinigung,
Türen und Treppen bleiben vollständig erhalten.

### A09 — Budgets und Überlastverhalten

Ressourcenstartwerte und feste Grenzen zentral unter `src/editor/budgets.ts`
definieren und messen:

| Ressource                   | Budget / Regel                                                                                                                                                                                                   | Verbindlichkeit                                     |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| CPU-Quellenarbeitsmenge     | 256 MiB einschließlich gehaltenem Bearbeitungsrand; gesonderte Zählung noch nicht bestätigter Patches                                                                                                            | Ressourcenstartwert                                 |
| CPU-Darstellungen           | 128 MiB einschließlich laufender Resultate; keine zweite unbegrenzte Kopie neben dem Cache                                                                                                                       | Ressourcenstartwert                                 |
| GPU-Texturen/Geometrie      | 256 MiB, einschließlich alter noch gezeichneter und neuer hochgeladener Ressourcen                                                                                                                               | Ressourcenstartwert                                 |
| History im RAM              | 128 MiB, zusätzlich maximal 100 Aktionen; größere erlaubte Deltas in temporärer Ablage                                                                                                                           | RAM: Ressourcenstartwert; Aktionszahl: feste Grenze |
| Ausstehende Schreibdaten    | 32 MiB; vor weiterer ungesicherter Annahme begrenzen, keine Daten verlieren                                                                                                                                      | Ressourcenstartwert                                 |
| Rechenjobs                  | höchstens zwei aktiv; kurze lokale Arbeit nach A06 auch bei ausgelasteten Workern ermöglichen; maximale nicht unterbrechbare Zeit in P0d/P3 festlegen und messen                                                 | Feste Grenze                                        |
| CPU-Vorbereitung            | höchstens 2 ms je RAF als Teil des gesamten p95-Ziels von 8 ms für Eingabe und Framevorbereitung; Prüfung vor jeder kleinen Arbeitseinheit                                                                       | Feste Grenze                                        |
| Texturupload                | höchstens 4 MiB je Frame; nur Quellen des eingefrorenen Renderstands                                                                                                                                             | Ressourcenstartwert                                 |
| Grafikarbeit                | genau ein eingefrorener Renderstand plus ein zusammengeführter neuester Wunsch; höchstens zwei unquittierte GL-Einreichungen nach A06                                                                            | Feste Zustandsgrenzen                               |
| Lokale unquittierte Wirkung | höchstens 50 ms × Betrag der fixierten Höhenrate je Stützstelle, einschließlich angenommener noch nicht angewandter Beiträge; konservativ gröbere Belege sind zulässig, wenn der gewählte Kandidat sie nachweist | Feste fachliche Grenze                              |
| Landschaftssymbole          | höchstens 16.384 Kandidaten einschließlich Überblendung/Rand                                                                                                                                                     | Ressourcenstartwert                                 |
| Beschriftung                | höchstens 3.000 priorisierte Kandidaten, 500 sichtbare kollisionsfreie Labels                                                                                                                                    | Ressourcenstartwert                                 |

Nur die ausdrücklich als Ressourcenstartwert markierten Speicher- und
Mengenbudgets dürfen in P3/P9 aufgrund dokumentierter Messungen angepasst werden;
bis dahin gelten die genannten Obergrenzen. Die Anpassung darf weder globale
Verarbeitung noch unbeschränkte Reserven einführen. Alle übrigen fachlichen,
zeitlichen und festen Zustandsgrenzen dieses Plans bleiben verbindlich:
insbesondere normale Referenzwirkung, 20-/50-ms-Abnahme, CPU-/GPU-Zeitziele,
lokale Wirkungsschranke und die Zahl gleichzeitig gehaltener Zustände und Jobs.
Ein größeres Ressourcenbudget ersetzt keinen positiven Leistungsnachweis.
Aktive Referenzen, Patches, Workerinputs und Übergangstexturen mitzählen.
Speicherdruck reduziert Darstellung oder Vorladen; er darf niemals Autoren
stillschweigend löschen oder eine angenommene Geste verkürzen.
Das Schreibbudget ist ein Backlogbudget, kein neues fachliches Aktionslimit.
Größere erlaubte atomare Aktionen werden begrenzt in der temporären Ablage
vorbereitet. Sie dürfen bei leerer Queue nicht endlos auf ein unerreichbares
freies Budget warten und werden nicht in sichtbare Teilcommits zerlegt.

Die vorhandenen fachlichen Aktionsgrenzen sind zunächst beizubehalten, soweit
der neue Auflösungs-/Patchvertrag sie sinnvoll abbildet. Ein darstellungsbedingtes
Budget darf keine feineren Autoren überschreiben. Überladene exakte Bereiche
fordern verständlich engeren Ausschnitt oder eine ausdrückliche größere Aufgabe.

### A10 — Zielpfade und endgültige Ablösung

Die folgenden Pfade beschreiben den bevorzugten TypeScript-/Electron-Aufbau.
Nur Module mit tatsächlicher Verantwortung schaffen. Kleine reine Hilfen sind
zulässig; zusätzliche Manager oder Hüllen allein wegen einer langen Datei nicht.
`EditorController` ist der Eingabe- und Lebensdauerbesitzer aus A01. Er koordiniert
Dokument, Darstellung, Projektsitzung und die gemeinsame Rechenjobzulassung nach
A06; `jobs/` ist bei Bedarf seine kleine Ausführungshilfe. Autoren sowie Schreib-
und Dateizustand bleiben bei deren Besitzern.
Eine nach A01/A08 bestätigte Abweichung benennt ihre konkreten wenigen Modulpfade
im Status und passt diese Tabelle an; sie erzeugt keine parallele Implementierung.

| Zielpfad                                                 | Inhalt                                                                                                                 |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `src/editor/model/`                                      | Koordinaten, Quellen, Objekte, Surface-Sampler, Änderungen, History und gemeinsame Typen                               |
| `src/editor/tools/`                                      | Gesten und Fachoperationen; eine gemeinsame Übernahmegrenze                                                            |
| `src/editor/render/`                                     | Pixi-Kamera, aktive Szene, Kacheln, Geometrie, Labels und Werkzeuganzeigen                                             |
| `src/editor/jobs/`                                       | Versionierte Aufgaben, Scheduler und reine Worker-Einstiege                                                            |
| `src/editor/ui/`                                         | React-Panels und Verbindung zum Editor; vorhandene passende UI übernehmen                                              |
| `src/interior/`                                          | Reiner lokaler Innenraumsolver mit Verhaltenstests bei TypeScript-Port; sonst schmaler Adapter zum isolierten Fachkern |
| `desktop/`                                               | Electron Main/Preload, Store-Utility-Prozess, Dateiabläufe, Buildanbindung                                             |
| `tests/product/`, `tests/desktop/`, `tests/performance/` | Verhaltens-, echte Desktop- und Leistungsszenarien                                                                     |
| `scripts/atlas-performance.mjs`                          | Reproduzierbarer Referenzrunner mit fehlerschließendem Ergebnis                                                        |

Dies sind gezielte Modulgruppen, keine Aufforderung für jede Tabellenzeile eine
generische Abstraktionsschicht zu bauen. Am Ende startet `src/main.tsx` den neuen
Editor. Der alte Rust-Dokumentworker, ersetzte `src/atlas/`-Pfade, Transporttypen,
JSONL-Testbridge und Buildpfade entfallen, soweit ihre Verbraucher ersetzt sind.
Tauri entfällt beim bestätigten Electron-Aufbau; ein bewusst gewählter anderer
Host und nach A08 tatsächlich genutzte Rust-Fachmodule behalten ihre notwendigen
Build-/Paket-/Prüfpfade. Keine ungenutzte alte Dokumentlaufzeit mitführen.
Kein dauerhaftes `old/new`-Flag, kein zusätzlicher Produktionsweg und keine
Prüfungen gegen ungenutzte Software im Gesamtgate.

## 4. Verbindliche Funktionsmatrix

Die Abschnitte des [Produktvertrags am Ausgangsstand](https://github.com/ThonkTank/Salt-Marcher/blob/1bb3932fcffcb2d5fea47fae616c3b69489443bc/docs/product-contract.md)
enthalten die detaillierten Fachfälle. F01–F19 werden über die Pakete verteilt;
D01–D11 überschreiben nur ihre ausdrücklich genannten Punkte. Pfade in der
Tabelle sind **Istanker**, keine Vorgabe, die alte Architektur zu erhalten.

| ID  | Pflichtumfang                                                                                                                                                               | Istanker / vorhandene Verhaltenstests                                                                                                                                 | Paket  |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| F01 | Zeigerverankerter freier Zoom, Pan, Fit, Doppelklick, Weltgrenzen, erhaltener Kartenmittelpunkt bei Panels/Resize und Klickanker bei Auswahl                                | `src/atlas/useCamera.ts`, `lod.ts`; `lod-navigation`, `navigation-readiness`, `house-lod`, `street-lod`                                                               | P3     |
| F02 | 14 Ansichten, LOD-Hysterese, Außen-/Haus-/Parzellenkontext, leere Grundstücke, explizites Innenöffnen, Keller/Geschosse, Rückkehr nach Ownerlöschung                        | `editorView.ts`, `editorSelection.ts`; `room-lod`, `parcel-lod`, `interior-layers`, `world-lod`                                                                       | P3, P6 |
| F03 | Kartenwahl/Objektliste, Kontextinspector, Griffpriorität, exakte gewählte Objekte, Zahlenfelder beim ersten Kartenklick, lokale Feldtasten, Fehler/Modals/Fokus bei 900×620 | `AtlasApp.tsx`, `Inspector.tsx`, `Fields.tsx`, `src/Modal.tsx`; `interaction`, `planning-actions`, `modals`, `name-validation`                                        | P3, P8 |
| F04 | Bildschirmgrößen 8–512 px, Größenkurzbefehle, fixierter Weltradius, getrennte Stärke/Deckkraft, Abbruch und verständliche Limits ohne stille Kürzung                        | `useCanvasInput.ts`, `interaction.ts`; `room-lod`, `terrain-live`, `ground`, `landscape`, `water`                                                                     | P3, P4 |
| F05 | Land/Meer, Anheben/Absenken/Glätten/Einebnen, runde/kräuselige Küsten, Bergkette/Hügel/Schlucht mit realen Vorlagen, Höhenlinien/Cursorhöhe                                 | `featureBrush.ts`, `src-tauri/src/atlas/terrain.rs`; `terrain`, `terrain-live`, `terrain-features`, `terrain-coast`                                                   | P4     |
| F06 | Getrennte Boden-/Felsfarbe, weich/hart/wolkig, zeitlicher Farbfluss, Deckkraft, Halten, Pipette, Radierer, Vorlagen; Fels/Schnee und nahtlose Kacheln                       | `GroundControls.tsx`, `src-tauri/src/atlas/ground.rs`; `ground`, `terrain-materials`                                                                                  | P4     |
| F07 | Wald/Buschland/Wiese/Felsgebiet, Zieldichte, Lichtung, stabile Kandidaten, Flächen/Kronendach/Nahsymbole ohne Leerband, Wasser maskiert ohne Quellenverlust                 | `landscapeView.ts`, `landscapeLod.ts`, `forestCanopy.ts`; `landscape`, relevante aktive Fälle aus `scenery`, `presentation-stability`                                 | P4     |
| F08 | Straßenbreite/-material/-name, kubische Nodes/Griffe, Einfügen/Löschen/Bewegen, beide Enden verlängern, stabile Sections, Rauheit/Variation und Entwurfserhalt              | `roadDraft.ts`, `roadGeometry.ts`, `RoughnessControls.tsx`; `roads`, `overview-roads`, `planning-actions`                                                             | P5     |
| F09 | Gelände folgen bei Neu/Verlängern, Toleranz, feste Endpunkte, Wasser-/Hangkosten, begrenzte deterministische Suche, bestehende Teile erhalten                               | `src-tauri/src/atlas/road_terrain.rs`; `terrain-road`, Rust-Fachfälle                                                                                                 | P5, P7 |
| F10 | Keine/Nur Parzellen/Parzellen+Häuser, Seiten, Seed/Variante, Größen/Abstände, endliche Budgets/Diagnosen, idempotentes Populate, atomarer Verbund                           | `PopulationPanel.tsx`, `src-tauri/src/atlas/population.rs`; `road-planning`, `roads`, Rust-Fachfälle                                                                  | P5     |
| F11 | Einzelne Vorschläge per Griff/Feld ändern, auslassen/wieder einschalten, Aufteilung neu erzeugen, Nachbarn unverändert, Bestandsparzelle ändern/herauslösen                 | `ParcelProperties.tsx`, `parcelPlanning.ts`, `parcelEditor.ts`; `road-planning`, `parcels`, `parcel-lod`                                                              | P5     |
| F12 | Freie/gebundene Häuser, Name/Dachfarbe/Wichtiger Ort/Fundament, freie bzw. rastergebundene Pose, Ownererhalt, Containment/Kollision und Löschkaskaden                       | `Inspector.tsx`, `workflowOperations.ts`; `editor`, `parcels`, `paint-and-navigation`, `terrain`                                                                      | P5, P6 |
| F13 | Räume zeichnen/radieren/zuweisen/benennen/bewegen, Merge/Split-Identitäten, Selbstüberlappung, getrennte Gruppen, untere Geschosse und Raumlisten                           | `src-tauri/src/interior/room_edit.rs`; `room-movement`, `interior-layers`, `rotated-tiles`, `room-lod`                                                                | P6     |
| F14 | Außen-/Innentüren, Durchgänge, Umwandeln/Löschen, halbe Öffnungspositionen, Verbindungsbereinigung; Treppen 2–64 Zellen und benachbarte Geschosse                           | `src-tauri/src/interior/connection_edit.rs`, `src-tauri/src/interior/stair_geometry.rs`; `interior-connections`, `stairs`, `editor`                                   | P6     |
| F15 | Kategorien/Ränge/Regionen, Malen/Radieren, Löcher/Teilflächen/leere Namen, ranggleiche Gebietsübertragung, geometrische N:N-Beziehungen, Stile/Labels/Ortssymbole           | `RegionPanel.tsx`, `src-tauri/src/atlas/regions.rs`; `regions`, `presentation-stability`                                                                              | P8     |
| F16 | Flüsse zeichnen/bearbeiten/verlängern, Namen/Breiten/Richtung/Mäander, Snapping/gemeinsame Nodes, Zuflüsse ohne Zyklen/Teilungen und Einschnittanzeigen                     | `RiverPanel.tsx`, `src-tauri/src/atlas/rivers.rs`; `rivers`, Rust-Flussfälle                                                                                          | P7     |
| F17 | Nicht ansteigende Profile, Seepegel/Einmündungen/Rückstau/Betten; Seenpinsel mit Absenkung/Ufer/Vereinigung/Inseln und gemeinsamer Höhenaktion; D03-Nachführung             | `src-tauri/src/atlas/water.rs`, `src-tauri/src/atlas/application/water_store.rs`, `src-tauri/src/atlas/application/river_store.rs`; `water`, `rivers`, `terrain`      | P7     |
| F18 | Fantasykartografie, Relief/Material-/Ebenenfolge, Bebauungsdichte, Dächer/Löcher, einfache Walmdächer, priorisierte lesbare Labels und Auswahl                              | `cityView.ts`, `houseRoof.ts`, `mapLabels.ts`, `mapTypography.ts`; `city-view`, `street-lod`, `paint-and-navigation`                                                  | P3, P8 |
| F19 | Neu/Open/Save/Save As/Close, Save/Discard/Cancel, Shortcuts, History pro Geste/Verbund, No-ops, sichere Dateien, stale Antworten, korrekte Offscreen-Löschzahlen            | `useDocumentSession.ts`, `documentQueue.ts`, `src-tauri/src/atlas/application/persistence.rs`; `input-and-files`, `document-queue`, `interaction-lifecycle`, `modals` | P2, P9 |

Testnamen ohne Pfad/Endung bezeichnen `tests/product/<name>.spec.ts`.
Unqualifizierte TypeScript-Dateinamen in dieser Tabelle liegen unter `src/atlas/`.
Für jede Zeile im jeweiligen Paket Umsetzungs- und Testpfade festhalten; kein
pauschales „Parität erledigt“ ohne diese Zuordnung.

### Unverzichtbare fachliche Randfälle

- Dachkonturen enthalten nur nichtnegative Geschosse; Belegung/Containment alle
  Geschosse einschließlich Keller. Reine Kellerhäuser haben kein Dach/Fundament.
  Nachbarhäuser behalten ihre Dächer bei geöffnetem Innenraum.
- Höchstens ein Hausowner je Parzelle. Haus löschen erhält die Parzelle;
  Parzelle löschen entfernt ihr Haus; Straße löschen entfernt nur gebundene
  Parzellen/Häuser. Herauslösen friert Rahmen und Polygon ein.
- Hausraster und Innenbytes bleiben bei Straßen-/Parzellenbewegung erhalten.
  Randberührung ist zulässig; echte Kollision/Containmentfehler sind atomar.
- Lokale Seen und Flüsse dürfen Häuser/Straßen überlagern und löschen sie nicht.
  Sie beeinflussen die geländefolgende Routenplanung. Die entfallenden manuellen
  Wasserpolygone bringen keine zweite Wasser-Kollisionsregel in den Neubau.
- Raum-/Verbindungsidentitäten, Namensvalidierung und Zähler sind Autoren.
  Fehler und No-ops dürfen sie nicht verbrauchen; Undo darf IDs nicht duplizieren.
- Geladene Darstellung, exakte Bearbeitungsquelle und dauerhaft gespeicherter
  Zustand sind getrennt. Auswahl darf niemals verkleinerte Geometrie verändern.
- Exakt entfernte Farbe/Landschaft ist ein Autor mit Maske. Undo muss einen
  vorher fehlenden Autor wieder wirklich entfernen, nicht mit Nullwert ersetzen.

## 5. Arbeitspakete und Abhängigkeiten

### Vorhandene Konsolidierung K1–K6

K1/K2 haben den gemeinsamen Dateilebenszyklus und die Fortsetzung nach
Schreibfehlern hergestellt. K4/K5 haben reale Desktop-/Paketprüfungen und
bereinigte Verträge ergänzt. K3 besitzt Referenzprofil und fehlerschließende
Vorprüfung; die tatsächliche Präsentationszuordnung bleibt offen. K6 hat
Zeitanteile getrennt, aber keine allgemeine Großpinsel-Lösung bewiesen.
Der genaue Prüf- und CI-Stand steht ausschließlich im [Status](status.md).
Diese abgeschlossenen Implementierungen bleiben erhalten; neue Befunde öffnen
nur ihre tatsächlich betroffenen Nachweise.

### P0-Fortsetzung: einfache Pinselreferenz, geordneter Abschluss, begrenztes Rendern

Dieser Restauftrag folgt aus den Gegenbefunden auf 96637b0 und der Recherche
aus Abschnitt 9: Restwegverlust trotz beim Up fertiger GPU, normale Rundungsreste
im CPU-Fallback, Vorbereitung außerhalb des Framebudgets und positive
Einzelmetriken trotz unvollständiger Bearbeitung. Die Vorbilder rechtfertigen
einen einfachen ersten Kandidaten, keine vorweggenommene Freigabe. Der aktuelle
Prüfstand bleibt im [Status](status.md).

#### C0 — Geprüfte, verworfene Ausgangsregel

C0 verbindet räumlich verteilte Stempel mit ausdrücklich definierter Zeitwirkung.
Ein Bogenlängenrest bleibt über Eingabe- und Framegrenzen erhalten. Es gibt
zunächst kein Konto vorausbezahlter Mindestwirkung je Stützstelle. Quellen,
angenommene Fortsetzung, Vorherbilder, History und persistierte Änderungen
gehören weiter dem EditorDocument; der Controller besitzt die Eingabeuhr.

Die vor der Integration fixierte C0-Referenz bleibt zur Reproduktion des
Gegenfalls erhalten. Ihre Ausgangspunkte waren:

1. Autorenstufe, Radius R, Richtung und Höhenrate r bleiben je Geste fest.
   Bestehenden quartischen Pinselverlauf und Klickimpuls P = 1/60 Sekunde als
   Stärkeanker erhalten. Stärke null bleibt ohne Wirkung.
2. Feste C0-Startregel: räumlicher Stempelabstand Δ = R/4, Zentrumsamplitude
   eines vollen Wegstempels r × P × Δ/R = r × P/4, multipliziert mit dem
   bestehenden Pinselprofil. Der Anfangsklick hat einmalig r × P. Dies sind
   eigene überprüfbare Produktfestlegungen, keine aus MyPaint übernommenen
   Leistungszusagen. Referenz und Toleranz stehen vor Integration fest;
   Rate, Amplitude oder Abtastweite werden nicht für einen grünen Zeitlauf
   abgeschwächt.
3. Stempelpositionen folgen der vollständigen Polylinie in Bogenlänge. Der
   Restabstand wird weitergetragen; neue Events, Coalescing und RAFs setzen ihn
   nicht zurück. Richtungswechsel bleiben Teil des Wegs. Beim Up wird nur die
   terminale Restlänge ℓ < Δ einmal am Endpunkt mit r × P × ℓ/R berücksichtigt;
   bei ℓ = 0 kein zusätzlicher Stempel. Eine Nullstrecke erzeugt nur den
   Anfangsklick und gegebenenfalls Zeitwirkung. Up ohne letztes Move ergänzt
   seine tatsächliche Strecke nach derselben Regel.
4. Die zusätzliche Zeitwirkung entspricht der Rate r und der kausalen
   Aufenthaltszeit im Pinselprofil. Bewegung und stationäres Halten rechnen
   ein Zeitintervall genau einmal ab. Neue Bewegungen werden vor weiterem
   Halten verarbeitet; nur noch nicht verbuchte Zeit wird verteilt.
   Bereits verbuchte Zeit wird durch verspätete Punkte weder doppelt erzeugt
   noch nachträglich an unbekannte Positionen versetzt.
5. R1 fixiert Eingabezeitnormalisierung, gleiche Zeitstempel, Ankunftsreihenfolge,
   Halteintervalle und Überlastkappung. Die Referenz wird unabhängig vom
   Produktionsintegrator aus den gelieferten Punkten, ihren Zeiten und der
   festgelegten kausalen Regel berechnet. Sie erhält auch das ungekappte normale
   Zeitangebot. Ein unvollständiger Kandidat darf sein Soll nicht selbst setzen.
6. Die Annahme prüft D11, fachliche Quellen, endliche Arbeitsreserve und die
   lokale Wirkungsschranke. Zurückgestellte oder begrenzte räumliche Arbeit
   wird gesondert ausgewiesen; ein Renderer-Fence darf die Geometrie nicht
   pauschal löschen. Normalfälle müssen die vollständige Weg-/Endpunktprüfung
   und beide unabhängigen Wirkungsprüfungen aus Abschnitt 6 bestehen.

Ein gemeinsamer, vom Kandidaten unabhängiger Stärkeanker verhindert eine
beliebig schwache Raumreferenz: In den manifestierten, nicht höhengeclippten
Spurproben muss jede vorher festgelegte Position auf der Wegmitte einschließlich
Endpunkt mindestens **50 % der Höhenwirkung eines isolierten Referenzklicks**
an dieser Position mit demselben Radius, Kernel und r × P erreichen.
Diese Mindestwirkung gilt auch für die begrenzten GPU-/UI-Gegenabläufe.
Die Referenzklicks werden separat auf dem Ausgangsterrain analytisch bestimmt;
fachliche Nullfälle sind ausgeschlossen. R1 muss diesen Wert und die exakte
C0-Referenz gemeinsam prüfen. Ein C1 bekommt keinen kleineren Stärkeanker.

Wiederholtes Überfahren erzeugt bei C0 erneut Wegwirkung; diese Ausgangsannahme
wird durch die unten begründete C1-Auswahl ersetzt. Stationäres Halten und dieselbe langsamer durchlaufene Bahn müssen
zusätzliche Zeitwirkung liefern. Der reine Weganteil allein genügt nicht als
normaler Erfolg. Batchinvarianz gilt für dieselbe normalisierte Folge von
Geometrie- und Zeitbeiträgen. Bei anderer Zustellung noch unbekannter Bewegung
muss die festgelegte kausale Regel die Abweichung erklären; sie darf keine
Ereignisse verlieren oder ihre normale Schwäche durch Kappung unsichtbar machen.

#### Lokale Wirkungsgrenze unabhängig vom Dosierungsmodell

Die Grenze bleibt B = r × 0,05 Sekunden je Stützstelle und fester Gestenrichtung.
Sie zählt gemeinsam:

- bereits angewandte Wirkung seit dem passenden lokalen GPU-Receipt;
- angenommene und reservierte Wirkung, die noch nicht in den Quellen steht.

Ein nicht ausgeführter Auftrag ist keine kostenlose Reserve. Vor seiner Annahme
muss eine konservative Schranke seiner Wirkung feststehen. Quellenmaterialisierung
verbraucht diese Reserve, statt dieselbe Wirkung zweimal zu zählen. Verfallene
Zeit wird nicht als künftiger Auftrag gespeichert. Bei positiver normierter
Splineprojektion begrenzt eine nachgewiesene Schranke je Stützstelle auch den
rekonstruierten Höhenzuwachs; R1 belegt diese Voraussetzung für den gewählten
C1 unabhängig von dessen Dosierungsformel.

R1 verwendet genaue Reservierungen und Rückmeldewerte je Stützstelle mit
exakter Versionsbindung. R2 bindet diese Belege an die tatsächlichen Quellen
und Renderstände. Ein gesättigter Bereich darf keinen örtlich zulässigen Weg
anderswo unterdrücken. Eine spätere Vereinfachung der Belegform muss dieselbe
Garantie erhalten; sie ändert nicht die gewählte C1-Dosierungsregel.
Höchstens 32 MiB für Wirkung-/Reservierungsbelege plus 256 KiB Masken;
alle physischen Puffer zählen zusätzlich zum vorhandenen CPU-Gesamtbudget.
Eine Geste bleibt auf höchstens 512 Autorenkacheln und die vorhandenen Zellgrenzen
begrenzt. Diese Höchstwerte ersetzen keine Prüfung kurzer CPU-Arbeitsschritte.

Ein Receipt bestätigt ausschließlich den eingefrorenen Stand R und dessen
vollständige sichtbare Einflussmenge nach A06. Er darf älter als Liveautoren
sein, bestätigt aber niemals deren neueren Stand. Falsche Session, Ansicht,
Vorbereitung oder bereits überholte lokale Version schaffen keine zusätzliche
Wirkungsreserve. Teilquittungen brauchen Belege ihres genauen Bereichs.
Ein Receipt ändert keine Autoren und erzeugt keine Dosis. Bestehende Belege
werden begrenzt ersetzt; keine anwachsende Sammlung historischer Quellstände.
Die vollständige Quellenwirkung eines am Fensterrand sichtbaren Pinsels umfasst
auch seinen notwendigen unsichtbaren Rand; vollständig außerhalb wird nicht gemalt.

Neue Gesten brauchen eine aktuelle lokale Grundlage. Innerhalb der Geste gelten
die bestätigte Grundlage und eigene kontrollierte Änderungen. Für neu betretene
Flächen bleiben vollständige Quellen und D11 nötig. Bereits angenommene Arbeit
hält ihre geprüften Eingaben gepinnt; neue unbekannte Daten oder fremde Änderungen
dürfen nicht als Ersatzgrundlage verwendet werden. Kontext-/Ansichtswechsel
stoppen neue Annahme. Angenommene Arbeit und ihre Darstellung werden anschließend
nach den Abschluss-/Sessionregeln behandelt, nicht stillschweigend verworfen.

Die numerische 50-ms-Wirkungsgrenze bezieht sich auf den GPU-quittierten Stand.
Die Zeit bis zur tatsächlichen Anzeige wird getrennt nativ geprüft. Aus der
bloßen Existenz einer Queue, eines Fences oder eines Vorbilds folgt weder diese
Schranke noch das 50-ms-Latenzziel.

#### C1 — Ein begründeter Gegenkandidat und Auswahl für R2

**Fixierter C0-Gegenfall:** Radius 20 Fuß, Rate 1 Fuß/s, Autorenstufe 0;
A=(20,20), B=(60,20), Eingaben A bei 0 ms → B bei 20 ms → A bei 40 ms → Up
bei B nach 70 ms. Die GPU quittiert erst bei 200 ms. A, B und der Prüfpunkt
(40,20) liegen in derselben Autorenkachel. Es sind vier Punkte, keine
Kapazitätsausnahme. Am Mittelpunkt verlangt schon die vollständige reine
C0-Wegwirkung `0,0533203125`, während angewandte plus reservierte Wirkung
höchstens `0,05` betragen darf. Selbst vollständiger Zeitverfall, feinere Belege
oder spätere Materialisierung lösen diesen Widerspruch nicht. Dies ist der vor
dem C1-Vergleich benannte Pflichtfehler; der Fall wird nicht nachträglich verkürzt.

**Gewählte C1-Regel:** Für eine Stützstelle i sind die nichtnegativen Beträge
`F_i = |r| × P × max(K_i(p))` über die vollständige gelieferte Polylinie und
`T_i` die kumulierte angenommene kausale Zeitwirkung. Es gilt
`V_i = max(F_i, T_i)`; das feste Vorzeichen wird erst auf den Autorenbeitrag
angewandt. K ist weiterhin der quartische Kernel, P weiterhin 1/60 Sekunde.
Das Maximum entlang eines geraden Teilstücks liegt an dessen nächstem Punkt
zur Stützstelle. Ecken, Endpunkt und Wiederbesuche bleiben Teil der Geometrie;
eine expandierte Liste räumlicher Stempel entfällt. Der Anfangsklick ist Teil
von F. Nur Zeitwirkung oberhalb von F erzeugt weiteren Höhenauftrag.

Eine neue räumliche Mindestwirkung passt immer in die örtliche Reserve:
Unquittierte einschließlich reservierter Wirkung U ist höchstens der kumulierte
Gestenbeitrag V. Für ein neues F' gilt F' ≤ |r|P < B. Ist V ≥ F', benötigt die
Geometrie keine weitere Wirkung. Sonst gilt U + F' − V ≤ F' < B. Diese Aussage
setzt monotone Gestenkonten voraus: Receipts setzen F/T niemals zurück.
Zeit wird dagegen vor Annahme auf den verfügbaren örtlichen Rest begrenzt;
verfallene Zeit wird ausdrücklich ausgewiesen und bei späterer Quittung nicht
nachgeholt. Materialisierung verbraucht dieselbe Reserve, statt neu zu buchen.

**Unabhängige Referenz und feste Eingaberegel:**

- Eingabezeiten liegen auf der monotonen Browseruhr; epochbasierte Zeitstempel
  werden einmal um `performance.timeOrigin` versetzt. Nichtendliche, zukünftige,
  doppelt erfasste oder geometrisch rückwärts geordnete Eingaben werden vor
  Mutation abgewiesen. Die fortlaufende Erfassungsnummer unterscheidet auch
  Punkte mit gleichem Zeitstempel. Coalescing liefert entweder Einzelpunkte
  oder das zusammenfassende Ereignis, nie beides.
- Neue Geometrie wird vor weiterem Halten verarbeitet. Für eine Gruppe gleicher
  Zeitstempel wird nur noch unverbuchte Zeit nach Teilstreckenlänge verteilt;
  bei Nullstrecke liegt sie am letzten Punkt. Die gemeinsame Uhr T läuft über
  verworfene Zeit hinweg weiter. Geometrie hinter T bleibt erhalten, erzeugt
  aber keine neue vergangene Zeit. Das terminale Fenster enthält als letzten
  Punkt das tatsächliche Up-Sample, auch bei unveränderter Position. Up verwendet
  dessen Ereigniszeitpunkt, nicht die spätere Handlerankunft, und dreht T niemals
  zurück. Ein terminales Fenster ohne Up-Sample ist ungültig.
- Je beobachtetem Fenster bleiben höchstens 50 ms proportional verteilter
  Zeitauftrag. Die Normalreferenz erhält zusätzlich das **ungekappte** Angebot.
  Die örtliche Begrenzung zählt schon angenommene Restarbeit mit. 127 offene
  Punkte lassen den 128. Platz für Up frei; ein terminales Fenster erlaubt
  genau 128. R2 bindet die gemeinsame wartende Menge an diese Grenze.
- `scripts/atlas-p0-brush-reference.mjs` berechnet Sollwerte ausschließlich aus
  Rohpunkten und beobachteten Zeitfenstern. Es importiert keinen Produktcode.
  Manifest und Prüfpositionen sind vor dem Kandidatenlauf festgelegt und gegen
  Veränderung geschützt; auch die Referenzergebnisse stehen vor dessen Ausführung fest.
  Eine kreisbeschnittene Drei-Punkt-Gaußintegration und eine getrennte kubische
  Basis prüfen die produktive Quartikintegration und Rekonstruktion unabhängig.
  Absolute Toleranz `1e-10` Fuß plus relative Toleranz `1e-9` sind vorab fest;
  die Darstellungstoleranz bleibt separat unverändert.
- Der Auswerter prüft den gesamten manifestierten Weg einschließlich Außenproben,
  jede Region und jedes vollständige Einsekundenfenster. `timeAccount` enthält
  auch bereits vorausbezahlte Zeit; `max(F,T)` wird vor der Splineprojektion
  ausgewertet. Ein Fenster erhält nicht erneut denselben Mindestvorschuss.
  Geometrie gehört erst ab dem verbuchten Ende ihres gelieferten Fensters zu
  einem kumulierten Prüfstand; späte Punkte werden nicht rückwirkend auf frühere
  Prüfstände projiziert. Ein später terminaler Beitrag bei derselben Uhr ergänzt
  deren endgültigen Stand. Diese Buchungsgrenze ist kein Präsentationszeitpunkt.
  Fehlende Mitte, Ecke, Endpunkt, Zeit, Fenster oder Proben sowie zu schwache,
  zu starke und gegenläufige Ergebnisse müssen das gemeinsame Inhaltsurteil
  scheitern lassen. Der 50-%-Klickanker bleibt zusätzlich bestehen.

**Kosten und Integrationsgrenze:** `PrepaidBrush` hält zwei Float64-Konten je
berührbarer Stützstelle; bei 100.000 Stellen zusammen 1.600.000 Byte. Zusammen
mit den Reservierungs-/Receiptpuffern gilt weiterhin das Maximum von 32 MiB;
Masken werden nicht benötigt. `BrushReservations` hält höchstens 512
Kachelindizes, 100.000 Stellen, 128 Reservierungen und zwei eingefrorene Belege.
Diese Grenzen sind gezählte Puffer und Strukturgrenzen, keine Messung des
vollständigen JavaScript-Heaps oder der Laufzeit. R2 muss Annahme und
Terminalreserve vor Handler-Rückkehr innerhalb des CPU-Budgets nachweisen;
R3/R4 müssen Renderarbeit, Ergebnistakt und Hardwarekosten belegen. Auch die
kurze zeitliche Plateauphase des vorausbezahlten Anfangs bleibt Gegenstand der
unveränderten 20-/50-ms-Abnahme.

Der verworfene C0 bleibt nur als unabhängige negative Inhaltsreferenz erhalten,
nicht als zweiter Produktpfad. Der aktive P0-Editor verwendet C1. Die
Controller-, Datei- und Lifecycleprüfungen wurden zusammen mit der Integration
umgestellt; die unabhängige Inhaltsreferenz und ihre Schwellen bleiben erhalten.

#### Aufnahme, Zeitkonto und geordneter Abschluss

Der Lebenszyklus unterscheidet fünf beobachtbare Grenzen:

| Grenze        | Bedeutung                                                                                                                                       |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Erfasst       | Ein echter Punkt mit Zeitstempel ist eingetroffen; noch keine Annahmezusage.                                                                    |
| Angenommen    | Geometrie-/Zeitbeitrag hat D11, Quellenprüfung und Arbeits-/Wirkungsreserve passiert. Er wird nicht später als gewöhnlicher Überlauf verworfen. |
| Angewandt     | Die Livequellen enthalten diesen Beitrag.                                                                                                       |
| Abgeschlossen | Sämtliche angenommenen Beiträge der versiegelten Geste sind übernommen; genau eine History-/Persistenzaktion ist vollständig.                   |
| Dargestellt   | Der entsprechende Inhalt ist gezeichnet; GPU-Abschluss und tatsächliche Präsentation bleiben separate Belege.                                   |

Pointer-Moves erfassen die tatsächliche zeitgestempelte Polylinie einschließlich
Coalesced-Events. Entweder deren Einzelpunkte oder das zusammenfassende Ereignis
verwenden, nicht beide. Vorhersagepunkte sind keine angenommenen Autorenbefehle.
Pro RAF folgt höchstens ein gemeinsamer Integrationsbatch in kurzen Arbeitseinheiten;
ein Pinselbatch kopiert jede betroffene Quellkachel höchstens einmal.
Eingabehandler starten weder GPU-Komposition noch SQL-Aufträge.

Ein gemeinsamer Abrechnungszeitpunkt T verhindert doppelte Zeitverbuchung durch
Move, Halten und Up. Für ein überlastetes Annahmefenster mit Teilzeiten d_j gilt
weiter d'_j = d_j × min(1, 50 ms / Summe(d_j)). Die Uhr rückt auch über verfallene
Zeit vor. Normale Wirkung wird zusätzlich gegen das ungekappte Zeitangebot
bewertet; langsame Ausführung darf das Soll nicht selbst verkleinern.
Gleiche Zeitstempel erhalten ihre Geometrie, erzeugen aber keine zusätzliche Zeit.
Noch nicht verbrauchte Zeit einer solchen Gruppe wird nach Bogenlänge verteilt;
bei Nullstrecke wirkt sie am letzten Punkt. Verspätete Punkte hinter T können
Wegwirkung liefern. T wird nicht zurückgesetzt. Nicht mehr eindeutig geordnet
zuordenbare Eingaben beenden die Geste sichtbar; innerhalb eines unverarbeiteten
Coalesced-Batches Zeit- und Erfassungsreihenfolge erhalten.

**Normaler Abschluss:** Up ergänzt seinen gültigen Endpunkt, auch ohne letztes
Move, und versiegelt die endliche Eingabe samt Originalzeiten, festen Parametern
und letztem angenommenem Beitrag. Spätestens bei Rückkehr aus dem Up-Handler
stehen alle terminalen Beiträge einschließlich Endpunkt samt konservativer
Arbeits-, Speicher- und Wirkungsreserve fest. Diese Prüfung muss selbst im
CPU-Budget bleiben; eine endliche Punktzahl allein belegt das nicht.
Sie darf weder auf späteres freies Grafikbudget noch auf eine spätere
CPU-Prüfung verschoben werden. Vollständige Quellenmaterialisierung muss dagegen
nicht im Up-Handler stattfinden. Eine Fortsetzung derselben Dokumentgeste
arbeitet ausschließlich die bereits reservierten Beiträge ab. Keine Callbackzeit,
neue Rückmeldung oder spätere Freigabe erzeugt zusätzlichen Auftrag. Der Zustand
ist dabei als abschließend erkennbar, ohne Kamera oder unabhängige Reads zu blockieren.
Das Ende dieser Fortsetzung finalisiert genau einen Undo-Schritt.

Undo/Redo, Save und nachfolgende Mutationen passieren die eine Abschlussbarriere
nach A07. Save nach Up enthält den vollständigen Strich; Undo nimmt ihn vollständig
zurück. Ein neuer Strich beginnt erst nach dieser Barriere und eigener D11-Freigabe;
ein währenddessen abgewiesener Druck wird nicht später automatisch gestartet.
Das ist keine Ausnahme für normale Leistungsfälle: führen solche Wartezustände
dort zu fehlender Wirkung oder verfehlten Zeiten, ist der Kandidat rot.
Nach Abschluss ändern verspätete RAFs, Receipts und Workerresultate diese Aktion
nicht mehr. Späteres Escape/Blur hebt eine bereits versiegelte Aktion nicht auf.

**Abbruch vor Up:** Bei Höhe beenden Escape, Blur und Pointercancel neue Wirkung.
Bereits angenommene Beiträge werden im selben begrenzten Abschluss zu einem
Undo-Schritt erhalten; nur noch nicht angenommene Eingaben verfallen.
Für abbrechbare Boden-/Landschafts-/Region-/Gewässergesten bleibt die Rücknahme
auf Vorherwerte nach A05 erhalten; ihre Fortsetzung wird invalidiert.
Ein bestätigtes Session-Discard invalidiert alte Fortsetzungen erst mit dem
erfolgreichen Wechsel/Schließen nach A07; ein fehlgeschlagenes Open erhält sie.

**Endliche Arbeitsgrenze:** Höchstens 128 noch nicht abgearbeitete Punkte
einschließlich versiegelter Restarbeit und reserviertem Endpunktplatz; keine
zweite unbegrenzte Liste expandierter Stempel. Fortschritt entlang der Spur erlaubt
eine begrenzte schrittweise Enumeration. Quelle, Arbeit und Effekt werden vor
Annahme reserviert, kleine Quellenupdates bleiben atomar.
Lange diagonale Segmente enumerieren ihre Pinselspur statt eines riesigen
Boundingrechtecks. Nur geometrie- und zeitgleiche Zusammenfassung ist verlustfrei.
Ein echter Kapazitätsüberlauf beendet die Geste sichtbar vor dem betroffenen
Abschnitt; angenommener Inhalt bleibt vollständig erhalten.
Alle normalen Pflichtverläufe und die ausdrücklich begrenzten Überlastpfade
müssen ihre vollständige räumliche Wirkung erhalten. Blockiert ein zu grober
Wirkungsbeleg darin einen örtlich zulässigen Abschnitt, ist das ein Fehler der
Belegform innerhalb des Kandidaten, kein Anlass für einen weiteren Dosierungskandidaten. Er darf
nicht als Kapazitätsausnahme umbenannt werden. Die sichtbare Ausnahme
gilt für die gesonderten Fälle jenseits des vorher manifestierten Umfangs.
Eine unbegrenzte Eingabemenge bei dauerhaft blockierter GPU ist keine zugesagte
Arbeitslast.

#### Minimale Zustände und entfallende Mechanik

| Besitzer                  | Geplanter Zustand                                                                                                                  | Entfällt                                                                                                              |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| EditorDocument            | Livequellen, Vorherbilder, C1-Konto/Reservierungen und eine aktive/abschließende Geste mit begrenzter Fortsetzung, History/Pending | Kopien je Live-Dosis, soweit Gestenvorherbilder und unveränderliche Nachherstände sie ersetzen                        |
| Controller mit brush.ts   | idle/active/finishing/blocked; Polylinie, feste Parameter, kausale Uhr, lokale Grundlage und authentifizierte Renderbestätigungen  | awaitingDose als globale Eingabesperre, Wegverlust nach erfolgloser Zeichenrunde, Stempelrestkonto des verworfenen C0 |
| WorldRenderer/HeightField | Neueste Quellen je Schlüssel, Dirtyunion, ein eingefrorener Stand, kleine Aufgaben, höchstens zwei GL-Slots                        | Ganze Vorbereitung aller dirty Tiles vor Budgetwahl, Renderjob pro Dosis, normale synchrone CPU-Rasterung             |
| ProjectSession            | Ein geordneter Writer, Datei-/Saved-/Recoveryzustand und vorhandene Aktionsgrenze                                                  | Keine neue Schreibqueue oder Autorenautorität                                                                         |

Unter src/editor/brush.ts bleiben reine Entscheidungen, unter model/ Integration
und fachliche Grenzen. Der Fachkern erhält begrenzte erlaubte Wirkung, keine
GPU- oder Framekenntnis. Die spätere Ausführung ist Teil derselben Dokumentgeste.
C1-Konto und Quellen-/Arbeitsreserve liegen im Dokument; der Controller besitzt
die kausale Eingabeuhr und authentifiziert Grafikbelege.
Dateiformat, Quellenmathematik, Journalquittung und Save/Discard/Cancel werden
erweitert, soweit die Abschlussbarriere es benötigt; keine zweite Pipeline.

#### Arbeitspakete mit Liefergegenstand und Stopkriterium

| Paket                                                 | Konkrete Arbeit und Dateien                                                                                                                                                                                                                                                             | Abschlussbeleg                                                                                                                                                                                                                               | Stopkriterium                                                                                                                                    |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| R1 — Kandidatenwahl abgeschlossen; Nachweis im Status | brush.ts/model-Tests und vorhandener Auswerter: C0 am fixierten Wiederbesuchsfall widerlegt; C1 mit kausaler Eingabeuhr, lokalen Reservierungen und unabhängiger Inhaltsreferenz ausgewählt. C0 bleibt allein als negativer räumlicher Gegenbeweis.                                     | Analytische Klick-/Halte-/Geradenfälle, gleicher Weg bei anderer Zustellung, wiederholte Besuche, Up-/Überlastfälle und absichtliche Fehlerkontrollen unterscheiden sich korrekt. Auswahl samt Kosten und offenen Hardwarebelegen begründet. | Kein weiterer Umbau bei widersprüchlicher Semantik oder selbst gesetztem schwächerem Soll; fehlende Widerlegung ist kein Erfolg.                 |
| R2 — Höhenweg integriert; Abnahme im Status offen     | EditorController, brush.ts, EditorDocument, WorldRenderer/HeightField: ausgewählten Kandidaten, begrenzte Annahme/Fortsetzung, lokale Belege, eingefrorenen Renderstand und vollständigen Receipt zusammenführen.                                                                       | Weg/Endpunkt bei verzögerter GPU; keine neue Zeitwirkung nach Up; nach tatsächlichem Aktionsabschluss null späte Mutation. Reservierungen, ein Undo, Up→Save/Reopen, Abbruch und alte Receipts stimmen.                                      | Globales Dosisgate, verlorener normaler Endpunkt, unreservierte Restwirkung oder zweite Autorenautorität widerlegen den Kandidaten.              |
| R3 — Renderpfad integriert; Nachweis im Status        | height-field-data, HeightField, WorldRenderer, EditorController, budgets.ts: Kleinstwerte mit Fehlerbudget, Auswahl vor Vorbereitung, lokale Metadaten, 2 GL-Slots und kurze GPU-Pakete. Mit dem ersten produktiven Ausnahmejob die minimale gemeinsame Jobzulassung aus A06 einführen. | Normaler Zoom-/Level-9-Fall hat null CPU-Fallback; alle 22 Stufen stimmen; Ressourcen, Contextloss, Snapshotüberholung und budgetierte Autorenfortsetzung sind geprüft; Abbruch gibt den Rechenslot erst nach tatsächlichem Ende frei.       | Normale Großpinsel erreichen Framedauer nur durch Weg-/Zeitverlust oder unteilbare Aufgaben überschreiten das Budget.                            |
| R4 — Positive Hardware-Richtungsprobe                 | Bestehende Collection-/Graphics-/Scaling-/Interaktionsrunner prüfen denselben gewählten Produktpfad mit kombiniertem Urteil.                                                                                                                                                            | Feste kleine GPU-Matrix: vollständiger Weg, ≥90 % normale Referenzwirkung, sichtbarer Ergebnisabstand p95 ≤20 ms, CPU-/GPU-/Ressourcenbudgets; Input→Submit p95 ≤50 ms nur als notwendiger Proxy.                                            | Kein Werkzeugausbau bei rotem Normalfall. Kostenursache benennen; ein Verfahrenswechsel muss die bereits festgelegten Kriterien erneut bestehen. |
| R5 — Gemeinsamer Fall und Freigabe                    | Nur benötigte P1/P2-Schritte mit P3-Rundlauf verbinden; nativen Deadline-Nachweis qualifizieren, danach vollständige Pflichtstichprobe.                                                                                                                                                 | Höhe + Landschaft/Lichtung + Haus/Fundament + vorbereitete Wasserfläche bleiben gemeinsam korrekt und flüssig; native P0-Abnahme und P3-Gate bestehen.                                                                                       | Keine P4–P9-Übertragung bei weltweiter Nachführung, neuem Commitsonderweg oder fehlender gemeinsamer Zeitreserve.                                |

R1 ist eine endliche Auswahl, kein neues Testframework und keine allgemeine
Brush-Engine. R2 wird als ein vertikaler Kandidat integriert; Annahme ohne
passende Ausführung und Rückmeldung gilt nicht isoliert als fertig.
R3 kann parallel vorbereitet werden; gemeinsame Versionen und Integration
haben einen Verantwortlichen. Es bleibt ein C1-Produktkandidat; C0 hat keinen
Produktpfad und keinen allgemeinen Inhaltsauswerter mehr. Jeder Implementierungspaketabschluss aktualisiert die betroffenen
aktuellen Produkt-/Architekturabschnitte und den Kurzstatus.

R4 bleibt eine kurze Richtungsentscheidung. Fehlende Hardware ist ein benannter
Blocker; ein erfolgreicher Softwarelauf ersetzt sie nicht. Nach bestandenem R4
darf R5 den kleinen kombinierten Fall entwickeln, während die vollständige
Präsentationsabnahme fertiggestellt wird. Dies erlaubt keinen allgemeinen
P1–P9-Ausbau und keine Absenkung der Zeitziele.

#### Integrierte Prüfzuordnung

Die unabhängige R1-Referenz wurde vor der Produktintegration festgelegt.
Die früheren Erwartungen eines globalen Dosisgates, des Wegverlusts nach einer
erfolglosen Zeichenrunde und des sofortigen Modellabschlusses bei Up sind
abgelöst. Die folgenden Garantien werden im gemeinsamen R2-Pfad geprüft;
aktuelle Ergebnisse stehen ausschließlich im Status.

| Garantie                                                                                                                                                     | Produkt- und Prüfpfad                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Vollständige kausale Polylinie, Ecken, Endpunkt, späte Zeitstempel und 128er-Grenze                                                                          | `brush.ts`, `brush.test.ts`, `model/prepaid-height.test.ts`, `render/WorldRenderer.test.ts`                            |
| Unabhängige räumliche/zeitliche Sollwirkung; keine fehlende Mitte, Abkürzung oder unzureichende Stärke                                                       | `scripts/atlas-p0-brush-reference.mjs`, `scripts/atlas-p0-evaluate.mjs`, `performance/evaluator.test.ts`               |
| Angewandte plus reservierte lokale Wirkung; atomare Quellen-/Speicherprüfung und genau einmalige Materialisierung                                            | `model/BrushReservations.ts`, `model/PrepaidBrush.ts`, `model/EditorDocument.ts` und ihre Tests; Schema-6-Auswertung   |
| Up versiegelt vor Handler-Rückkehr; angenommene Arbeit endet mit einer Historyaktion und ohne späte Mutation                                                 | Controller/Document, `render/WorldRenderer.test.ts`, `scripts/atlas-p0-interactions.mjs`, Schema-6-Auswertung          |
| Vollständige eingefrorene Renderbestätigung trotz neuerem R+1; falsche/alte/teilweise Belege scheitern                                                       | `render/WorldRenderer.ts`, `render/HeightField.ts`, Renderer- und Auswertertests                                       |
| Up→Undo und Up→Save/Reopen einschließlich echter Restarbeit; Cancel/failed Open erhalten die Aktion; Sessionwechsel/Disposal invalidieren alte Fortsetzungen | `ProjectSession.test.ts`, `scripts/atlas-p0-lifecycle.mjs` mit active/pending/failed/finishing und cancel/save/discard |

Die Angaben unter `src/editor/` sind relativ zu diesem Verzeichnis.
`evaluateStrokeContent` bleibt eine Teilgarantie für sichtbare Anfangs-/Endpunkte;
er ersetzt die C1-Referenz nicht. Der Lifecycle-Modus `pending` verzögert eine
Storeantwort; nur echte reservierte, noch nicht materialisierte Arbeit belegt
`finishing`. Fehlende Wirkung, doppelte Anwendung, unvollständiger Abschluss
und falsche Saved-/Receipt-Zuordnung müssen den gemeinsamen Auswerter scheitern lassen.
Vor D11-Freigabe abgewiesene Gesten dürfen weiterhin niemals nachträglich starten.

#### Vier verpflichtende Gegenabläufe

1. **GPU 200 ms verzögert, Up nach 70 ms:** Der begrenzte neue Weg samt Endpunkt
   wird mit dem gemeinsamen räumlichen Stärkeanker erhalten; angewandte plus
   reservierte örtliche Wirkung bleibt begrenzt. A und neuer Endbereich B liegen
   dabei auch in derselben Autorenkachel, um zu grobe Belege zu erkennen.
   Nach Up keine neue Zeit/Dosis erzeugen; nur die zuvor angenommene Arbeit
   abschließen. Ein Undo-Schritt, stabiler Endzustand nach Abschluss und Erholung.
2. **UI 500 ms blockiert, begrenzte geknickte Polylinie plus Up:** Höchstens
   50 ms Zeitangebot des überlasteten Fensters annehmen; alle gelieferten Ecken
   innerhalb der festgelegten Kapazität mit dem räumlichen Stärkeanker erhalten.
   Keine Abkürzung oder stationärer Ersatz. Der separate echte Überlauffall wird
   vor Annahme sichtbar; er ersetzt diesen Pflichtverlauf nicht.
3. **Up, Vorzeichenwechsel, neuer Druck und altes Receipt:** Kein unsichtbares
   Klickstapeln über noch nicht aktuellem Gelände. Abschlussbarriere und D11
   gelten; erst danach neue feste Parameter. Ein alter Beleg gibt keine Wirkung
   einer neuen Geste frei und setzt keine neuere lokale Rückmeldung zurück.
4. **Halten bis T = 120 ms verbucht, Move bei 110 ms und Up bei 115 ms später
   zugestellt:** Geometrie einschließlich Endpunkt bleibt erhalten; keine neue
   vergangene Zeit und keine rückwirkende Umbuchung. Raum- und Zeitreferenz
   bleiben getrennt. Unterschiedliche Batchgrenzen derselben normalisierten
   Beiträge ändern das Ergebnis nicht; wiederholtes Kreisen folgt ausdrücklich
   der gewählten D10-Regel.

Zusätzlich: Fence beim letzten Move offen und beim Up fertig; Up mit neuem
Endpunkt ohne Move; gleiche Zeitstempel; 30/60/120-Hz-Zustellung und RAF-Phasen;
lange Bewegung/Halten; aktive Fläche am Fensterrand; Quellenwechsel und Contextloss.
Up→Undo, Up→Save, Up→neuer Strich und Save/Discard/Cancel während finishing prüfen
die gemeinsame Aktionsgrenze. Reopen muss den vollständigen gespeicherten Strich
zeigen; ein fehlgeschlagenes Open nach Discard erhält die alte angenommene
Restarbeit. Spätere Sessioncallbacks dürfen keine fremden Autoren ändern.
Ein dauerhaft fehlerhafter entfernter Übersichtread darf lokale bereite Arbeit
nicht blockieren. Lokale Priorität, vollständige Übersichtsdelta-Übernahme und
erhaltene neuere Dirtyteile werden ebenfalls geprüft.
Unabhängiger erwarteter Inhalt zählt, nicht nur intern als angenommen gezählte Zeit.

### P0 — Vorhandene Grundlage und verbleibendes Gate

P0a–P0f bezeichnen die Teile des Höhenversuchs, keinen erneuten Bauauftrag:

| Teil | Vorhandene Grundlage                                                     | Verbleibende Verantwortung                                                                                   |
| ---- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| P0a  | Nutzervertrag D01–D11 und enger Auftrag festgelegt.                      | Neue Befunde in Status und Restauftrag einordnen; keine obligatorische neue V7-Benchmarkreihe.               |
| P0b  | Gemeinsame lokale Freigabe und normaler Produkt-/Prüfpfad.               | Referenz/Vorprüfung nach K3; qualifizierten Präsentationsbeleg nach Abschnitt 6 bis P0-Abschluss nachweisen. |
| P0c  | Höhenmodell, Graben, grobe Änderung, History und Dateirundlauf.          | Bei Änderungen relevante Funktionsbelege erhalten.                                                           |
| P0d  | Numerisches GPU-Abbild und beibehaltene Farbkacheln mit lokalem Submit.  | 512-Pixel-Pinsel, fortlaufende Wirkung, numerische Bildtreue und unveränderte Zeitziele belegen.             |
| P0e  | Numerische Übersicht, begrenzte Quellen samt Metadaten und Detailerhalt. | Begrenzung, alte-Read-Schutz und Rückkehr-/Historyfälle beim Umbau erhalten.                                 |
| P0f  | Reine Reads während asynchroner Snapshots, gemeinsame Antwortprüfung.    | Snapshot S, spätere Dirty-Änderungen und tatsächliche Read-/Save-Überlappung erhalten.                       |

**P0-Abschluss:** M01 sowie Höhenanteile aus M03/M04/M10 mit D10/D11 bestehen
im gebauten Kandidaten. Dazu gehören Inhalt, laufender Verlauf, History,
Dateirundlauf, Budgets sowie qualifizierte Referenz, inhaltsgebundener
Präsentationsnachweis nach Abschnitt 6 und dessen Stichprobe. Funktionserfolg
oder schneller Submit allein schließen dieses Gate nicht. Fehlende Umgebung
oder fehlender qualifizierter Präsentationsbeleg ist
`blockiert`; ein bekannter Inhalts-/Budget-/Zeitfehler bleibt `FAIL`.

Nach einem späteren Umsetzungsauftrag gilt zunächst **R1 → R2/R3 → R4 → R5**.
Ein bestandenes R4 erlaubt ausschließlich die für den kleinen P3-Fall nötigen
P1/P2-Erweiterungen. Die vollständige P0-Abnahme bleibt bis zu Referenz,
Präsentationsdeadline und Pflichtstichprobe offen. Erst nach P0-Abnahme und
bestandenem gemeinsamem P3-Fall gilt **P4 → P5/P6/P7/P8 → P9**.
Gemeinsame Dokument-, Oberflächen- und Undo-Verträge werden nicht mehrfach gebaut.

### P1 — Zustände, Datenverträge und Fachkern konsolidieren

**Abhängigkeit:** positive begrenzte Hardware-Richtungsentscheidung R4.
**Lieferung:** zunächst nur die für den P3-Produktfall benötigten Typen und
Regeln. Keine vollständige abstrakte Weltmodellierung vor dem gemeinsamen
P3-Nachweis und der vollständigen P0-Abnahme.

- Vorhandenen `EditorDocument` erweitern: Quellen/Masken, Objektheader,
  getrennte Innenpayloads, IDs, lokale Abhängigkeiten, atomare Patches und History.
  A03/A04 auf Boden/Landschaft/Geometrie übertragen; A08-Kerne gezielt anbinden.
- Den vorhandenen effektiven Controllerzustand auf neue Werkzeuge erweitern.
  React-Feldentwürfe bleiben lokal; Kamera-/Pointerarbeit bleibt außerhalb
  hochfrequenter React-Updates. Keine erneute Zentralisierung bereits gemeinsamer Einstellungen.
- Reine Koordinaten-, Schlüssel-, Bounds- und Patchverträge gemeinsam verwenden.
  Fachliche und binäre Eingangsvalidierung erhalten. Kleine Module nach
  Verantwortung schneiden, keine Hüllen nur zum Weiterreichen.
- Den nach K5 bereinigten Quellen-/Transportvertrag erweitern, ohne entfernte
  Alternativen wieder einzuführen. Selektive Lesezwecke und tatsächliche
  Quellenzustände erhalten.
- Die mit dem ersten produktiven Ausnahmejob in R3 eingeführte gemeinsame
  Jobzulassung gemäß A06 für die benötigten Fachjobs verwenden und erweitern.
  Keine zweite Dokumentautorität und keine pro Werkzeug separat entwickelte Queue.

**Entfällt:** bislang erforderliche Höhen-Sonderverträge, soweit der erweiterte
Quellen-/Objektkern ihre Verbraucher übernimmt. In K5 entfernte Alt-APIs bleiben entfernt.
**Nachweis:** Koordinatenränder, fehlend/explizit leer, lokale Bereitschaft,
Grob-/Fein-Semantik, No-op/IDs/History und stale Jobs.
Neue leere Welt bleibt sparse. P0-Belege nur nach betroffenen Änderungen erneuern.

Als konkrete erste Erweiterung werden die bisherigen Höhenpatches zu einer
geschlossenen, expliziten Patchmenge: zuerst Höhe und Landschaft, dann Hausheader
und vorbereitete Gewässerquellen. Transaktionskennung, Sequenz, History und
Persistenz bleiben gemeinsam. Abbrechbare Gesten restaurieren ihre gehaltenen
Vorherwerte durch denselben Invalidierungspfad, ohne zusätzliche Vorschauwelt
oder regulären History-/Storecommit. Inhaltsidentitäten werden mit Undo restauriert;
monotone Laufzeitrevisionen bleiben davon getrennt.

### P2 — Gemeinsame Persistenz und vollständige Dateiabläufe

**Abhängigkeit:** P1. **Pflichtumfang:** F19-Grundlage.

Vorhandenen SQLite-Pfad mit jedem P3-Datentyp unmittelbar erweitern; das
vollständige Schema wächst anschließend mit den weiteren Fachpaketen:
binäre Quellen, Objektheader, selektive Innenpayloads und A03-Übersichten.
Eine geordnete Commit-/Dateigrenze, gemeinsame Validierungsregeln, bestätigte
Abwesenheitsreads, Historyspooling und begrenzter Schreibbacklog.
Editorannahme, Eingabeende, vollständiger Aktionsabschluss, Store-Ack und
gespeicherter Snapshot bleiben getrennt.

Neu/Open/Save/Save As/Close inklusive echter Dialoge und Save/Discard/Cancel
über diesen Pfad führen. Snapshot S neben späteren Änderungen beweisen;
Disk-/Writefehler, Abbruch, beschädigte Datei, Workerabbruch und Sessionwechsel
in isolierten Testdateien prüfen. Save direkt nach Up muss die vollständige
versiegelte Geste einschließen; alte Fortsetzungen dürfen keinen Sessionwechsel
überleben. Reopen materialisiert kein globales Detailraster.

**Entfällt:** ersetzte Format-/Status-/Queueadapter und unbenutzte JSON-Umwege.
Sicherheitsprüfung an Prozess-/Dateigrenzen bleibt bestehen.
**Nachweis:** echter Dateirundlauf mit Prozessneustart, unveränderte alte Zieldatei
bei Fehler, spätere Änderungen bleiben dirty, falsche Formate ohne Teilübernahme.

### P3 — Gemeinsamen Kern mit Landschaft, Haus und Konkurrenz prüfen

**Abhängigkeiten:** R4 und die dafür nötigen P1/P2-Erweiterungen; vollständige P0-Abnahme vor weiterem Ausbau nach P3. **Pflichtumfang:** F01–F04/F18-Basis.

P1/P2 jeweils mit dem folgenden nutzbaren Schritt erweitern. Jeder neue Datentyp
erhält sofort Darstellung, Bearbeitung beziehungsweise vorbereitete echte Quellen,
History und Dateirundlauf. Keine zusätzlichen Architekturschichten auf Vorrat.

1. **Wald und Lichtung:** Landschaftskachel mit ausdrücklicher Autorenmaske und
   den vier vorhandenen Deckungswerten. Fehlend erbt, explizit leer unterdrückt
   den groben Wald. Ein kleiner Landschaftspinsel samt Rücknahme genügt zunächst.
   Feine Lichtung → grobe Waldänderung → Detailrückkehr → Undo/Redo/Reopen prüfen.
   Als Übersichtskandidat feinen Eigenbeitrag und Restvererbung getrennt halten;
   an festen Abtastpunkten gegen einen unabhängigen vollständigen Sampler prüfen.
   Diese Rechenstruktur ist noch zu beweisen, keine Übernahme der additiven
   Höhenformel. Ein Bestand oberhalb des aktiven Budgets darf keinen feinen
   Nachfahrenscan und keine globale Neuauflösung auslösen.
2. **Ein echtes Haus:** Einen rechteckigen, rotierbaren Hausheader mit stabiler
   ID, Pose und Fundamenteinstellung platzieren, auswählen und verschieben.
   Header räumlich laden; Innenpayloads getrennt lassen. Abgebrochener Drag,
   Undo/Redo, kaltes Laden und Reopen benutzen den erweiterten gemeinsamen Pfad.
   Geländeänderungen verändern keine Hausautoren. Vollständiger Haus-/Parzellen-
   und Innenraumausbau bleibt in P5/P6.
3. **Vorbereitete Gewässer und Ableitungen:** Echte Seemaske/Pegel und ein kleines
   bestätigtes Flussprofil verwenden. Bei Terrainänderung aktuelles Fundament,
   aktuell geclipptes Wasser und auffindbaren Veraltet-Status gemeinsam zeigen.
   Quelle A → B → Undo(A) restauriert die Inhaltsidentitäten, sodass eine passende
   alte Ableitung wieder gültig sein kann. Kein weltweiter Durchlauf zum Markieren
   entfernter Häuser oder Gewässer. Vollständige Erstellungs-/Anpassungswerkzeuge
   bleiben in P7; die vorbereitete D03-Szene bleibt ein früher Teilnachweis.
4. **Echte Konkurrenz:** Begrenzte vorhandene Bebauungs- und Hydrologieberechnungen
   an unveränderliche Inputs und die gemeinsame Vorschlagsübernahme anbinden,
   ohne dafür sämtliche Werkzeugoberflächen zu bauen. Beide müssen während
   lokaler Bearbeitung und Save tatsächlich Fortschritt und brauchbare Resultate
   liefern. Aufgaben teilen die in R3 eingeführte Zulassung und bleiben zusammen
   innerhalb der festen Zweiergrenze aus A06; kurze Pakete und
   Priorität belegen. Ein Vorschlag prüft Session, Inhaltsidentitäten, bestätigte
   Abwesenheit und räumliche Lesemenge. Ein neuer Treffer im gelesenen Gebiet
   invalidiert ihn; ein unabhängiger Eingriff anderswo nicht. Keine eigene
   Dokumentautorität oder Commitqueue pro Job. Zwei gleiche Testjobs sind höchstens
   ein früher Teilnachweis und ersetzen den M06-Fall mit beiden Fachberechnungen nicht.
5. **Gemeinsamer Rundlauf:** Landform → fernes Dorf → Graben/Lichtung/Haus → Welt
   → grobe Höhe/Waldänderung → Detailrückkehr → sofortiges Weiterarbeiten nach D11
   → Undo/Redo → Save/Neustart/Reopen. Die Wasser-/Fundamentszene und reale
   Konkurrenz gehören dazu. Kamera, 14 Ansichten, Kontextwechsel, DPR/Resize,
   Auswahl und Overlay vervollständigen; keine globale Sperre bereiter Orte.

**Entscheidung vor weiterem Funktionsausbau:** Verlangt dieser kleine Fall globale
Nachfahrenscans, eine zweite veränderliche Welt oder werkzeugeigene Commitpfade,
die gemeinsame Quellen-/Abhängigkeitsgrenze korrigieren. Nicht erst alle Werkzeuge
übertragen und dieses Zusammenspiel anschließend prüfen. Nach bestandenem Fall
mit P4–P8 fortfahren; keine zusätzliche optionale Höhenkonsolidierung dazwischenschieben.

**Entfällt:** Höhen-Sonderwege, sobald die gemeinsamen Verträge sie ersetzen.
**Nachweis:** M01, Kernanteile M02–M04/M06/M10 im gebauten Desktop; Referenzzeiten,
Arbeits-/Speicherbudgets und D01–D03 gelten zusammen. Fehlende spätere Werkzeuge
im Teilprofil benennen. Erst danach weitere Fachpakete.

### P4 — Terrain, Farben und Landschaft vollständig übernehmen

**Abhängigkeit:** P3. **Umfang:** F04–F07.

Sämtliche Höhenmodi und Formen, Küsten, Höhenlinien/Cursorhöhe sowie
Boden-/Felsfarbe mit Vorlagen, Modi, zeitlichem Fluss, Pipette und Radierer
übertragen. Landschaftsdeckung, Lichtungen und stabile Kandidaten vervollständigen.
A03-Masken, Material-/Schnee-/Felsdarstellung und nahtlose Rand-/Haloregeln gelten.
„Lokale Details zurücksetzen“ bleibt explizite Bereichsaktion mit Vorschau/Undo.

**Entfällt:** werkzeugeigene Patch-, Vorschau-, History- und Persistenzpipelines.
**Nachweis:** alle F04–F07-Modi einschließlich Halten, Abbruch, Rändern,
kalter Bearbeitung und Grob-/Feinfolge; Vorschau und Übernahme verwenden denselben Kern.

### P5 — Straßen, Parzellen und Außenhäuser übernehmen

**Abhängigkeit:** P3/P4, gemeinsame Wasseroberfläche mit P7. **Umfang:** F08–F12.

Kurven/Griffe, Verlängerung, stabile Sections, Gelände-/Wasserkosten, festgehaltene
Rauheit sowie deterministische Vorschläge/Varianten mit endlichen Budgets erhalten.
Parzellen/Häuser einzeln bearbeiten, auslassen, herauslösen und erneut erzeugen.
Objekte/Innenpayloads trennen; Pose, Owner, Containment, Kollision und Löschfolgen
über den gemeinsamen atomaren Kern führen. Reine bestehende Fachkerne nach A08 wählen.

**Entfällt:** ersetzte Vorschau-/Commit-Doppelmathematik, eigene Dokument- oder
Historyserver. Aktive verwendete Fachberechnungen erhalten ihre Prüfungen.
**Nachweis:** F08–F12 einschließlich idempotentem Populate, No-ops, gebundenen
Bewegungen ohne Innenraumverlust, Undo/Redo, Reopen und Wasseranschluss.

### P6 — Hausinnenräume übernehmen

**Abhängigkeit:** P1/P2; für UI und Abnahme P5. **Umfang:** F02/F12–F14.

Reinen hauslokalen Solver nach A08 übernehmen oder portieren. Räume, Merge/Split-
Identitäten, Türen/Durchgänge, halbe Öffnungspositionen, Treppen und Etagenregeln
vollständig erhalten. Innenpayload selektiv laden; Welttransform, Außenheader,
Dachkontur und alle Geschosse einschließlich Keller getrennt behandeln.

**Entfällt:** unnötiger Welt-/SQL-Kontext im Solver und ersetzte Innenraumadapter.
**Nachweis:** freie/gebundene gedrehte Häuser, Keller/Etagen, Raumbewegung,
Verbindungen/Treppen, Löschkaskaden, kalter Innenraumwechsel und Dateirundlauf.
Ferne Innenräume werden weder geladen noch gezeichnet.

### P7 — Gewässer und ausdrückliche Nachführung übernehmen

**Abhängigkeit:** P4, gemeinsamer Vertrag mit P5/P6. **Umfang:** F09/F16/F17.

Flussgeometrie, Breiten, Mäander, Richtung, Snapping und gemeinsame Nodes
integrieren. Profile/Betten mit Seepegeln, Rückstau und Zuflüssen als versionierte
Aufgaben berechnen. Seenpinsel erhält Aushub, Ufer, Vereinigung/Inseln und die
atomare Höhen-/Wasseraktion. D03 mit Veraltet-Anzeige, lokal aktueller Darstellung
und ausdrücklicher Korrektur vollständig umsetzen.

**Entfällt:** synchrone globale Nachführung pro Terrainereignis sowie eine zweite
Oberflächenmathematik. Keine alte hydrologische Lösung als aktuell ausgeben.
**Nachweis:** F16/F17 und D03 einschließlich Abbruch, Zyklen/Überlast,
stale Ergebnissen, A→B→A, Undo/Redo und Reopen; Navigation bleibt verfügbar.

### P8 — Regionen, Bedienung und Kartenbild vervollständigen

**Abhängigkeit:** P3, Integration P4–P7. **Umfang:** F03/F15/F18.

Regionen/Ränge, Malen/Radieren, Löcher/Teilflächen, leere Namen und geometrische
N:N-Beziehungen mit Flächenanteilen erhalten. Labels/Marker teilen Priorisierung
und Kollisionsbudget. Fantasykartografie mit Waldkronen, Relief, Materialien,
Dächern/Löchern und Walmdächern fertigstellen. Panels, Felder, Shortcuts, Modals,
Fokus und Auswahl bei 900×620 und 1440×960 prüfen.

**Entfällt:** dauerhaftes P0-Diagnose-UI, Debugdarstellung als Endprodukt und
doppelte Panelzustände. Diagnosefunktionen bleiben separat erreichbar.
**Nachweis:** F01–F19 besitzen aktive Implementierungs-/Testpfade;
lesbare nahe/mittlere/ferne Ansichten und exakte Fachwerte stimmen.

### P9 — Übergang beenden und endgültigen Stand abnehmen

**Abhängigkeit:** alle vorherigen Pakete. **Lieferung:** ein regulärer Editor.

1. `src/main.tsx`, Desktopstart und Paket auf den bestätigten Pfad umstellen.
   V7 bis dahin als Funktionsreferenz erhalten; keinen unfertigen P0 als Ersatz liefern.
2. Ersetzte `src/atlas/`-Canvas-/Workflowpfade, Rust-Dokumentserver/Queue,
   Transporttypen, JSONL-Testbridge und Contractgenerator nur nach Verbrauchersuche
   und übertragener Verhaltensabdeckung entfernen. Tauri nur bei bestätigtem
   Electron-Host entfernen; benötigte reine Rust-Kerne samt Builds behalten.
3. P0-Sondereinstieg/-Befehle, Übergangsflags und doppelte Build-/CI-Aufrufe
   in die endgültigen Befehle überführen. Keine zweite ungenutzte Produktlaufzeit.
4. `check:all`, Desktop-/Paketprüfung und Referenzabnahme vollständig verdrahten.
   Den erforderlichen Checknamen erhalten. Fehler und fehlenden Pflichtwert
   isoliert einspeisen: zentraler Ausgang muss scheitern, danach Normalfall bestätigen.
5. M01–M10 samt Fach-/Fehlerfällen und Ressourcen am endgültigen Release prüfen.
   RPM installieren und die installierte Anwendung ohne Entwicklungsserver mit
   echten Dialogen bedienen. Nach Änderungen nur betroffene Nachweise erneuern.
6. Vier kanonische Dokumente auf tatsächlichen Stand bringen; diesen Plan und
   seine Matrix schließen. Regulär integrieren, wenn die Repo-Gates bestehen.
   Äußere Integrationsblockade offen halten, prüfbaren Kandidaten erhalten.

**Gate:** Abschnitt 8 vollständig erfüllt. Funktionsparität, kurze direkte
Datenwege und entfernte Altverbraucher gehören zusammen zum Abschluss.

## 6. Prüf- und Performancevertrag

### Beobachtung statt künstlicher Fertigsignale

Eine Testanbindung darf Kamera, Quellen-/Aktionssequenz, Eingabeende,
vollständigen Aktionsabschluss, Rendererabschluss, Speichergrenzen und Ressourcen
beobachten. Sie darf weder Produktsteuerung noch
„bereit“-Flags setzen. Fach- und Dateipfade bleiben echt.

Für GPU-Rendering den Zeitpunkt nach dem tatsächlichen Renderaufruf der passenden
Generation erfassen. Ende des JavaScript-Aufrufs, GPU-Abschluss und physische
Bildschirmpräsentation nicht gleichsetzen. Unter anderem über zusätzliche
Bild-/Pixelproben außerhalb der Zeitmessung bestätigen, dass die Karte wirklich
den geänderten Zustand zeigt. Ein beweglicher Cursor allein ist kein Pinselbeleg.

Der Runner korreliert je Eingabesequenz Eingabeentstehung einschließlich Wartezeit
in der Eventqueue, genaue Modelländerung, Render-Submission der passenden
Generation und deren tatsächliche Präsentation. Uhren, Sequenzen und Geländeinhalt
müssen zusammenpassen. Die zulässigen Messverfahren und konservativen Zeitgrenzen
bestimmt ausschließlich der Abschnitt
[Präsentationsnachweis](#präsentationsnachweis-ohne-endlose-tracesuche); ein bestimmter
Host schreibt keine Tracemethode vor. Zusätzlich Up/Eingabeversiegelung und
vollständigen Aktionsabschluss getrennt erfassen; Handler-Rückkehr ist kein Ersatz
für übernommene Restarbeit. Die Latenzuhr beginnt weiter beim ursprünglichen Input
beziehungsweise Up. Kann die Umgebung nur Submission beobachten, diese als Proxy
ausweisen und den Sichtbarkeitsnachweis offen lassen. Screenshots außerhalb der
Zeitmessung belegen Inhalt, aber keine 50-ms-Präsentationslatenz. P0b stellt die
Messanbindung her; der Nachweis umfasst ganz P0 einschließlich P0d/P0e und wird
in P3 erweitert.

### Verbindliche Szenarien

| ID  | Eingaben / Fixture                                                                                                   | Erforderlicher Nachweis                                                                                                             |
| --- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| M01 | Neue leere Ozeankarte, Raster an/aus; 30 Sekunden Wheel/Pan                                                          | Keine Autorenänderung und keine datenbankabhängige Kamerafreigabe; tatsächliche Kameraantwort und Frameverteilung                   |
| M02 | Welt→Raum→Welt über alle Ansichten, am Ursprung sowie nahe ±90.000.000 Fuß                                           | Durchgehende Navigation, geringe aktive Arbeitsmenge, kein Koordinatenzittern; Position/Griffe/Picking stimmen                      |
| M03 | Höhen/Boden/Landschaft, je kleine/große normale Pinsel; Haus- und Straßenpunktbewegung                               | Eingabe bis exakter Live-Quellenstand und zugehörige Präsentation; zusätzlich Pointerup bis übernommener Aktionsstand               |
| M04 | Graben/Lichtung/Haus fein; große Höhe/Walddichte ändern; zurück, Undo/Redo/Reopen; drei feine Bestandsgrößen nach P3 | D01/D02, erhaltene Details, geänderte Küste/Materialien, begrenzte Quell- und Renderarbeit, echte Persistenz                        |
| M05 | Gleicher aktiver Ort bei 100.000 und 250.000 entfernten Häusern, zusätzliche Weltregionen                            | Keine lineare Weltiteration pro Frame/Interaktion; vorbereitete Übersichten und selektive Header-/Innenreads                        |
| M06 | Navigation und unabhängige Bearbeitung während Save; Bebauungs- und Hydrologieauftrag zu Beginn tatsächlich aktiv    | Exakte lokale Reaktion einschließlich Präsentation/Pointerup unter Last; wirksame Priorität, konsistente Ergebnisse und Save-Grenze |
| M07 | Schnelle Navigation A→B→A, Dokumentwechsel, verzögerte/abgebrochene Workerantworten                                  | Keine alten Quellen/Pixel/Commits in neuer Session; keine anwachsende Queue überholter Darstellungsjobs                             |
| M08 | Zehn Minuten wiederholte Rundreise mit Zoom, Malen und Undo/Redo                                                     | Speicherplateau innerhalb der Budgets; Texturen/Buffer/Listeners/Workerinputs tatsächlich freigegeben                               |
| M09 | Save, vollständiger Programmneustart, Reopen; zusätzlich Fehler-/Abbruchdateien                                      | Identische Autoren/Fachobjekte, keine fälschliche Saved-Meldung, alte Zieldatei bleibt bei Fehler gültig                            |
| M10 | Navigation zu kalten gespeicherten Details, erste lokale Bearbeitung; Außen-/Innenkontext, Rückkehr und Konkurrenz   | Navigation → lokale Bearbeitbarkeit und → erste exakt präsentierte Änderung einschließlich tatsächlicher Lade-/Wartezeit            |

Fixtures sind deterministisch und verwenden das neue echte Schema. Entfernte
Innenräume und fein bearbeitete Ausschnitte tatsächlich speichern; bloße leere
Boundingboxes beweisen keine skalierbare Datenhaltung. Für lokale Lastfälle sowohl
leere als auch bebaute Küste mit Wasser/Flüssen und einem ausgearbeiteten Haus nutzen.

### M10 konkret: nach Navigation weiterarbeiten

M10 beginnt in einem geöffneten Projekt. Prozessstart und vollständiges Öffnen
werden separat in M09 erfasst. Für kalte M10-Unterfälle fehlen die benötigten
Zieldetails zu Beginn der Navigationsfolge im Anwendungscache. Gewöhnliches Vorladen während der Navigation
ist erlaubt; die Folge, ihre Dauer und die Fixtures stehen vor dem Messlauf fest.
Ein neuer Prozess leert den Anwendungscache, nicht automatisch den Dateicache des
Betriebssystems. Diesen Zustand benennen, keine ungemessene kalte Platte behaupten.

- `t0`: Entstehung des letzten echten Navigationseingabeereignisses, das Zielort,
  Maßstab oder Hauskontext festlegt, einschließlich seiner Eventqueue-Wartezeit.
  Zusätzlich die gesamte Zeit ab Beginn der Navigationsfolge berichten.
- `t_sources`: benötigte Quellen, Eltern/Halos und Ownerdaten sind verfügbar;
  ausschließlich Ursachenmessung, keine Bedienfreigabe.
- `t_gate`: Produktfreigabe nach dem zugeordneten lokalen Terrain-Submit. Das
  ist der unmittelbar beobachtbare Laufzeitpunkt, noch kein Beleg nativer Sichtbarkeit.
- `t_ready`: erster Zeitpunkt, an dem das wirkliche Werkzeug am festgelegten Ziel
  nach D11 sichtbar und lokal bereit ist. Richtiger Terrainstand im sichtbaren
  Eingriffsbereich, Session/Ansicht und benötigte Daten gehören zusammen.
  Frühestens nach `t0` und Anwendung der zielbestimmenden Navigation erfassen.
  Ein alter Übergangsframe, eine Ladefläche oder Quellenbereitschaft allein
  genügen nicht. Eine reguläre numerische Übersicht des gewählten Maßstabs ist
  zulässig. Ferne fehlende Bildschirmkacheln sind keine globale Sperre.
  In der nativen Abnahme die Präsentation des freigegebenen Basisstands nach dem
  Abschnitt Präsentationsnachweis zeitlich qualifizieren, gegebenenfalls durch
  eine konservative obere Zeitschranke. `t_ready` liegt erst vor, wenn
  Produktfreigabe und diese Präsentation vorliegen. `t_gate` darf ihn nicht ersetzen.
- `t_edit`: Entstehung der ersten echten Bearbeitungseingabe, die bei Bereitschaft
  unverzüglich durch den normalen Eingabepfad ausgelöst wird. Die Instrumentierung
  beobachtet Bereitschaft und setzt sie nicht selbst. Die gesamte Wartezeit seit
  `t0` bleibt Teil der Messung. Der Proxylauf löst beim ersten beobachteten
  Produktfreigabeübergang aus. Der native Lauf löst dagegen beim ersten durch
  seinen qualifizierten Messweg belegten sichtbaren Ready aus; die dafür nötige
  Beobachtungs- und Triggerlatenz einschließlich `readyToInputMs` bleibt vollständig
  in der Gesamtzeit. Kein frei gewählter Warmup, zusätzlicher Sleep, Retry oder
  späterer Rettungsinput. Ein vorher entstandener Input ist kein Nachweis
  „Eingabe nach sichtbarer Bereitschaft“ und darf nicht nachträglich umdatiert
  werden. Eine erst nach dem Lauf ausgewertete Aufnahme ersetzt diesen tatsächlichen
  Ready-Trigger nicht. Ohne qualifizierten Präsentationsbeleg bleibt die Abnahme
  blockiert. Keine zusätzliche Produkt-API zum Setzen von Bereitschaft einführen.
- `t_exact`: Präsentation des exakt geänderten Kartenstands, über denselben
  qualifizierten Messweg zeitlich belegt. `t_ready − t0`, `t_exact − t0` und
  `t_exact − t_edit` je Versuch messen beziehungsweise konservativ nach oben
  begrenzen. Unsichere Zeitpunkte als Intervalle erhalten; eine obere Zeitschranke
  nicht als exakten ersten Präsentationszeitpunkt ausgeben. Die Dauerregel aus
  dem Abschnitt Präsentationsnachweis gilt auch hier. Quantile nicht aus
  getrennten Komponentenquantilen addieren. Dauer gröberer/veralteter Darstellung
  ebenfalls ausweisen.

Zusätzlich vor Bereitschaft Down/Move/Up sowie eine weiter gehaltene Taste
prüfen. Nach D11 ist das Soll: sichtbares Warten, keine Modelländerung, keine
History und keine spätere Wirkung dieser Eingaben. Nach Freigabe muss ein neuer
Druck funktionieren. Diese Vorabfälle sind keine erfolgreichen Editlatenzsamples;
ihre komplette Wartezeit und Eingabezuordnung bleiben im Bericht. Eine nie
erreichte Freigabe oder fehlende anschließende Erholung scheitert.

Der danach begonnene kalte Strich verwendet denselben Ablauf und dieselben
Live-/50-ms-Kriterien wie der warme Strich. Der erste Input liefert zusätzlich
die Navigationsmaße; alle Inputs bleiben im Journal. Eine schnelle Navigation
entschuldigt keinen langsamen ersten freigegebenen Edit. Ohne qualifizierten
nativen Präsentationsbeleg sind Freigabe-Submit und Edit-Submit nur Untergrenzen.
Gewöhnliche Bildprüfungen belegen Inhalt; eine zeitlich qualifizierte Aufnahme
kann dagegen den konservativen Deadlinebeleg aus Abschnitt 6 liefern.

Das endgültige Szenarienmanifest enthält mindestens:

1. Feinen Graben, maskierte Bodenfarbe und Lichtung an einer Kachelgrenze;
   Höhen-, Boden- und Landschaftseingriff benötigen echte Detail-/Nachbardaten.
2. Bebauten Küstenausschnitt mit Häusern, Straßen, Wasser und Fluss; derselbe
   Zielausschnitt mit den entfernten Beständen von 100.000/250.000 Häusern aus M05.
3. Gedrehtes mehrgeschossiges Haus mit Räumen, Türen und Treppe; Welt → Hauskontext
   → erste Innenraumbearbeitung, einschließlich selektivem Innenpayloadread.
4. Rückkehr A → B → A getrennt für tatsächlich warmes und verdrängtes Ziel sowie
   mindestens einen kalten Fall bei Save und Hintergrundarbeit gemäß M06.

Positionen, Quellmengen, Navigationsfolge, Cachezustand und beabsichtigten ersten
Eingriff vor dem Timinglauf festlegen. Pflichtfälle nicht durch längere Vorladezeit,
kleinere Fixtures oder einen später angesetzten Messbeginn nachträglich erleichtern.
P0 prüft den Höhenfall einschließlich P0d/P0e/P0f und D11, P3 zusätzlich Landschaft und ein einfaches Haus; P4–P7
ergänzen die fertigen Werkzeuge. P9 verlangt sämtliche endgültigen Unterfälle.

### Zeitziele und Messumfang

Die folgenden Werte sind **verbindliche Zielwerte, keine vorhandenen Ergebnisse**:

- Referenzviewport 1440×960 CSS-Pixel, DPR 1; zusätzlich Funktions-/Budgetproben
  bei 900×620 und 3840 Pixel Breite sowie DPR 2. Gleiche Fenster-/Displayeinstellung
  für vergleichende Zeitmessungen verwenden.
- M01/M02/M06 bei laufender Navigation: Ziel 60 Bilder/s auf einer festgehaltenen
  Referenzumgebung. p95 CPU-Arbeit für Eingabe und Framevorbereitung höchstens
  8 ms; p95 Frameintervall höchstens 20 ms bei 60-Hz-Betrieb; keine durch normale
  Kameraarbeit ausgelösten Pausen über 100 ms. VSync-Quantisierung dokumentieren.
- **Neu für normale laufende Bearbeitung:** ebenfalls Ziel 60 Ergebnisstände/s
  auf der festgelegten 60-Hz-Referenz; p95 Abstand aufeinanderfolgender exakt
  geänderter Ergebnisstände höchstens **20 ms**, solange fortlaufend tatsächliche
  Änderungen anfallen. Cursorframes und unveränderte Frames zählen nicht.
  Submit-/GPU-Abstände sind separate Diagnosen; die vollständige Abnahme braucht
  tatsächlichen Bildschirmfortschritt.
- M03/M04 und die entsprechenden lokalen Eingriffe unter Last in M06 bei
  bereitliegenden Quellen: p95 Eingabe → Präsentation des exakt geänderten
  Kartenstands höchstens 50 ms. Modelländerung und Submission separat
  korrelieren. Während einer abbrechbaren Geste zählt der exakte rücknehmbare
  Quellenstand als Live-Ergebnis; Cursor, Pinselkreis und vereinfachte Näherung
  zählen nicht. Zusätzlich Pointerup → atomar übernommener und präsentierter
  Aktionsstand messen; für diese gewöhnlichen lokalen Aktionen ebenfalls p95
  höchstens 50 ms. Eine Fortsetzung nach Up verbraucht dieses Budget, sie
  erhält keine zusätzliche Schonfrist. Aufwendige Werkzeuge mit gesonderter
  Übernahme separat ausweisen.
- Bei fortlaufender Pinselbewegung darf die Ergebnisanzeige nicht nach wenigen
  frühen Zwischenständen stehen bleiben. Die längste Pause mit ausstehenden
  Änderungen während weiterer Eingaben wird zusätzlich ausgewiesen; mehr als
  **100 ms** sind ein Live-Fehler, kein erlaubtes Ziel für gewöhnliche Reaktion.
  Das ist eine Stillstandsgrenze für den laufenden Verlauf, kein neues
  pauschales Maximum für jede einzelne Eingabe. Fehlt native Präsentation,
  belegt schon eine entsprechend lange Submit-Pause das verfehlte Mindestziel;
  ein kurzer Submit-Abstand allein beweist keine native Sichtbarkeit.
- M10: p95 Zielnavigation → sichtbare lokale Bearbeitbarkeit nach D11 höchstens **500 ms** und p95
  Zielnavigation → erste exakt präsentierte Änderung höchstens **750 ms**.
  Beide Zeiten dürfen in keinem regulären Abnahmefall **2.000 ms** überschreiten.
  Das sind neue Produktziele, keine gemessenen Eigenschaften eines Stacks.
  Pilotläufe prüfen Messung und Erreichbarkeit; sie bestimmen oder lockern die
  Grenzen nicht. Für den ersten nach Freigabe begonnenen Edit und den weiteren
  Strich gilt zusätzlich p95 ≤ **50 ms**; die Cold-Auswertung erhält keine
  Ausnahme. Ladezeit wird vollständig in den Navigationsmaßen erfasst.
  Ein nach fünf Sekunden fehlendes Ergebnis beendet den Fall als Timeoutfehler;
  die Produktabnahme scheitert bereits an der 2.000-ms-Überschreitung.
- Große Generatoren separat messen. Sofortige Kamerabewegung mit gröberem Bild
  bleibt Pflicht; das M10-Budget umfasst lokale Ladebereitschaft und gewöhnliche
  Eingriffe, nicht die exakte Lösung eines großen Flussnetzes. Ein gewöhnlicher
  Pinsel wird nicht wegen vieler gespeicherter Feindetails zu einem Generator.
- Mindestens drei unabhängige Release-Läufe; je Lauf und verpflichtendem Unterfall
  mindestens 30 Sekunden Navigation beziehungsweise 100 zuordenbare lokale
  Änderungsereignisse. Für M10 gilt die nachfolgende eigene Stichprobe.
  p50/p95/p99/Maximum und fehlende Samples angeben. Kalt/Warm getrennt halten;
  keine p95-Aussage aus drei Strichen und keine nachträgliche Ausreißerentfernung.
  Für jeden verpflichtenden M10-Unterfall mindestens 30 echte Zielwechsel je Lauf
  und mindestens 100 insgesamt. Pflichtgrenzen gelten je Unterfall und Release-Lauf;
  gemeinsame Quantile über Werkzeuge, Cachezustände oder Läufe ersetzen diese
  Einzelbewertung nicht. Maximum, Timeouts und fehlende Ergebnisse über sämtliche
  Samples prüfen. Timeouts und fehlende Ergebnisse bleiben Fehler, keine entfernten Samples.
- Referenzprofil in P0/P3 mit tatsächlich verfügbarer Desktopumgebung erfassen:
  CPU, RAM, GPU/Grafikbackend, OS, Displayfrequenz, gewählter Host/Renderer samt
  Versionen (beim Default Electron/Chromium/Node/Pixi),
  Commit, Build-/Pakethash und Fixtures. Software-Rendering ausdrücklich benennen;
  es ist kein Nachweis hardwarebeschleunigter Leistung auf Aarons Gerät.
- Der Referenzrunner endet bei verfehltem Pflichtziel, fehlenden Samples oder
  fehlendem Szenario ungleich null. Maschinenabhängige Zeitziele gehören in die
  Referenzabnahme; CI prüft deterministische Struktur-/Budgetregeln zusätzlich.
  Fehlt eine geeignete native Referenz, bleibt die Zeitabnahme `blockiert`.

Frühe Teilprofile aus P0/P3 enthalten ein ausdrückliches Teilmengenmanifest und
erfüllen nur ihr jeweiliges Gate. Die endgültige Referenzabnahme verlangt alle
Szenarien und Unterfälle; fehlende spätere Werkzeuge dürfen darin nicht als
übersprungenes erfolgreiches Ergebnis erscheinen.

Die alte Vorher-/Nachher-Reihe mit drei Strichen und die vorhandenen
`targetsMet`-Berichte belegen diese Ziele nicht. P0a dient der kurzen Ursachen-
eingrenzung; eine vollständige vergleichende Benchmarkreihe gegen V7 ist optional.
Sie darf kein Altformat und keine zweite Runtime zum dauerhaften Produkt machen.

### Normalbetrieb, Überlast und endliche positive Kriterien

Die folgenden Ergänzungen sind neue Zielkriterien, keine vorhandenen
Messergebnisse. Normale Szenarien und absichtlich erzeugte Überlast werden vor
dem Lauf getrennt im Manifest festgelegt. Gewöhnliche 512er-Gesten dürfen nicht
nachträglich als Ausnahme deklariert werden.

- Jeder normale Input wird verarbeitet oder geometrie- und zeitgleich
  zusammengefasst. Der erste sichtbare Stand, der seine Wirkung enthält,
  erhält seine ursprüngliche Eingabezeit; der Beginn des späteren Batches
  setzt die Latenzuhr nicht zurück.
- Gerade, L-/S-Kurve, Richtungsumkehr, kurzer Swipe, Klick sowie Up ohne
  letzten Move erhalten Weg und Endpunkt. Endpunktproben liegen außerhalb des
  Anfangsabdrucks. Zusätzliche Punkte entlang der Kurve verhindern, dass nur
  Start und Ende mit falscher Verbindung bestehen.
- Im normalen Betrieb müssen mindestens **90 % der unabhängigen Referenzwirkung
  des vor der Integration ausgewählten Weg-/Zeitvertrags** angenommen und
  vollständig angewandt werden. Für gleichgerichtete Höheneingriffe
  werden die Beträge der tatsächlichen Autorenänderungen mit einer separat
  integrierten Referenz derselben Eingabe verglichen; Anfangsimpuls getrennt
  ausweisen. Je Geste, je vorher festgelegter räumlicher Prüfregion entlang der
  Spur und bei langen Gesten je vollständigem Einsekundenfenster bewerten.
  Für mehrfach besuchte Stellen die vollständige Sollwirkung aller Segmente
  in dieser Region berechnen; Regionen einzeln bestehen lassen, ihre überlappenden
  Summen nicht nochmals zu einer Gesamtdeckung addieren. Eine zusätzliche
  Obergrenze von Referenzwirkung plus
  festgelegter numerischer Toleranz verhindert Erfolg durch zu starken Auftrag;
  Vorzeichenfehler scheitern. Für winzige Randkoeffizienten eine absolute Toleranz
  vor dem Lauf festlegen. Ein globaler Mittelwert darf schwache Unterfälle nicht
  verdecken.
  Weg-/Endpunktprüfung und Ergebnisfrequenz bleiben zusätzliche Pflichtkriterien.
  Räumliche und zeitliche Wirkung außerdem unabhängig prüfen: Eine isolierte
  Nullzeit-Polylinie muss die vorab analytisch bestimmte räumliche Sollwirkung
  des quartischen Kernels und einmaligen C1-Mindestauftrags liefern; ein bloß
  positives Epsilon-Ergebnis genügt nicht. Zusätzlich gilt der gemeinsame
  Mindestwert von 50 % des isolierten Referenzklicks an jeder manifestierten
  Prüfposition aus R1, auch für C1 und die begrenzten Staufälle. Gerade, Ecken,
  Wiederbesuche und Endpunkt gehören dazu; Außenproben erkennen falsche Abkürzungen.
  Stationäres Halten mit zwei festen Dauern prüft die unveränderte Höhenrate;
  Anfangsklick und seine einmalige Anrechnung auf die Zeitwirkung werden getrennt
  ausgewiesen. Dieselbe schnelle/langsame Spur prüft den zeitdominierten Bereich.
  Mindestens 90 % des normalen Zeitauftrags müssen auch dort wirksam werden;
  reine Wegwirkung ersetzt diesen Nachweis nicht.
  Die C1-Anrechnung wird einmalig korrekt über Regionen und Zeitfenster bilanziert.
  Die gemeinsamen Stärkeanker und Nutzerkriterien bleiben unverändert.
  Die Referenz erhält den vollständigen normalisierten Eingabestrom, die
  beobachteten Zeitfenster und die einmal festgelegte kausale Zeitregel; sie
  verwendet weder als Soll deklarierte Kandidatenquellen noch nur dessen
  angenommene Dosen. In normalen Fällen das ungekappte Zeitangebot mitbewerten:
  langsame Verarbeitung darf sich nicht durch 50-ms-Kappung selbst ein kleineres
  Soll setzen. 30/60/120-Hz-Zustellung, Coalescing und unterschiedliche RAF-Phasen
  gehören zur Inhaltsprüfung. Physisch unbekannte Zwischenpositionen sind kein
  behaupteter Teil der Referenz.
- Nach Up: keine neu erzeugten Weg-/Zeitbeiträge. Ausschließlich die vorab
  angenommene, reservierte Restarbeit darf noch Quellen ändern. Nach vollständigem
  Aktionsabschluss null weitere Mutation durch diese Geste oder ihre späten
  Callbacks. Das spätere Bild und Save/Reopen enthalten genau die vollständige
  versiegelte Arbeit. Up→Undo/Save/neue Geste prüfen die gemeinsame Reihenfolge.
- Absichtlicher 200-ms-GPU-Verzug und 500-ms-UI-Hänger prüfen die örtliche
  50-ms-Wirkungsschranke einschließlich Reservierungen, Zeitverfall, erfasste
  Geometrie und Erholung. Während absichtlich angehaltener Präsentation wird
  keine 50-ms-Anzeigelatenz behauptet; diese Fälle sind keine normalen
  Performance-Samples. Exakt volle Kapazität und einen Schritt darüber getrennt
  prüfen. Ein zu großer Puffer muss vor weiterer Annahme sichtbar stoppen,
  niemals als vollständiger Erfolg gelten.
- Die synthetische Gegenprobe mit 61 Inputs, 54 Abwürfen und 90-ms-Ergebnisabständen
  darf ein korrektes 10-ms-Latenzdetail behalten, muss aber am kombinierten
  normalen Betriebsurteil scheitern. Korrektheit des Auswerters separat prüfen.

R4 verwendet eine kleine festgelegte Matrix, kein volles kartesisches Produkt:
16/512 Pixel; repräsentative Autorenstufen 0, 4, 9 und 21; leere und dicht
mehrskalige Karte; kurzer Swipe, lange Kurve und Halten. Quellenmengen
32/1.024/9.000 im selben relevanten lokalen Grobfall vergleichen. Der
Rundungswechsel um Kameraskala 0,01 ist Pflicht. Erster zulässiger Eingriff nach
Navigation, Stufenwechsel, Undo und tatsächlich laufender Save werden gezielt
ergänzt. Alle 22 Stufen, Weltgrenzen und Küstenschwellen gehören zur
deterministischen Inhaltsprüfung. Manifest, normale Geschwindigkeit und
Referenzwirkung werden vor Optimierungen festgehalten.
Das begrenzte R4-Minimum sind zwei frische Prozesse, je ausgewähltem kritischem
kurzen Unterfall mindestens 30 Gesten und je fortlaufendem Unterfall mindestens
zehn Sekunden Bewegung beziehungsweise Halten. Fehler, Abbrüche und nicht
ausgeführte Versuche bleiben im Ergebnis. Dies ersetzt keine der vollständigen
drei Release-Stichproben.

### Ein Szenarioablauf, getrennte Prüfzwecke

Deterministische Probe, frühe Hardwareentscheidung und native Abnahme verwenden
dieselben Eingaberoutinen, Sollwerte und Inhaltsprüfungen. Ihr Umfang,
Wiederholungszahl, Messverfahren und erlaubtes Urteil sind ausdrücklich
verschieden. Eine Auswahl verkleinert niemals die endgültige Abnahme.
R4 verlangt reale Hardware und beobachtbaren Ergebnisfortschritt; ein noch
fehlender inhalts- und eingabegebundener Präsentationsbeleg muss sichtbar offen
bleiben und darf keine behauptete 50-ms-End-to-End-Erfüllung erzeugen.

| Zweck                             | Umfang                                                                                                             | Erlaubte Aussage                                                         |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Auswerteränderung                 | Vorhandene Journale plus gezielte fehlerhafte/unvollständige Eingaben                                              | Auswertung korrekt; keine neue Produktmessung                            |
| Deterministische Architekturprobe | Vollständiger Weg, lokale Wirkungsschranke, Up, kontrollierte GPU-/UI-Verzögerung, Inhalts-/Budgetreferenz         | Der untersuchte Kontrollfluss ist korrekt; keine Hardwareleistungszusage |
| Frühe Hardware-Richtungsprobe R4  | Festgelegte kleine reale Matrix, vollständige normale Wirkung, Ergebnistakt, CPU/GPU-Arbeit und sichtbarer Verlauf | Genau der nächste begrenzte P3-Fall ist begründet; keine Produktfreigabe |
| Native Leistungsabnahme           | Festes vollständiges Manifest und Stichprobe aus diesem Abschnitt                                                  | Leistungsziele des geprüften Umfangs erfüllt                             |

**Ein Ablauf je Szenario:** Parameter für Pinselgröße, Last und Wiederholungen
statt gesonderter Pilot-/Serienimplementierungen. Der analytisch geprüfte einzelne
Dab bleibt eine sinnvolle Eingabeform; er ersetzt keinen bewegten Strich.
Räumlich getrennte Pixelproben bleiben erhalten. Bei Last dieselbe Eingaberoutine
in nachgewiesene echte Save-/Workerintervalle starten.

**Ein Ergebnis je Szenario:** Rohereignisse und Store-Aktivität einmal pro Prozess;
Versuche referenzieren Identitäten/Intervalle. Der Laufbericht enthält jedes
Szenario einmal. Nach Abschluss Ergebnis und Auswertung sichern; ein kleiner
Laufindex nennt geplant, abgeschlossen, fehlgeschlagen und nicht ausgeführt.
Bei Abbruch bleiben Teilbelege und fehlende Fälle erhalten. Keine vollständige
Ereignischronik in jedem Versuch und keine manuelle Berichtsrekonstruktion als Normalfall.

**Eine Auswertung:** Zweck und Scope, D11-Freigabesemantik, Inhaltsresultat, vorhandene Messwerte und
verbleibende Abnahme eindeutig unterscheiden. Gesammelt ist nicht bestanden.
Edit/Pointerup und warm/kalt getrennt auswerten; p95 nach Abschnitt 6 prüfen,
Einzelüberschreitungen zusätzlich ausweisen. Ein einzelner Wert über 50 ms ist
nicht dasselbe wie ein verfehltes p95-Ziel. Fehlende/falsche Zuordnung,
Ereignisverlust, Inhalts-/Budgetfehler scheitern; fehlende native Referenz oder
ein fehlender qualifizierter Präsentationsbeleg bleiben ausdrücklich blockiert.
Ein gültiger konservativer Deadlinebeleg erfüllt diese Nachweispflicht ebenso.
Fehler und Blocker können zugleich vorliegen.
Vor Freigabe absichtlich abgewiesene Gesten, verlustfreies Coalescing und
ausdrücklich erzeugte Überlast sind verschiedene Fälle. Ihr jeweiliges Soll
prüfen und alle Eingaben zuordnen. Ein normaler Fall darf verworfene Wirkung
nicht aus dem Erfolgsnenner entfernen: Referenzwirkung, Weg, Ergebnistakt und
Latenz gelten gemeinsam. Unbekannte Auslassungen oder verlorene angenommene
Änderungen scheitern. Eine Ladephase darf nicht nachträglich um bereits
angenommene, verspätet dargestellte Änderungen gelegt werden.

Eine kurze Probe beendet die Richtungssuche, wenn das entscheidende Verhalten
widerlegt ist; keine weitere identische Messgruppe ohne neue Hypothese starten.
Ein ausdrücklich angeforderter vollständiger Vergleich darf weiter sammeln,
muss erkannte Fehler aber unmittelbar melden. Verbindliche negative Kontrollen
für ignorierten Zoom, Pointerup-only, verzögertes/fehlendes Rendering und Erholung
bleiben erhalten; sie verwenden denselben primären Inhaltsprüfer.
Für D11 ergänzen: Daten fertig/Bild verzögert; alter Frame in neuer Ansicht;
frühe gehaltene Geste ohne Replay; schnelle Freigabe mit absichtlich langsamem
erstem Edit; fehlende dauerhafte Freigabe. Der normale Pfad muss sich jeweils
erholen. Vorhandene Tests erweitern, keine neue Runner- oder Berichtswelt bauen.

**Diagnose und Build:** Ausführliches Journal/Trace nur bei explizitem Diagnosestart.
Produktzustände sind davon unabhängig; Beobachtung setzt weder Bereitschaft noch
Renderabschluss. Keine durch Diagnose anwachsenden Vollkopien.
Produktpaket, Messprogramm und Fixture getrennt identifizieren.
Umgebungs-Vorprüfung vor teurer Fixtureerzeugung; nur benötigte Fixtures erzeugen,
unveränderte Basis pro Lauf wiederverwenden. Einen gebauten Stand einmal verwenden.
Keine automatische Dauersammlung derselben nicht zuordenbaren Chromium-Traces.

### Präsentationsnachweis ohne endlose Tracesuche

Der jetzige Messcode besitzt noch keine qualifizierte Zuordnung exakter
Atlasgenerationen zur ersten nativen Präsentation. Eine neue Messung muss diese
Lücke adressieren; ein schnellerer Rechner allein behebt sie nicht.

Zulässig sind eine qualifizierte Präsentationsbeobachtung oder ein konservativer
oberer Zeitwert nach den folgenden Regeln. Eine Chromium-Trace mit nachgewiesener
Bindung von Geländegeneration und präsentierter Ausgabe ist eine mögliche
Methode, keine Pflicht. Ein gemeldeter Compositorzeitpunkt ist dabei nicht mit
dem physikalischen Pixelumschlag des Monitors gleichzusetzen; Messweg und seine
Genauigkeitsgrenze müssen ausdrücklich ausgewiesen sein.

Für R4 müssen die 20-ms-Ergebnisabstände auf echter Hardware bereits positiv
gemessen werden: richtige geänderte Geländestände im tatsächlichen Bildschirmtakt,
beispielsweise durch eine zeitlich qualifizierte Aufnahme. Ihre Zuordnung zu
ursprünglichen Eingabezeiten ist für diesen Takt noch nicht erforderlich.
CPU-/GPU-/Ressourcenbudgets und Input → Submit p95 höchstens 50 ms werden
getrennt geprüft; letzteres bleibt eine notwendige Untergrenze. Die vollständige
50-ms-Präsentationslatenz darf ausschließlich die abschließende P0-Abnahme in R5
bestätigen, nicht R4 oder eine subjektive Beobachtung flüssiger Bewegung.
Ein passender qualifizierter Präsentationsweg wird in einem eigenen begrenzten
Versuch untersucht. Nach einem nicht zuordenbaren Ergebnis keine identische
Trace-Serie wiederholen. Entweder eine konkrete neue Zuordnungshypothese prüfen
oder eine unabhängige beobachtbare Deadline verwenden.

Für die endgültige 50-ms-Grenze ist auch ein konservativer oberer Zeitwert
zulässig: Es muss nachweisbar sein, dass der richtige Kartenstand spätestens
zu diesem Zeitpunkt physisch angezeigt wurde. Das beweist dieselbe Deadline,
ohne den allerersten Präsentationsmoment auf Mikrosekunden rekonstruieren zu
müssen. Beispiel: qualifizierte Hochgeschwindigkeitsaufnahme von Bildschirm und
gemeinsam zeitlich beobachtetem Eingabesignal; Generation muss durch tatsächlichen
Geländeinhalt oder einen gemeinsam mit diesem gerenderten Prüfcode bestimmbar
sein. Auflösung, Synchronisation und Messunsicherheit vorher bestimmen und
konservativ zum Zeitwert addieren. Der ursprüngliche 50-ms-Grenzwert bleibt.

Auch die 20-ms-Ergebnisabstände benötigen eine ausreichend genaue Zeitbasis
einschließlich konservativ berücksichtigter Messunsicherheit. Für eine konservative
Dauergrenze gilt jeweils: spätestes mögliches Ende minus frühester möglicher
Beginn. Das gilt auch für M10. Die Differenz zweier oberer Zeitwerte ist keine
obere Dauergrenze; allein zwei Aussagen „spätestens sichtbar“ belegen deshalb
keinen 20-ms-Ergebnisabstand. Dafür sind beide Präsentationszeitpunkte durch
qualifizierte Zeitintervalle einzugrenzen. Ein Prüfcode muss
an die tatsächlich dargestellte Geländegeneration gebunden sein. Die negative
Kontrolle „Code oder Cursor läuft, Terrain bleibt zurück“ muss scheitern; ein
unabhängiger Bildzähler liefert keine positive Qualifikation.

CapturePage, RAF, GPU-Fence, ein getrennt aktualisierter UI-Zähler oder ein nur
geschätzter Displayzeitpunkt erfüllen das nicht. Ohne qualifizierten Nachweis
bleibt die vollständige Freigabe blockiert. Funktionale Fehler bleiben unabhängig
davon FAIL. Dieser Messauftrag erhält kein eigenes dauerhaftes Framework.

### Testarten und Befehle

Bestehende Vitest-/Playwright-Infrastruktur weiterverwenden. Für Desktopintegration
die gebaute Anwendung einschließlich Hostanbindung, Store und echten Dateien
starten. Beim Electron-Default die vorhandene Playwright-Electron-Anbindung
verwenden; bei einer Alternative deren reale native Anbindung nachweisen.
Deterministische Dateitests dürfen ausschließlich die OS-Dialogantwort ersetzen;
der nachfolgende Produktpfad bleibt echt. Sichtbare native Dialoge ergänzend bedienen.

Die folgende Tabelle beschreibt **neu herzustellende endgültige Befehle**:

| Befehl                                             | Verbindlicher Inhalt                                                                                                                                                                                |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci`                                           | Reproduzierbare Installation einschließlich erforderlicher nativer Module für die gewählte Laufzeit; beim Electron-Default Native-Rebuild                                                           |
| `npm run desktop`                                  | Neuer regulärer Desktopeditor                                                                                                                                                                       |
| `npm run check:all`                                | Typen einschließlich Desktop/Worker, Fach-/Integrations-/Budgettests, Format, Produktionsbuild, Produkt-E2E und Desktopintegration; erforderliche Checks tatsächlich übernommener nativer Fachkerne |
| `npm run test:desktop`                             | Gebaute Anwendung des gewählten Hosts mit realer Prozessanbindung, SQLite und Dateirundlauf; beim Electron-Default echter Preload/IPC                                                               |
| `npm run package`                                  | Auslieferbares Linux/RPM erzeugen; bei Forge intern `make`, nicht nur `package`                                                                                                                     |
| `npm run test:package`                             | RPM inspizieren, in geeigneter Umgebung installieren und installierten Einstieg mit Dateirundlauf prüfen                                                                                            |
| `npm run perf:atlas -- --reference <profile.json>` | M01–M10 mit festgelegtem Profil und Szenarienmanifest erfassen, Pflichtwerte bewerten und bei Nichtbestehen fehlschlagen                                                                            |

Während der Umstellung bestehende sinnvolle Checks weiter ausführen. Sobald ein
alter Pfad tatsächlich ersetzt ist, seine Implementierungschecks durch die neue
Verhaltensabdeckung ersetzen. Aktive native Fachkerne und der gewählte Host behalten
ihre erforderlichen Checks. Keine dauerhaft grünen Prüfungen gegen ungenutzte Software.
CI bleibt auf den exakten Kandidaten gebunden und prüft Paketbau. Installation
und Hardwaremessung können eigene Umgebungen benötigen; fehlende Abnahmen offen
ausweisen, nicht als erfolgreichen Teil der CI interpretieren.

## 7. Arbeits- und Abnahmematrix

Nur Paketstatus und Verweise hier pflegen. Commit, Prüfzahlen, Messwerte und
konkrete Fehler stehen ausschließlich im [Status](status.md). Historische
Rohbelege werden nicht umgeschrieben.

| Paket | Umfang                                                                  | Status / Nachweis                                                                                                                                |
| ----- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| K1–K6 | Begrenzte Konsolidierung aus Abschnitt 5.                               | Implementiert; genaue Nachweis-/CI-Grenze im Status.                                                                                             |
| P0    | Höhenversuch P0a–P0f, Korrektur R1–R5, D10/D11 und native Höhenabnahme. | R1 wählt C1; R2 und R3 sind funktional integriert, die Leistungsabnahme bleibt offen. Aktuelle Belege im Status; R4/R5 und native Abnahme offen. |
| P1    | Gemeinsamer Kern für F01–F19, A02–A06/D01/D02.                          | Offen; nach positivem R4 nur benötigte P3-Erweiterungen, weiterer Ausbau erst nach P0 und P3.                                                    |
| P2    | F19, A07 und vollständige Projektdateien.                               | Offen; neue P3-Quellen sofort in den vorhandenen Dateipfad aufnehmen.                                                                            |
| P3    | F01–F04/F18-Basis, Mehrskaligkeit, Konkurrenz, D03 und M10-Teilfälle.   | Offen.                                                                                                                                           |
| P4    | F04–F07, D01/D02 und komplette Flächenwerkzeuge.                        | Offen.                                                                                                                                           |
| P5    | F08–F12/D04: Straßen, Parzellen und Außenhäuser.                        | Offen.                                                                                                                                           |
| P6    | F02/F12–F14: hauslokale Innenräume.                                     | Offen.                                                                                                                                           |
| P7    | F09/F16/F17/D03: Gewässer und Nachführung.                              | Offen.                                                                                                                                           |
| P8    | F03/F15/F18: Regionen, Bedienung und Kartografie.                       | Offen.                                                                                                                                           |
| P9    | F01–F19 integriert, M01–M10, RPM, Altpfadabbau und Doku.                | Offen.                                                                                                                                           |

## 8. Definition von „erledigt“

- [ ] Ein wirksamer Zustand je Einstellung und ein genutzter Daten-/Renderpfad je
      Zweck; ersetzte APIs, Adapter, Schattenzustände und Spiegeltests entfernt.
- [ ] Ein Szenarioablauf und ein gespeichertes Ergebnis je Fall; kurze Probe und
      vollständige Abnahme verwenden dieselben Regeln. Teil-/Fehlerfälle werden
      sofort sichtbar, Diagnose belastet den normalen Produktstart nicht.
- [ ] F01–F19 vollständig auf dem neuen aktiven Pfad umgesetzt und geprüft;
      D01–D11 ausdrücklich im neuen Produktvertrag beschrieben.
- [ ] Eine abgeleitete lokale Freigabe verbindet tatsächlich dargestelltes Terrain
      und benötigte Quellen. Warte-/Fehlerzustand ist sichtbar; frühe Eingaben
      erzeugen weder unsichtbare Änderungen noch späteres Replay. Kurze gültige
      Klicks, Halten und fortlaufende Rückmeldung behalten ihre Wirkung. Eigene
      ausstehende Darstellung löscht keinen normalen Weg/Endpunkt; die lokale
      Wirkungsschranke umfasst auch angenommene Restarbeit. Nach Up keine neuen
      Beiträge; vollständige übernommene und dargestellte Aktion innerhalb des
      Abschlussbudgets. Danach keine späte Autorenmutation. Ein Undo und Save
      enthalten den ganzen Strich. Unabhängige Raum-/Zeitwirkung und Ergebnistakt
      sind positiv nachgewiesen.
- [ ] Welt→Raum→Welt, Grob-/Feinbearbeitung, Undo/Redo und Reopen funktionieren
      zusammen; die erste Demo wurde zum vollständigen Produkt ausgebaut.
- [ ] Kamerabewegung benötigt weder Quellenmutation noch synchronen Speicher-/
      Fachauftrag; normale lokale Werkzeuge erreichen den Zeitvertrag auch unter
      Hintergrundlast. Kalte Navigation erreicht sichtbare Bearbeitbarkeit und erstes
      exaktes Ergebnis innerhalb der M10-Grenzen.
- [ ] Reine lokale Reads warten nicht auf den Abschluss asynchroner Save-
      Dateioperationen; gespeicherter Snapshot, Sessiongrenzen und lokale Patches
      bleiben korrekt. Der Nachweis läuft über den echten Dispatcher.
- [ ] Sparse-Daten, räumliche Auswahl, begrenzte aktive Darstellung und
      Speicher-/Jobbudgets auch bei großen gespeicherten Welten nachgewiesen.
- [ ] M01–M10 und alle erforderlichen Fach-/Fehler-/Dateifälle am endgültigen
      Stand verifiziert; Messfehler oder fehlende Werte führen zentral zu Fehler.
- [ ] Neue Desktopanwendung regulärer Einstieg; gebautes RPM installiert und
      ohne Entwicklungsserver bedient, echte Dateiabläufe und Dialoge geprüft.
- [ ] Tatsächlich ersetzte Host-/Rust-Dokument-/Canvas-/JSONL-Pfade und ihre
      ungenutzten Abhängigkeiten entfernt; nach A01/A08 bewusst gewählte aktive
      Module geprüft. Keine dauerhafte Übergangsdoppelarchitektur.
- [ ] README, Architektur, Produktvertrag, aktueller Status und dieser Plan
      widersprechen sich nicht; Rohbelege bleiben außerhalb der Produktdokumente.
- [ ] Repo-Gates am aktuellen Kandidaten erfüllt und reguläre Integration abgeschlossen.

Eine externe Integrationsblockade lässt dieses letzte Kriterium sowie P9 und den
Gesamtauftrag offen beziehungsweise `blockiert`. Der Kandidat kann trotzdem als
vollständig implementiert und geprüft bezeichnet werden; der Gesamtauftrag ist
damit noch nicht erledigt.

Fehlende native Umgebung oder kein qualifizierter Präsentationsbeleg, auch nicht
als konservative Deadline nach Abschnitt 6, bedeutet
`blockiert`; ein gemessen verfehltes Inhalts-, Budget- oder Zeitziel bedeutet
`FAIL`. Beide Zustände können zugleich bestehen. Keiner bedeutet „fertig, nur
noch manuell testen“. Nach bestandenen Kriterien abschließen, ohne weitere
optionale Features oder Optimierungsrunden anzuhängen.

## 9. Quellen und Lesereihenfolge

### Repository

1. [AGENTS.md](../../AGENTS.md): Daten-/Kompatibilitäts- und Dokumentationsregeln.
2. [README](../../README.md): aktuelle Befehle und Auslieferung.
3. [Produktvertrag](../product-contract.md): aktuelles beobachtbares Verhalten.
4. [Architektur](../architecture.md): aktuelle Besitzer und ersetzte Pfade.
5. [Status](status.md): aktueller Prüfstand und nächste Übergabe.
6. [Unveränderlicher Ausgangsvertrag](https://github.com/ThonkTank/Salt-Marcher/blob/1bb3932fcffcb2d5fea47fae616c3b69489443bc/docs/product-contract.md): Inventar für F01–F19, auch nachdem die aktuellen Docs umgestellt wurden.

### Primärquellen für Ansatz und Auswahl

Am 8. November 2026 geprüft; bei P0 die konkret verwendeten Versionen abgleichen.
Diese Quellen belegen Bibliotheksfunktionen, keine SaltMarcher-Latenzen.

- [PixiJS-Renderer](https://pixijs.com/8.x/guides/components/renderers) und
  [Culling](https://pixijs.com/8.x/guides/components/application/culler-plugin).
- [PixiJS: Render Groups](https://pixijs.com/8.x/guides/concepts/render-groups) und
  [Performancehinweise](https://pixijs.com/8.x/guides/concepts/performance-tips):
  wiederverwendbare Darstellung und eigene Verantwortung für Arbeitsgrenzen.
- [OpenLayers: ebene Bildkoordinaten](https://openlayers.org/en/latest/examples/static-image.html),
  [WebGL-Kacheln](https://openlayers.org/en/latest/examples/webgl-tiles.html) und
  [MapLibre: experimentelle eigene Koordinatensysteme](https://maplibre.org/maplibre-gl-js/docs/guides/custom-crs/):
  Vergleichsmöglichkeiten, keine Empfehlung für einen zusätzlichen Produktionspfad.
- [Tauri-Prozessmodell](https://v2.tauri.app/concept/process-model/):
  plattformeigene Webviews und alternative Hostanbindung.
- [Electron-Prozessmodell](https://www.electronjs.org/docs/latest/tutorial/process-model),
  [Utility-Prozess](https://www.electronjs.org/docs/latest/api/utility-process),
  [Performance](https://www.electronjs.org/docs/latest/tutorial/performance) und
  [native Node-Module](https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules).
- [Electron-Sicherheitsgrenzen](https://www.electronjs.org/docs/latest/tutorial/security).
- [Electron Forge: RPM](https://www.electronforge.io/config/makers/rpm) und
  [Konfiguration/Rebuild](https://www.electronforge.io/config/configuration).
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) und
  [Workerhinweise](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/threads.md).
- [JSTS](https://github.com/bjornharrtell/jsts), [Module](https://bjornharrtell.github.io/jsts/index_modules.html)
  und [RBush](https://mourner.github.io/rbush/).
- [Playwright: Electron](https://playwright.dev/docs/api/class-electron).
- [Geometry Clipmaps](https://hhoppe.com/proj/geomclipmap/): Hintergrund zu
  begrenzten mehrstufigen Darstellungen; kein vorgeschriebener 3D-Renderer.

- [WebGL 2.0: Sync Objects](https://registry.khronos.org/webgl/specs/latest/2.0/#3.7.14):
  nicht blockierendes Fence-Polling und Rückkehr zum Eventloop; ein GPU-Abschluss
  ist kein physischer Präsentationsbeleg. Für die Planung am 9. November 2026 geprüft.

### Recherchierte Vorbilder und Grenzen ihrer Übertragung

Am 9. November 2026 anhand der folgenden Primärquellen geprüft.
Die Architekturentscheidung übernimmt konkrete Mechanismen; keine Quelle
qualifiziert SaltMarchers vollständige Funktionsmatrix oder seine Zeitgrenzen.

| Vorbild                                                                                                                                                                                                     | Tatsächlich belegter Mechanismus                                                                                                                                                | Übertragung und Grenze                                                                                                                                                                                                                                                                                 |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [Treib et al., Interactive Editing of GigaSample Terrain Fields, 2012](https://www.cs.cit.tum.de/fileadmin/w00cfj/cg/Research/Publications/2012/Terrain_Editing/eg12terrainedit.pdf)                        | Mehrskalige GPU-Kacheln, unmittelbare grobe Nachführung, bedarfsweise feinere Nachführung; Demonstration mit 4,9 Milliarden Höhensamples.                                       | Positiver Existenznachweis für interaktive große Terrainbearbeitung. Die berichteten 15–20 ms betreffen Rendering auf einer GTX 580, nicht unseren Input→Präsentation-Vertrag. Lange aufgeschobene Operationsfolgen bleiben teuer. Kein Auftrag, CUDA, Codec oder vollständigen Renderer zu portieren. |
| [Atlan/Garland, Interactive Multiresolution Editing and Display of Large Terrains, 2006](https://onlinelibrary.wiley.com/doi/10.1111/j.1467-8659.2006.00936.x)                                              | Getrennte Mehrskalenrepräsentation für Bearbeitung und ansichtsabhängige Darstellung.                                                                                           | Stützt die Trennung von Autoren und Darstellung. Geprüft wurde die veröffentlichte Zusammenfassung; kein hier ausgewerteter zusätzlicher Volltextbenchmark.                                                                                                                                            |
| [libmypaint 1.6.0, mypaint-brush.c](https://sources.debian.org/src/libmypaint/1.6.0-2/mypaint-brush.c/)                                                                                                     | legacy_dab_count/state_based_dab_count addieren distanz-/radiusabhängige und zeitabhängige Stempelzahl; Restanteile werden weitergetragen.                                      | Vorbild für C0. Höhen-Normierung und unsere lokale Wirkungsschranke sind eigene Aufgaben; ein vorausbezahltes Konto je Höhenwert folgt daraus nicht.                                                                                                                                                   |
| [Krita: Strokes](https://docs.krita.org/en/untranslatable_pages/strokes_documentation.html) und [endPaint im Quellcode](https://github.com/KDE/krita/blob/master/libs/ui/tool/kis_tool_freehand_helper.cpp) | Geordnete Mal-/Abschlussaufgaben und getrennte Projektionsaktualisierung; Eingabeende stoppt Airbrush und beendet die Stroke-Zufuhr, ohne alle Maljobs im Handler abzuarbeiten. | Vorbild für versiegelte Eingabe und geordneten Abschluss. Kein Bedarf für eine allgemeine Jobengine und kein Nachweis unserer Abschlusslatenz.                                                                                                                                                         |
| [Chromium: How cc Works](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/docs/how_cc_works.md)                                                                                             | Aktiver und ausstehender Darstellungszustand, begrenzte Übergaben und ersetzbare noch unbegonnene Rasterarbeit.                                                                 | Stützt den begrenzten Renderstand und neuesten Folgewunsch. Fachliche Pinseloperationen bleiben erhalten. Die konkreten zwei GL-Slots und Paketzeiten sind zu prüfende Atlas-Entscheidungen.                                                                                                           |
| [W3C Pointer Events](https://www.w3.org/TR/pointerevents/latest/)                                                                                                                                           | getCoalescedEvents liefert zusammengefasste echte Eingabesamples; Elternereignis und Einzelpunkte nicht doppelt verarbeiten.                                                    | Vollständige Polylinie erfassen und danach definiert resampeln. Vorhersagen werden keine Autorenwahrheit.                                                                                                                                                                                              |
| [Krita: Instant Preview](https://docs.krita.org/en/reference_manual/instant_preview.html)                                                                                                                   | Geringer aufgelöste Rückmeldung parallel zur vollständigen Berechnung, mit dokumentierten Werkzeug-/Zoomgrenzen.                                                                | Eigenständige Produktoption, nicht Teil der jetzigen Korrektur. Eine angenäherte Vorschau erfüllt die geforderte exakte Live-Rückmeldung nicht.                                                                                                                                                        |
| [Terrain3DData](https://terrain3d.readthedocs.io/en/latest/api/class_terrain3ddata.html)                                                                                                                    | Viele Änderungen direkt an Regionsbildern bündeln und nur geänderte Regionen aktualisieren.                                                                                     | Vorbild für räumliche Arbeitsbegrenzung; kein Beleg gleicher Autorenauflösung, Weltgröße oder Latenz.                                                                                                                                                                                                  |

Die additive Autorenrepräsentation wird durch diese Recherche gestützt, nicht
mit einer fremden Implementierung gleichgesetzt. Ebenso sind die örtliche
50-ms-Wirkungsschranke, Quellenreservierung und qualifizierter Präsentationsnachweis
eigene Nachweispflichten. Fehlende Gegenbeispiele und die Existenz ähnlicher
Programme ersetzen R1–R5 nicht. Gewählte GPU-/CPU-/Speichergrenzen bleiben
Messgegenstände; sie sind keine aus den Quellen abgeleiteten Garantien.

### Quellen des bislang nicht qualifizierten Präsentationswegs

Die im bisherigen Versuch verwendete Laufzeit ist **Electron 44.10.2 /
Chromium 152.0.7977.169**. Die fehlende Copy-/Generationsbindung steht im
[Status](status.md). Diese Quellen erklären die vorhandene Diagnose, belegen
aber keine funktionierende Atlas-Zuordnung. Der neue begrenzte Messauftrag und
eine zulässige unabhängige Deadline stehen in Abschnitt 6:

- [Chromium: DevTools-Tracebilder](https://github.com/chromium/chromium/blob/152.0.7977.169/content/browser/devtools/protocol/tracing_handler.cc):
  Bild und Framekennungen; `expected_display_time` ist nur geschätzt.
- [Chromium: Capturemetadaten](https://github.com/chromium/chromium/blob/152.0.7977.169/components/viz/service/frame_sinks/video_capture/frame_sink_video_capturer_impl.cc):
  Kennungen aus `begin_frame_ack`; Copy-/Refreshpfade müssen eindeutig zugeordnet sein.
- [Chromium: Surface-Aggregation](https://github.com/chromium/chromium/blob/152.0.7977.169/components/viz/service/display/surface_aggregator.cc)
  und [aktiver Renderpass](https://github.com/chromium/chromium/blob/152.0.7977.169/components/viz/service/surfaces/surface.cc):
  Aufnahme von Copyanforderungen während der Aggregation.
- [Chromium: Präsentationsberichte](https://github.com/chromium/chromium/blob/152.0.7977.169/cc/metrics/compositor_frame_reporter.cc):
  Framequelle/-sequenz, Renderer-/Surface-/Displaykennungen und Präsentationszustand.
- [Electron: FrameSubscriber](https://github.com/electron/electron/blob/v44.10.2/shell/browser/api/frame_subscriber.cc):
  Die JavaScript-Bildsubscription liefert keinen vollständigen Präsentationsbeleg.
