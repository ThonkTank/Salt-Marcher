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

HANDOUT-RETEST-01 ist mit einem weiteren frischen Tester auf dem unveränderten
lokalen Build 0.80.0 aus `93f77bdfbc6fb0cd75abd6fc1ce173147d92ae5f`
gestartet. Gegenstand sind explizite Bildfreigabe ohne Figuren, echtes
Spielerfenster, Wiederöffnen, Blank/Freigabe und Kampagnenisolation. Ein Endurteil
liegt noch nicht vor. Die beiden Produktkorrekturen bleiben lokal; ihre
Veröffentlichung ist weiterhin gesondert gesperrt.

Der bestehende Cloud-Browserpilot ist mangels auflösbarer Gesprächs-ID nicht
als ausgeführt bestätigt. Es wurde kein Ersatzlauf gestartet. Tatsächliche
Konkurrenz-/Markdownabläufe sowie menschliche Belastungs- oder
Geschwindigkeitsvorteile bleiben unbelegt. Die ursprünglichen Berichte,
UI-Aufzeichnungen und lokalen Artefaktverweise bleiben im Live-Ledger erhalten;
private Profile und Kampagnendaten werden hier nicht veröffentlicht.
