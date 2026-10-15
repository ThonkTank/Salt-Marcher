# Gezielte native Nachprüfungen

Der frische unabhängige Lauf GRAPH-RETEST-01 prüfte den unveränderten lokalen
Desktopbuild 0.79.0 aus `a112dc17dbaa3e61905628a08dd723ceff0bdb72`.
In einem selbst angelegten kleinen Dungeon blieben vollständige längere Namen,
Inhaltszahlen und Verbindungszuordnung lesbar. Auswahl, Raumöffnung, Einpassen,
Zoom, Kategorienwechsel und normales Schließen/Wiederöffnen funktionierten.
Die beiden öffentlichen UI-Exporte waren bytegleich (SHA-256
`3774ae311d2b6c5be0495977ff350f855b8e853afe743fbf170823395417368e`).
Zwei normale Produktabschlüsse mit Exit 0 und ohne verbleibende Produktprozesse
sowie der normale Abschluss der eigenen Umgebung sind aufgezeichnet.

Die Probe bestätigt nur diesen kleinen lokalen Beschriftungsfall. Sie ist keine
Abnahme großer Graphen, des aktuellen Integrationsbuilds oder der gesamten
Graphbedienung. Unabhängig beobachtet wurden überlappende neue Raumkonturen,
unerklärte leere Verbindungslisten vor der Volumenübernahme, ein verdeckter
Entwurfshinweis und ein ungeklärter Wechsel zu gestrichelten Kanten nach einer
Inhaltszuordnung. Ein direkter Verbindungseditor war aus dem Graphen nicht
auffindbar. Diese Punkte benötigen gezielte Prüfung am aktuellen Produktstand;
sie werden nicht automatisch der Beschriftungskorrektur zugerechnet.

HANDOUT-RETEST-01 lief mit einem weiteren frischen Tester auf dem unveränderten
lokalen Build 0.80.0 aus `93f77bdfbc6fb0cd75abd6fc1ce173147d92ae5f`
erfolgreich durch: explizite Bildfreigabe ohne Figuren im tatsächlichen
Spielerfenster und der Vorschau, normales Wiederöffnen, Blank und erneute
Freigabe sowie Wechsel in eine zweite eigene Kampagne ohne Übernahme des
ersten Bildes. Zwei QA-Jobs endeten normal. Die registrierte Buildidentität
blieb unverändert; 17 ausgewählte Originalframes wurden bytegleich geprüft.
Dies ist eine gezielte lokale Abnahme, keine allgemeine Privacy- oder
Releaseaussage. Der voreingestellte Ortsbildimport scheiterte nach der
Dateiauswahl zunächst mit „Bildziel fehlt.“; erst „Freies Bild“ ermöglichte den
Import. Diese Auffindbarkeitsfrage bleibt zur aktuellen Reproduktion offen.
Die beiden Produktkorrekturen bleiben lokal; ihre Veröffentlichung ist
weiterhin gesondert gesperrt.

MD-MUEHLENAU-01 wurde mit einem neuen unabhängigen Tester für denselben
öffentlichen kurzen Spielabend in originalem KWrite begonnen. Vorbereitung,
Spielleitung und Wiederaufnahme bleiben im selben Chat; die Darstellung ist
frei. In originalem KWrite 26.08.1 wurde eine leitbare Vorbereitung erstellt:
eine GM-Datei mit Ablauf, schematischer Karte, Raumtexten und Anfangsspielstand
sowie ein separates öffentliches Handout. Normales Speichern und Wiederöffnen
funktionierten. Die Raumsuche fand die Überschrift am unteren Fensterrand;
zusätzliches Blättern war nötig. Karte, Beschreibung und Spielstand müssen
manuell abgeglichen werden; ein daraus entstandener Fehler wurde noch nicht
beobachtet. Der gleiche Tester führte anschließend die öffentliche
Spielsituation durch: Die begonnene Untersuchungsnotiz blieb nach der
Lampenfrage erhalten, die Reparatur wurde festgehalten und das unveränderte
Handout allein in einem separaten lokalen Fenster gezeigt. Textsuche und
Rückkehr zur Schreibstelle waren manuell; Spielstand und Sitzungsnotizen
mussten getrennt aktualisiert werden. Kein blockierender Fehler oder
Textverlust wurde beobachtet. Normaler Close und Checkpoint sind belegt.
Der gleiche Tester schloss auch die Wiederaufnahme ab: Auszahlung,
mitgenommene Lampe, Reparatur, Pegel, Notizen, Geheimnis, Handout und Textkarte
waren nach normalem Schließen und einem neuen KWrite-Prozess erhalten. Der
Endstand am Dateianfang war direkt lesbar, Dateiöffnung und Raumsuche mussten
wiederholt werden. Finale Dateien, Originalframe des frischen Standes und
normales Run-/Produkt-/Umgebungsende wurden geprüft. Es gab keinen beobachteten
Inhaltsverlust oder blockierenden Produktfehler. Der fertige Auftrag wurde nach
Sicherung archiviert. Die einfache Textlösung ist für diesen begrenzten Fall
praktisch brauchbar; dies belegt keinen Vorteil des Dungeon Editors. Eine
numerische Auswertung gegen den älteren Produktlauf wäre kein kontrollierter
Vergleich.
Dieser einfache Text-/Markdownablauf liefert zunächst qualitative
Nutzungsbelege, keine kontrollierte Zeitstudie; technische Anlaufkosten und
Einschränkungen bleiben Teil des Berichts.

Eine zu breite Anweisung zum UI-only-Schreiben führte dazu, dass auch der
technische Vorbereitungsbericht in KWrite verfasst wurde. Der Vertrag wurde
präzisiert: GM-Spielunterlagen und Handout entstehen weiterhin ausschließlich
über normale UI; technische QA-Berichte dürfen separat erzeugt werden. Die
ursprünglichen Dokumentationsschritte bleiben in den Rohspuren, zählen aber
nicht als gewöhnliche GM-Arbeit. Es wurden keine Spielsituation oder Lösung
verändert. Insbesondere werden daraus keine pauschalen Zeit-/Klickvergleiche
abgeleitet.

Für die nächste native Erkundung wurde ausschließlich eine eigene Kopie des
veröffentlichten Integrationscommits
`696417e5a59c4ec33482b8d93dbe854b744e3bc5` (0.94.0) gebaut. Der einzelne
geschützte Job endete nach Freigabe des tatsächlich freien QA-Slots normal
mit Exit 0. Alle 112 gelieferten Produkt-/Runtime-Dateihashes stimmen mit dem
Manifest überein; die Quellen blieben unverändert. Native Startfähigkeit und
UX sind dadurch noch nicht belegt. Die Entwicklung wird nicht gesperrt.

RABENFURT-SOURCE-01 beginnt mit einem neuen unabhängigen Tester auf diesem
festen Build. Der öffentliche Fall betrifft einen kleinen Fährstadt-Spielabend,
aktuelle Auskünfte, eine unterbrochene Notiz und spätere Wiederaufnahme. Nur
Vorbereitung und Inhalt wurden zunächst offengelegt; spätere Spielsituationen
bleiben bis zu den natürlichen Grenzen zurückgehalten. Kein früherer Befund,
keine Produktquelle oder UI-Schrittfolge wurde dem Tester übergeben. Ergebnisse
dieses neuen Falls sowie dessen eigene praktische Alternativvergleiche stehen
noch aus.

Der bestehende Cloud-Browserpilot ist mangels auflösbarer Gesprächs-ID nicht
als ausgeführt bestätigt. Es wurde kein Ersatzlauf gestartet. Tatsächliche
Konkurrenz-/Markdownabläufe sowie menschliche Belastungs- oder
Geschwindigkeitsvorteile bleiben unbelegt. Die ursprünglichen Berichte,
UI-Aufzeichnungen und lokalen Artefaktverweise bleiben im Live-Ledger erhalten;
private Profile und Kampagnendaten werden hier nicht veröffentlicht.
