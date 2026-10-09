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

## Getrennter Planreview

Der unabhängige Planreview vom 09.10.2026 auf dem gemeinsamen Stand
`6ee65dae1eb462f269d253263d5f861fe28a8ef0` gibt den Plan noch nicht zur
Umsetzung frei. Er ändert weder Produktcode noch einen der 16 Abnahmestände.
Vier Pflichtlücken müssen zuerst in einem eigenen Reparaturlauf geschlossen
werden:

1. **Ausführbare Voraussetzung:** HEX-01 kann einen leeren Atlas nur anlegen,
   validieren und öffnen. Navigation und Hexauswahl verändern das Dokument
   nicht; Atlas-History, Dirty-Zustand, Speichern und dauerhafter Entwurf sind
   erst in HEX-02-I01a bis I01c geplant. Der DD-036-Lauf darf deshalb nicht
   unmittelbar mit Save/Undo/Redo/Dirty-Warnung beginnen. Der reparierte Plan
   muss die exakte HEX-02-Voraussetzung nennen und `.02/.16` als jetzt schon
   getrennt prüfbaren reinen Öffnungsfall behandeln.
2. **Getrennte Referenzwahrheit:** `DD-036.01–.16` bleiben Dungeondraft-
   Inventar; ihre überwiegend ungemessene Originalwirkung bleibt offen. Die in
   HEX-02 bereits direkt belegten Wonderdraft-Folgen `WD-003.01–.03` dürfen den
   Atlas-Nutzerzweck und das Hostorakel liefern, aber keine Dungeondraft-
   Parität vortäuschen. Der reparierte Plan ordnet jedem Hostschritt genau eine
   Originalquelle, Version, belegte Wirkung und verbleibende Abweichung zu.
3. **Identitäts- und Kopierorakel:** Vor Save As, Backup, Import oder Recovery
   muss feststehen, wann `world.id` erhalten bleibt und wann eine Kopie eine
   neue Weltkennung sowie eigene Terrain-Dateien erhält. Pfad, Overworld-Hash,
   referenzierte Dateihashes, geschützte Dungeon-/Location-Key-Bytes und stabile
   Fremdkennungen sind getrennt vorher/nachher zu prüfen. Ein bloß erfolgreiches
   Öffnen oder ein einzelner Gesamthash reicht nicht.
4. **Gemeinsamer Speicherweg:** Die heutige HEX-01-Anlage über
   `VaultStore.compareAndWrite` belegt nur konfliktgeschütztes Erzeugen einer
   einzelnen leeren `.overworld`. Sie ist kein Save-, Entwurfs-, Mehrdatei-
   Journal- oder Recovery-Nachweis. Der reparierte Plan muss auf den in HEX-02
   festgelegten gemeinsamen `FileStore`-/`FileTransaction`-/Draft-Weg mit
   vorbereiteten und abgeschlossenen Journalzuständen, externem Konflikt,
   Abbruch und gezielten Unterbrechungspunkten verweisen; kein paralleles
   Atlas-Speichersystem.

**Nächster abgegrenzter Lauf:** `DD-036-ATLAS-P01-R01` repariert nur diesen
Plan. Er bildet `.02/.16` auf den vorhandenen read-only Öffnungsfall ab,
verschiebt `.03–.05/.14` hinter die jeweils notwendige HEX-02-I01-Stufe,
entscheidet `.07/.08/.13/.15` erst nach dem Identitätsorakel und hält
`.01/.06/.09–.12` bis zur realen Shellentscheidung getrennt. `.09` umfasst in
Phase 1 nur den Preferences-Einstieg; die Felder und Kürzel `.17–.76` bleiben
Phase 12. Danach folgt ein neuer unabhängiger Review des exakten Planstands.
Bis dahin bleiben DD-036, Phase 1, Host-/Originalabnahme und Gesamtparität
offen; es wird kein GUI-Lauf aus diesem Plan abgeleitet.
