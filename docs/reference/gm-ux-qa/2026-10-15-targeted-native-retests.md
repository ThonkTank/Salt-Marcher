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
frei. Dieser einfache Text-/Markdownablauf liefert zunächst qualitative
Nutzungsbelege, keine kontrollierte Zeitstudie. Ein Ergebnis liegt noch nicht
vor; technische Anlaufkosten und Einschränkungen bleiben Teil des Berichts.

Der bestehende Cloud-Browserpilot ist mangels auflösbarer Gesprächs-ID nicht
als ausgeführt bestätigt. Es wurde kein Ersatzlauf gestartet. Tatsächliche
Konkurrenz-/Markdownabläufe sowie menschliche Belastungs- oder
Geschwindigkeitsvorteile bleiben unbelegt. Die ursprünglichen Berichte,
UI-Aufzeichnungen und lokalen Artefaktverweise bleiben im Live-Ledger erhalten;
private Profile und Kampagnendaten werden hier nicht veröffentlicht.
