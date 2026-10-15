# GM-UX-QA: belegter Stand am 15.10.2026

GRAPH-RETEST-01 bestätigte auf dem festen lokalen Build 0.79.0
(`a112dc17dbaa3e61905628a08dd723ceff0bdb72`) lesbare vollständige Namen,
Inhaltszahlen, Auswahl, Raumöffnung, Einpassen, Zoom, Kategorien und normales
Wiederöffnen eines kleinen Dreiknoten-Dungeons. Die öffentlichen Exporte vor
und nach Fresh waren bytegleich. Raumplatzierung, zunächst leere
Verbindungslisten, ein verdeckter Entwurfshinweis und wechselnde gestrichelte
Kanten bleiben getrennte Fragen; große Graphen und aktuelle Releases sind
nicht abgenommen.

HANDOUT-RETEST-01 bestätigte auf dem festen lokalen Build 0.80.0
(`93f77bdfbc6fb0cd75abd6fc1ce173147d92ae5f`) explizite Bildfreigabe ohne
Figuren im tatsächlichen Spielerfenster und der Vorschau, normales Fresh,
Blank, erneute Freigabe und Kampagnenwechsel ohne das erste Bild.
Der voreingestellte Ortsbildimport scheiterte nach Dateiauswahl zunächst mit
„Bildziel fehlt.“; „Freies Bild“ ermöglichte den Import. Diese Auffindbarkeit
muss am aktuellen Stand reproduziert werden. Keine allgemeine Privacy- oder
Releaseabnahme. Beide lokalen Quellkorrekturen bleiben unveröffentlicht.

MD-MUEHLENAU-01 führte Vorbereitung, Spielleitung und Wiederaufnahme im selben
frischen Testerchat mit originalem KWrite 26.08.1 vollständig aus. GM-Notiz,
schematische Karte, getrenntes Handout, Unterbrechungsnotiz und fortgeschriebener
Spielstand waren nach normalem Close/Fresh erhalten. Kein blockierender Fehler
oder Inhaltsverlust beobachtet. Manueller Abgleich zwischen Karte, Notizen und
Spielstand sowie erneutes Dateiöffnen und Suchen blieben nötig. Finale Dateien,
Originalframes und normale Abschlüsse wurden geprüft, der fertige Chat
archiviert. Die einfache Textlösung ist für diesen kleinen Fall praktisch
brauchbar; ein Vorteil des Dungeon Editors folgt daraus nicht.

Eine zu breite UI-only-Anweisung führte anfangs auch zum Tippen des technischen
QA-Berichts in KWrite. Das wurde präzisiert: nur eigentliche GM-Unterlagen
müssen über die Produkt-UI entstehen. Die früheren Dokumentationsschritte
bleiben in der Rohspur und zählen nicht als gewöhnliche GM-Arbeit.

RABENFURT-SOURCE-01 nutzt einen neuen unabhängigen Tester und den eigenen festen
Build 0.94.0 aus `696417e5a59c4ec33482b8d93dbe854b744e3bc5`. Originalbuild
und Runtime wurden in einem einzelnen geschützten Job gebaut; alle 112
registrierten Dateihashes wurden geprüft. Die native Vorbereitung ergab drei
nutzbare manuelle Szenen und eine übersichtliche GM-Mappe mit getrenntem
Vorlese-/GM-Text. Wiederholte Frist- und Wegeangaben sind die gewählte
Organisation des Testers, kein Nachweis fehlender Verweisfunktionen. Lange
Bearbeitungsseiten und Positionswechsel führten laut Bericht zu korrigierten
Fehlbedienungen. Die getrennte Ursachenprüfung steht unten; der feste Messbuild
bleibt unverändert. PLAY ist gespeichert:
Die geänderte Abfahrt wurde mehrfach nachgezogen, die unterbrochene Notiz
blieb erhalten. Zum Schreiben musste die lesende Mappe geschlossen werden;
beim Wiederöffnen begann sie beim ersten Besuch und hatte eine andere Auswahl
als der Editor. Das sind Bedienkosten, kein belegter Datenverlust. Der Tester
leitete aus Mappe und manuellen Notizen, ohne native LiveSession. Auch RESUME
ist abgeschlossen: geänderte Abfahrt, Gruppenort, Gegenstände, Notiz und
Geheimnisgrenzen waren nach Fresh erhalten. Nach der letzten Ergänzung gab
es sichtbare Speicherbestätigung und normalen Close, keinen zusätzlichen
Fresh-Nachweis genau dieser Ergänzung. Der terminale Originalrun und ein
passender Abschlussframe wurden geprüft; der fertige Chat ist archiviert.
Nicht eingegebene aktuelle Uhrzeit und Reisezeiten bleiben ausdrücklich
unbekannt. Dies ist keine native LiveSession-/Weltzeit- oder Gesamtproduktabnahme.

Ein optionaler weiterer Markdown-Export wurde automatisch abgelehnt, weil
„GM-Unterlagen ausschließlich innerhalb“ als Exportverbot ausgelegt wurde.
Der Speicherdialog wurde abgebrochen, ohne Ersatz oder Retry. Normal
gespeicherter Produktstand und UI-Belege erlauben die Wiederaufnahme.
Ablehnung und Umwege bleiben technische Ablaufkosten, kein Produktfehler
oder erfolgreicher Export.

Der enge Quellauftrag reproduzierte auf 0.99.0 (`fee0d71c`) die weit getrennten
Kernfelder, Fokus vor dem fertigen Szenenrender und den verlorenen Mappenbesuch.
Ein lokaler Patch (`f2ea4934`) verkleinert das vergrößerbare Notizfeld, wartet
vor Fokus auf das Rendern und verbindet Mappe und richtigen Szeneneditor direkt.
Drei Regressionen scheitern vorher; alle 14 gezielten Tests, Desktop-Typprüfung
und Desktopbuild bestehen danach. Die allgemeine Typprüfung enthält vorher
und nachher dieselben 35 bestehenden Testdiagnosen. Vorher-/Nachher-/Fresh-Frames
und normale Abschlüsse sind gesichert; die Leitung prüfte Originalhashzuordnung
und sichtbare Kernfelder nach Fresh. Kein Autosave-Sprung bei ruhender UI
reproduziert; veraltete Scrollbilder erklären einen Teil der Fehlklicks.
Nicht jede ursprüngliche Fehlaktion ist damit erklärt.

Der Patch ist auf 0.100.0 (`12d34599`) als lokaler Commit `85255c4a` übertragen.
Arbeitsbaum sauber; keine Quellveröffentlichung. Der erste Abschlussprüfstart
wurde mit Exit 75 wegen des belegten Slots abgewiesen; nach normalem
Obsidian-PLAY-Abschluss wurde die Prüfung ausgeführt. Drei Vorherfehler,
46 bestandene Nachhertests, beide Typprüfungen und eigene Desktopbuilds sind
belegt. Native Vorher-/Nachher-/Fresh-Läufe bestätigen Auswahl, direkten
Bearbeitungsweg, sichtbare Kernfelder, Tastaturwechsel und gespeicherte Texte.
Die Leitung prüfte Build-/Quellidentitäten, originale normale Abschlüsse und
den sichtbaren Fresh-Stand. Der abgeschlossene Implementiererchat ist archiviert;
Build und Belege bleiben erhalten. MANUAL-SCENE-RETEST-01 bestätigte unabhängig
den richtigen Editor mit sichtbaren Kernfeldern sowie geänderte zweite und neue
dritte Szene nach Fresh. Zwei Starts passen zu den sieben Buildidentitäten;
ausgewählte Originalbilder und normale Abschlüsse sind geprüft, der fertige
Chat archiviert. Offen bleiben der Rückweg zur Lesemappe und erneute Bereichswahl
nach Neustart. „Zum Leiten öffnen“ führte zur Partyansicht. Eine neue enge
Quelluntersuchung prüft diesen Rückweg zunächst leicht am aktuellen Stand;
keine allgemeine Navigationserneuerung. Unklare anfängliche Fokus-/Bildverzögerungen
werden weiter nicht als bewiesener Produktfehler oder Datenverlust gewertet.

Der Original-Obsidian-Vergleich ist abgeschlossen. Der frühere
erfolgreiche native UI-/Save-/Fresh-Pilot und unveränderte Programm-/Ressourcen-
hashes sind vorhanden. Die Trialreservierung wurde wegen der belegten
Kapazität abgewiesen; die Leitung legte versehentlich trotzdem den technischen
Vorbereitungschat an. Nach tatsächlichem Abschluss des nativen Falls gelang
die reguläre Reservierung für genau diesen vorhandenen frischen Chat.
Nach tatsächlicher Slotfreigabe entstand aus demselben öffentlichen PREPARE-
Inhalt ein nutzbarer eigener Vault: Übersicht, verlinkte Ortsnotizen, Wegskizze,
GM-Geheimnis, Originalquelle und ausdrücklich ungespielter Stand. Suche liefert
Kontextausschnitte; Vorlage, Vorbereitung und tatsächlicher Stand bleiben
redaktionell zu unterscheiden. Eine wegen verzögerter Beobachtung zu früh
wiederholte Eingabe wurde sichtbar bereinigt. Ursache zwischen Produkt und
Transport ungetrennt, keine gemessene Latenz. Die Leitung prüfte ausgewählte
Datei-/Framehashes, die sichtbare Übersicht sowie normale App-/Umgebungsabschlüsse
und Checkpoint. PLAY ist ebenfalls abgeschlossen: geänderte Abfahrt in aktiven
Notizen, historische Quelle gekennzeichnet, begonnene Mara-Notiz nach Schal-
Suche fortgesetzt, Laterne zurückgegeben und tatsächlicher Wissensstand notiert.
Die Leitung prüfte ausgewählte Originalidentitäten, sichtbaren Spielstand und
fortgesetzte Notiz sowie normalen Close. Suchausschnitte enthalten auch GM-
Geheimwissen; die Spielerantwort blieb begrenzt. Keine Spieleranzeige geprüft.
RESUME bestätigte den gespielten Stand anhand der frisch geöffneten Notizen.
Notiztabs und Suche wurden wiederhergestellt; Orte, Zeitanker und geheime
Besitzerzuordnung wurden nachgelesen. Keine Sachkorrektur nötig. Die Rückkehrfrage
blieb mangels aktueller Uhrzeit/Reisedauern ehrlich zeitlich unentscheidbar;
keine Reise wurde hinzuerfunden. Die letzte Antwort wurde gespeichert und normal
geschlossen, ohne zusätzlichen Fresh genau dieser letzten Ergänzung. Originale
Datei-/Frameidentitäten und der terminale Normalabschluss wurden geprüft;
der tatsächlich fertige Chat ist archiviert. Das ist ein praktisch nutzbarer
vollständiger Notizablauf, kein menschlicher Belastungs- oder Geschwindigkeitsbeweis.
Keine früheren Produktberichte oder Lösungswege an den Tester.

Zwei technische Fehlstarts bleiben erhalten: Sandbox-Lock ohne Jobstart und
geschlossene Wrapper-Eingabe ohne Produktstart. Cleanup des wartenden Services
erfolgte einmal über dessen bestehende Queue statt stdin; danach lief der
unveränderte Operator regulär mit offenem Terminal. Keine manuelle
Kapazitätsänderung und kein Ersatzchat. Der Cloud-Browserpilot bleibt
mangels auflösbarer Gesprächs-ID unbestätigt.

MD-RABENFURT-01 hat denselben vollständigen öffentlichen Fall im originalen
KWrite abgeschlossen: eine frei organisierte Markdown-Datei, Ersetzen der
wiederholten Abfahrtsangaben, Schal-Suche und Rückkehr zur begonnenen Notiz.
Nach Fresh waren Verlauf und Wissensgrenzen erhalten; keine Inhaltsreparatur
nötig. Dokumentanfang, Suche nach dem aktuellen Stand und manuelle Trennung
von Ausgangslage/Verlauf blieben Bedienarbeit. Die Rückkehrfrage blieb ohne
erfundene Zeit/Reise ehrlich offen. Finale Dateihashes, passende Originalframes
und alle drei normalen Appabschlüsse samt terminalem Run wurden geprüft;
der tatsächlich fertige Chat ist archiviert. Die letzte Antwort wurde normal
gespeichert/geschlossen, ohne zusätzlichen Fresh genau dieser letzten Ergänzung.
Öffentliche Folgeziele wurden nach den normalen Abschnittsabschlüssen gelesen;
die bedingte Freigabe vermied reines Warten auf die Leitung. Reihenfolge bleibt
dokumentiert, ohne einen Zeitvergleich aus den unterschiedlichen Pausen abzuleiten.

Die kleine narrative Aufgabe ist damit auch mit der einfachsten Textlösung
praktisch brauchbar; ein Produktvorteil unseres Editors ist nicht belegt.
QA-READER-RETURN-01 hat den Leserückweg auf festem 0.107.0 (`7af612c8`)
reproduziert und lokal korrigiert (`d3f3ed81`). Der Editor bietet nun den direkten
Rückweg zur gerade bearbeiteten Lesestelle. Eine weiterhin passende Suche bleibt
erhalten; eine nicht mehr passende Suche verdeckt das Ziel nicht. Der Teststand
enthält die frühere kompakte Feld-/Fokuskorrektur unter Erhalt der neueren
Vorbereitungsfunktionen. 87 gezielte Tests, Desktop-Typprüfung und Desktop-Build
bestanden. Native Vorher-/Nachher-/Fresh-Prüfungen endeten normal; frühere
Fixture-/Scrollfehler bleiben in den Rohbelegen erhalten. Die Leitung prüfte
15 tatsächliche Builddateien, neun Ergebnisdateien, zehn ausgewählte Original-
Bildpaare sowie die normalen Abschlüsse. Das ist lokale Implementierungsprüfung,
keine unabhängige Gesamt- oder Releaseabnahme; keine dauerhafte Such-/Lesemarke
nach Neustart und kein vollständiger Live-Spielverlauf daraus abgeleitet.
Der abgeschlossene Umsetzungschat ist nach Ergebnissicherung archiviert.

RABENSTEG-NATIVE-01 ist auf genau diesem unveränderten lokalen Build reserviert,
einem frischen Chat zugeordnet und gestartet. Projekt-/Sidebarzugehörigkeit
wurde geprüft. Der zusammenhängende Fall untersucht ausdrücklich native Party-,
Planungs- und Live-Zustände sowie Lesen/Bearbeiten/Weiterlesen. Der Tester erhält
nur öffentliche Ziele, eigene Daten und normale UI. Spätere Spielsituationen
werden erst nach gesicherten normalen Abschnittsabschlüssen gelesen; keine
Wartefreigabe oder formale Zeitmessung. Ergebnis und unabhängige Bestätigung
stehen noch aus. Der Entwicklungsstand bleibt frei veränderbar; die Testkopie
wird weder aktualisiert noch neu gebaut. PREPARE ist inzwischen normal gesichert
und geschlossen: vier aktive Figuren mit HP/XP, eine inaktive Figur und drei
vorbereitete Szenen. Der frische Tester änderte Miras Vorlesetext und las an
derselben zweiten Besuchsstelle weiter. Die Leitung prüfte den passenden
Originalframe mit getrenntem GM-Block und normalen Prozessabschlüssen. Die
gesicherte Ereigniskopie ist der exakte PREPARE-Präfix des bei PLAY fortgesetzten
Originalruns; eine anfängliche Gleichheitsprüfung des ganzen, inzwischen länger
gewordenen Runs wurde entsprechend korrigiert. PLAY läuft: native Teilgruppen,
Uhren und Figurenwerte werden benutzt, während Orte und Wissensstände teilweise
als freie Notizen geführt werden. Das sind Zwischenbeobachtungen; Wiederaufnahme
und Korrektur der Belohnung sind noch nicht abgeschlossen. Lange Partyformulare
erzeugen laut Tester Scroll-/Sucharbeit; die Ursache beobachteter Fehlziele ist
zwischen bewegtem Formular und verspäteter Beobachtung noch nicht getrennt.

Für denselben ganzen Fall liegt ein öffentlicher einfacher Textauftrag bereit,
ohne vorgegebene Dateistruktur oder native Funktionen. Fakten und spätere
Spielsituationen sind identisch, die Organisation bleibt frei. Noch kein
Texttrial reserviert oder gestartet; keine zusätzliche laufende QA-Last. Damit
bleibt der Vergleich der nativen Zustandsarbeit mit einfachster brauchbarer
Alternative offen, statt aus dem früheren Erzählfall übertragen zu werden.
Dungeon Editor 0.94.0 und Original-Obsidian erhielten den gespielten narrativen
Stand nach Fresh. Obsidian stellte Tabs/Suche wieder her, während der erste
Editorlauf manuell aus „Karte und Keys“ zurücknavigierte. Das ist eine konkrete
Frage für aktuelle Wiederaufnahme-UX, kein kontrollierter Kostenvergleich der
verschiedenen selbst gewählten Organisationen. Es gibt keine qualifizierte Zeit-/Klickauswertung,
kontrollierte Überlegenheits- oder menschliche Belastungsaussage. Insbesondere
werden alte Produkt- und neue Textspuren nicht numerisch gegeneinander gewertet.
Originalberichte, Frames, Receipts, Fehler und nächste Schritte bleiben mit
Version/Herkunft im lokalen Live-Ledger; private Profile und Kampagnendaten
werden nicht veröffentlicht. Die Entwicklung läuft ohne QA-Freeze weiter.
