# Dungeon-Graph: Beschriftung im kleinen Grundriss

Im unabhängigen Mühlenau-PREPARE auf Desktop 0.70.0,
Commit `1a06f6ebd546cee5ca73c5e61b11a89f3c31a5ce`, überlagern sich in
der Detailansicht die Namen und Kennzahlen zweier Räume und eines Gangs.
Der Originalframe nach „Einpassen“ zeigt weiterhin überlagerte Texte.
Die zusammengefasste Ansicht ist als Ausweichweg brauchbar, behebt die
Lesbarkeit der Detailansicht aber nicht. Originalframes und ihre Hashes
bleiben im privaten QA-Ledger; dies ist kein vollständiges Szenariourteil.

Ein fokussierter Auftrag prüft zuerst den aktuellen veröffentlichten Stand
`50ce016346d16fe8c50ccbf1bde12cc49f99d695` / 0.76.0 mit neutralen UI-Daten.
Erst eine aktuelle Reproduktion erlaubt den Produktfix. Räumliche Bedeutung
und die vom Nutzer gewählte Anordnung müssen erhalten bleiben. Nach einem
Fix ist eine unabhängige erneute Produktprüfung erforderlich.

Ein frei gezeichneter Raumplan oder eine Markdown-Verbindungsliste ist die
einfachste Vergleichsgrundlage. Obsidian Canvas bietet laut
[offizieller Dokumentation](https://obsidian.md/help/plugins/canvas)
Notizkarten, beschriftete Verbindungen und Anordnungshilfen. Die tatsächliche
vergleichende Bedienung ist noch offen; daraus werden keine Zeit-, Klick-
oder menschlichen Belastungsvorteile behauptet.

Der laufende vollständige GM-Durchlauf bleibt auf 0.70.0. Der gezielte
Umsetzungsauftrag beginnt bei belegtem QA-Slot mit leichter Inspektion;
er ersetzt keinen laufenden Test und startet keinen ungeschützten Job.
