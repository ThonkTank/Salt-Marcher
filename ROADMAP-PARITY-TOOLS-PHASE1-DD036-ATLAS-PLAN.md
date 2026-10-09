# Phase 1, DD-036: Dateifluss für die einzige Atlaskarte

Planlauf vom 09.10.2026 zu [Phase 1](ROADMAP-PARITY-TOOLS-PHASE1-PLAN.md). Die Nutzerentscheidung ersetzt Dungeondrafts Mehrkartenmodell durch eine einzige grenzenlose Atlaskarte mit Hexterrain, Städten und Dungeons. Die bisherigen `DD-036.01–.16` bleiben als Inventar erhalten; dieser Plan erteilt ihnen keine Paritätsfreigabe.

## Fachlicher Zuschnitt

| Fälle | Atlaszweck | Nächster Nachweis |
| --- | --- | --- |
| `.03–.05`, `.14` | Arbeit speichern, rückgängig machen, wiederholen und vor dem Verlassen ungespeicherte Arbeit schützen. Der New-Map-Zweig aus `.14` entfällt. | Dokumentdigest, History, Warnung, Cancel und Neustart mit einer isolierten Atlaskopie prüfen. |
| `.02`, `.16` | Die bestehende Welt und eine transportierte oder wiederhergestellte Kopie öffnen. | Identität, Format, geschützte Key-Bytes, Assetverweise und Konfliktfall prüfen. |
| `.07`, `.08`, `.13`, `.15` | Zuletzt benutzte Welten und Karten duplizieren passen nicht unmittelbar zur einzigen aktiven Welt. Ein Export, Backup oder Import kann denselben Nutzerzweck erfüllen, ist aber eine eigene Atlasentscheidung. | Bis zur Atlas- und Plattformentscheidung keine alte Recent-/Save-As-Oberfläche als Pflicht ableiten. Ursprungsfall und Abweichung dokumentieren. |
| `.01`, `.06`, `.09–.12` | Menü, Information, Einstellungen, Datenordner und Schließen beziehen sich auf die endgültige Anwendung. | Nach der Plattformentscheidung gegen deren reale Shell, leeren Zustand und aktiven Atlas prüfen. |

## Reihenfolge

1. Die alte Originalakte und den installierten Host als Inventar lesen. Originalversion, Eingaben, Dateiwirkung und Lücken je Fall festhalten. Ein Menübild belegt keine Speicherwirkung.
2. Auf einer **Kopie** der Atlaskarte Save, Undo/Redo, Dirty-Warnung mit Cancel und Wiederöffnung messen. Dabei Karte, Raum-Keys, IDs, Bildbreiten und Assets vor/nach jedem Schritt hashen. Kein produktiver Vaulttext wird geändert.
3. Atlasidentität, Import/Export, Backup und Recovery mit dem SaltMarcher-Plattformprototyp und HEX-01 abstimmen. Erst danach die Mehrkartenfälle `.07/.08/.13/.15` auf einen konkreten Atlasablauf abbilden oder ausdrücklich aus direkter Parität nehmen.
4. Jeden umgesetzten Ablauf auf demselben Build in frischem Prozess unabhängig reviewen. Konflikt, Abbruch und Ausfall dürfen keinen teilweisen Stand bestätigen. Fachreview, mögliche Nachbesserung und Aufräumen bleiben getrennte Läufe.

Die Original-App ist im aktuellen lokalen UI-Inventar nicht als Fenster verfügbar. Deshalb bleibt ihre ungemessene Wirkung offen. Das hindert den Atlas-Speichervertrag und seine Kopier-/Recoveryprüfungen nicht; sie erhalten nur keine voreilige Dungeondraft-Freigabe.
