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
Arbeitsbaum sauber; keine Quellveröffentlichung. Seine Abschlussprüfung wurde
mit Exit 75 wegen des belegten QA-Slots abgewiesen. Die vorhandenen 0.99.0-
Builddateien belegen diesen neueren Stand nicht. Er wartet auf den nächsten
freien Slot, anschließend bleibt ein frischer unabhängiger Zieltest nötig.

Ein frischer Original-Obsidian-Vergleich läuft. Der frühere
erfolgreiche native UI-/Save-/Fresh-Pilot und unveränderte Programm-/Ressourcen-
hashes sind vorhanden. Die Trialreservierung wurde wegen der belegten
Kapazität abgewiesen; die Leitung legte versehentlich trotzdem den technischen
Vorbereitungschat an. Nach tatsächlichem Abschluss des nativen Falls gelang
die reguläre Reservierung für genau diesen vorhandenen frischen Chat.
Nach tatsächlicher Slotfreigabe erhielt er ausschließlich denselben öffentlichen
PREPARE-Inhalt; Original-Obsidian zeigt die lokale Vault-Anlage. Zwei technische
Fehlstarts bleiben erhalten: zunächst kein Start wegen Sandbox-Lock, danach
geschlossene Wrapper-Eingabe ohne gestartetes Produkt. Der unveränderte Operator
läuft nun mit offenem Terminal. Keine manuelle Kapazitätsänderung und kein
Ersatzchat. PLAY und RESUME folgen an natürlichen Grenzen im selben Chat,
ohne vorherige Produktberichte oder Lösungswege. Der Cloud-Browserpilot bleibt
mangels auflösbarer Gesprächs-ID unbestätigt.

Rabenfurt braucht noch eigene praktische Konkurrenz- und einfachste
Alternativabläufe. Es gibt keine qualifizierte Zeit-/Klickauswertung,
kontrollierte Überlegenheits- oder menschliche Belastungsaussage. Insbesondere
werden alte Produkt- und neue Textspuren nicht numerisch gegeneinander gewertet.
Originalberichte, Frames, Receipts, Fehler und nächste Schritte bleiben mit
Version/Herkunft im lokalen Live-Ledger; private Profile und Kampagnendaten
werden nicht veröffentlicht. Die Entwicklung läuft ohne QA-Freeze weiter.
