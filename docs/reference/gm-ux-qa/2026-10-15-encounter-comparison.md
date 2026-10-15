# Encounter bauen und leiten: gepaarter Bedienvergleich

15.10.2026. Ein durchgängiger Testfall mit eigenen Testdaten: zuerst Kampagnenwerkstatt nativ, anschließend derselbe Fall in zwei öffentlichen Konkurrenzoberflächen. Kein Nachweis allgemeiner Überlegenheit für menschliche Spielleitungen und keine Gesamtproduktabnahme.

## Aufgabe und tatsächlich bediente Stände

Vier Figuren auf Stufe 3 (Alba, Bram, Cora, Dain), drei Goblins und ein Bugbear, SRD 2014. Vorlage bzw. Begegnung bauen, Schwierigkeit prüfen, Initiative setzen, beginnen, einem Goblin fünf Schaden geben und ihn liegend markieren, einen Goblin als Verstärkung hinzufügen, einen Zug weitergehen, diesen Schritt zurücknehmen und wiederaufnehmen.

- Kampagnenwerkstatt 0.128.0, Baseline `a642c14c59571e32637c917153b816562e937b5e`: echte Electron-Oberfläche, eigenes SQLite-Profil, normale Eingaben über die vorhandene native Bedienhilfe. Vorlage und Kampf wurden dort aufgebaut; Goblin A endete bei 2/7 HP mit „Liegend“. Die manuelle Verstärkung war ohne Statblock und XP, worauf die Schwierigkeitsanzeige ehrlich unvollständig wurde. Der Zugwechsel und seine Rücknahme waren bedienbar. Der Prozess endete normal mit Exit 0 und ohne verbleibende Produktprozesse.
- [Improved Initiative](https://improvedinitiative.app/e/) 3.17.3, öffentlicher Stand am Testtag. 2014-Quellen ausdrücklich eingestellt. Eigene vier Charakterdefinitionen; fremde vorhandene Definitionen blieben erhalten. Drei Goblins, Bugbear, acht Initiativewerte, Schaden, Prone, katalogbasierte Verstärkung mit Initiative 9, nächster/vorheriger Zug und Reload wurden ausgeführt. Neun Einträge, 2/7 HP und Prone blieben nach Reload sichtbar.
- [DM Screen](https://dmscreen.app/), öffentlicher Webstand am Testtag, keine Versionsnummer in der bedienten Oberfläche festgestellt. 2014-Regeln, dieselbe Viererparty und Monster. Der Builder zeigte 350 Basis-XP und 700 angepasste XP gegen die vier Figuren. Schaden, Prone, Verstärkung mit gemeinsamer Initiative 9, Zugwechsel, Undo und Reload wurden ausgeführt. Neun Einträge, 2/7 HP und Prone blieben sichtbar; Undo war nach dem Reload deaktiviert.

Initiativen wurden bei beiden Konkurrenten an den nativen Ausgangslauf angeglichen: Bugbear 17, Cora 16, Dain 14, Bram 13, Goblins 9, Alba 1. Die Schwierigkeiten vor Verstärkung waren vergleichbar. Nach Verstärkung unterscheiden sich Eintrag und Gruppenanbindung bewusst: untersucht wurde, wie die Produkte diesen Anschluss unterstützen.

## Beobachtung und Produktentscheidung

| Tatsächliche Reibung | Entscheidung für die Kampagnenwerkstatt |
| --- | --- |
| Eigene Vorlage, Suchliste und Hinzufügen lagen auf verschiedenen vertikalen Abschnitten; Generatorverwaltung verlängerte die Seite zusätzlich. | Suchliste, Statblock/Hinzufügen und Zusammenstellung nebeneinander; optionale Generatorverwaltung geschlossen. Kampfübergabe direkt bei der Schwierigkeit, seltene Vorlagenaktionen eingeklappt. |
| Die eigene Initiativeübersicht und die HP-/Zustandsbearbeitung lagen mehrere Bildschirmabschnitte auseinander. | Kompakte Initiative als eigene Spalte neben dem ausgewählten Teilnehmer. Schaden/Heilung und Zustände vor den optionalen Werten; eigene Übersicht bleibt auf breiten Fenstern beim Scrollen erreichbar. |
| Eigene Verstärkung verlangte freie Werte statt Übernahme des bereits verwendeten Goblins; XP und Statblockbezug fehlten anschließend. | Direkte Auswahl bekannter Statblöcke/Initiativegruppen sowie begrenzte Katalogsuche im Runner. Quelle, HP, RK und XP stammen aus demselben Statblock. Bestehende Gruppen behalten ihren Initiativewert; eine unabhängige Verstärkung kann einen ausdrücklichen Wert atomar übernehmen. |
| Improved Initiative: mehrere Grundaktionen waren zunächst ausschließlich Symbole. Im Initiativedialog schloss „Close“ ohne Übernahme; die Übernahme lag am Häkchen. Die Quellenumstellung verlangte einen Reload. | Ausdrücklich beschriftete Aktionen und vorhandene klare Regelquellenbezeichnung beibehalten. Kein neuer Bestätigungsdialog und kein Quellenwechsel für diesen Ablauf. |
| DM Screen: hinzugefügte Partyfiguren verschwanden aus der Auswahlliste, sodass die nachfolgenden Ziele nachrückten. Hinzufügen war durch unbeschriftete Plus-Buttons erreichbar. | Die vollständige Planungsparty wird über eine benannte Aktion übernommen; Quellen-/Gruppenauswahl verschiebt keine anderen Zielzeilen. |
| DM Screen: Verstärkung erhielt erneut „Goblin“, obwohl bereits ein „Goblin“ existierte. | Vorhandene laufende Quellenzählung verwenden: Goblin A/B/C/D. Kein zweiter eigener Namenszähler im UI. |
| Eigener Neustart führte zurück auf die lange Spielabendseite; der Kampf musste erneut gesucht werden. | Sichtbarer Sprung „Zum aktuellen Kampf“ am Anfang der Spielabendseite. |
| DM Screen: Undo war nach Reload deaktiviert. | Vorhandene persistente Kampf-History weiterverwenden; Verstärkung ist ein gewöhnlicher atomarer Kampfcommand mit Receipt, Undo und Neustartnachweis. |

Die beiden Konkurrenzprodukte zeigten brauchbare, direkte HP-/Zustandsaktionen und eine zugängliche Verstärkungsübernahme. Diese konkreten Wege sind der Maßstab; ihre übrigen Funktionen sind hier nicht vollständig bewertet.

## Prüfung

Der finale native Integrationsstand 0.130.0 (`1430d1f0`) enthält den Remote-Stand `c88cd9b1` und die Encounter-Änderungen. Desktop-Typprüfung und 71 gezielte Regressionen zu Verstärkung, Kampfentwürfen, Begegnungswechsel, Katalog und Generator bestanden. Anschließend bestanden alle sieben Verstärkungs-/Entwurfsfälle erneut, einschließlich einer zusätzlichen Absicherung für noch ladende oder fehlgeschlagene Teilnehmerentwürfe. Die neue Anordnung nutzt denselben geschützten Command- und Entwurfspfad. Testmengen überschneiden sich und werden nicht addiert.

Der native Nachtest mit eigenem Profil zeigte acht Teilnehmer, 2/7 HP und „Liegend“ gleichzeitig mit Schaden/Heilung. Quellenbasierte Verstärkung erzeugte Goblin D mit 7/7 HP, RK 15 und derselben Initiative 21; der laufende Zug blieb bei Goblin A. Basis-XP stiegen von 350 auf 400, angepasste XP von 700 auf 800. Nächster Zug wechselte zu Goblin B, Rückgängig zurück zu Goblin A. Die endgültigen Würfe weichen vom Ausgangslauf ab; daher folgt hier Goblin B statt Cora. Nach einem vollständigen normalen Prozessende und Neustart blieben die neun Teilnehmer, 2/7 HP und Liegend erhalten. Rückgängig nach Neustart entfernte die Verstärkung und erhielt den übrigen Zustand.

Mehrere native Sichtprüfungen führten zu konkreten Korrekturen: Platz für die Vorlageneinträge, kompakte Teilnehmerzeilen, eine nicht überlagernde Aktionsleiste und der direkte Sprung zum Kampf. Der letzte frische Electron-Prozess bestätigte in diesem Integrationsstand erneut neun Teilnehmer, 2/7 HP, Liegend, den direkten Sprung und nutzbares Undo. Nach Rücknahme der Verstärkung waren es acht Teilnehmer mit unverändertem Restzustand; erneutes Hinzufügen ergab wieder Goblin D und 400/800 XP. Die gespeicherte Vorlage blieb bei drei Goblins und einem Bugbear mit 350/700 XP. Beide Produktprozesse endeten normal mit Exit 0 ohne verbleibende Produktprozesse. Der letzte Integrationscheck (Typprüfung und 20 gezielte Fälle einschließlich der neuen Remote-3D-Regressionen) war ebenfalls grün. Der direkte Sprung und die Entwurfssperre wurden zuvor zusammen mit 20 Kampfregressionen geprüft. Keine Behauptung einer allgemeinen Konkurrenzparität, vollständigen 200-Prozent-/Tastaturabnahme oder menschlichen GM-Abnahme.

[Vorher: HP-Bearbeitung ohne sichtbare Initiativeübersicht](encounter-comparison-20261015/before-runner.png).


[Nachher: Builder](encounter-comparison-20261015/after-builder.png) · [Nachher: Runner mit neun Teilnehmern](encounter-comparison-20261015/after-runner.png) · [Buildidentität und Run-Abschlüsse](encounter-comparison-20261015/evidence.json).

Die vollständigen lokalen nativen Ereignisse und Frames liegen in der isolierten Session `encounter-01-after`, insbesondere in den Läufen `goblin-acceptance` (0.129.0, Schaden/Zustand/Suche/Verstärkung/Zug/Undo) und `goblin-final-reopen` (0.130.0, frischer Prozess, Zustand/Undo/Sprung/erneute Verstärkung/Vorlage). Die Screenshots oben stammen beide aus dem letzten Lauf und sind unveränderte Aufnahmen.
