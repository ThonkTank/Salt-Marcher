# DD-042: Kandidaten für die installierte Abnahme

Stand: statische Gegenprüfung des installierten Builds `13bc76dab1cc64a6c870cfe6777db13d4cd78aa220b17032f2d7d225a007794b`. Die zwölf Fälle unten haben im gebündelten Hostlauf den technischen Zustand `pass`. Das ist keine Änderung der Acceptance und keine Freigabe eines späteren Builds.

## Belegbasis

- [Host Edit](</home/aaron/.cache/dungeon-native-qa/implementation-20261005/qa/dd042-group-host/evidence/1791214285426-objekte-07-edit/group-cases.json>) und [Host Frischstart](</home/aaron/.cache/dungeon-native-qa/implementation-20261005/qa/dd042-group-host/evidence/1791214363307-objekte-07-reopen/group-cases.json>).
- [Original Setverwaltung](</home/aaron/.cache/dungeon-native-qa/evidence/native-prefab-set-management.json>), [Minus bei leerem Set](</home/aaron/.cache/dungeon-native-qa/evidence/native-prefab-empty-set-minus.json>), [Minus bei befülltem Set](</home/aaron/.cache/dungeon-native-qa/evidence/native-prefab-filled-set-minus.json>), [Originalbilder](</home/aaron/.cache/dungeon-native-qa/audit-20261004-vollstaendigkeit/objekte/native-gui-prefab/evidence>) und [ergänzte Originalprobe für Abbruchgesten](</home/aaron/.cache/dungeon-native-qa/implementation-20261005/qa/dd042-group-native/runs/20261005-173413-3323684/evidence>).
- Die Fallziele stammen aus `acceptance.json`, `strictParity.cases`; insbesondere verlangt .07 die gewählten Entitäten, .11 die Setwahl und .14 Vorschau samt nächster Platzierung.

## Direkt gepaarte Zielwirkungen: 6

Diese sechs Fälle können im neuen installierten Endbuild gezielt wiederholt werden. Weitere Generalisierung über die jeweils beschriebene Bedienfolge hinaus ist dadurch nicht behauptet.

| Fall | Original und Host | Für Endbuild erneut prüfen |
| --- | --- | --- |
| DD-042.02 | Set im Erstellen-Dialog wählen; neue benannte Lichtvorlage wird dem Set zugeordnet. Host wechselt `Allgemein` ↔ Testset, `prefab-created.json` enthält das Set, Frischstart erhält es. | Setzuordnung, Definition und Frischstart. |
| DD-042.03 | Plus öffnet Namenseingabe, neue Sammlung wird gewählt und mit der gespeicherten Lichtvorlage verfügbar. Host zeigt `empty-set-added.png` und `named-set-added.png`, anschließend gespeicherte Definition. | Hinzufügen, Auswahl, gespeicherte Definition. |
| DD-042.05 | Befülltes Set wird per Minus nicht entfernt; native Vorlagendatei bleibt. Host zeigt deaktiviertes Minus; `prefab-create-cancel.json` und späterer Frischstart erhalten die Definition und Katalogdatei. | Gesperrtes Minus und Katalogpersistenz. |
| DD-042.06 | Eingetragener Name wird Name der gespeicherten Lichtvorlage. Host zeigt `first-prefab-dialog.png`, `prefab-created.json` und Frischstart mit demselben Namen. | Name vor und nach Speichern. |
| DD-042.22 | Forget-Warnung per Cancel schließen; Originaldatei und Karte mit Instanzen bleiben bytegleich. Host `forget-cancel.json` prüft Vorlage, Dokument, History sowie Daten- und Kartendatei. | Warnung schließen, Datei/Karte und Auswahl erneut prüfen. |
| DD-042.23 | Forget-Warnung per X schließen; Originaldatei und Karte bleiben auch nach neuem Originalprozess erhalten. Host `forget-x.json` prüft dieselben Daten und Dateien. | X-Geste, Persistenz und Frischstart. |

Die Hostkarte für .22/.23 hat ein gebundenes Quelllicht, die Originalkarte zwei Lichter nach Platzierung. Die belegte Invariante ist in beiden Fällen dieselbe: Abbruch löscht weder Definition noch bestehende Kartenentität. Ein Mehrfachinstanzenfall gehört zur Vorlagenplatzierung und ist durch diese beiden Abbruchfälle nicht abgenommen.

## Nur enger oder nicht vollständig belegt: 6

| Fall | Belastbarer Teil | Fehlende Paarung vor voller Fallfreigabe |
| --- | --- | --- |
| DD-042.01 | Ausgewähltes **Licht** öffnet Set-/Name-/Bestätigungsdialog; X ist sichtbar. | Das Originaldossier öffnet den Dialog mit **gemischter Objekt-Licht-Auswahl** und zeigt Accept/Cancel. Der Hostlauf prüft diese Auswahl und X als Cancel nicht. Beim ersten Hostversuch erschien nach dem Klick kein Dialog; Ursache offen (`failure-state.json` im ersten Editlauf). |
| DD-042.04 | Neu angelegtes leeres Set verschwindet nach Minus aus der Auswahl; Rückwahl funktioniert. | Das Ziel verlangt auch, dass kein dauerhafter Sammlungsordner bzw. entsprechender persistierter Datensatz zurückbleibt. Der Hostlauf vergleicht Datei/Datensatz nicht unmittelbar nach Minus oder nach Frischstart. |
| DD-042.07 | Accept speichert **eine Lichtvorlage**, bindet das Quelllicht und erhält beides nach Frischstart. | Das Original-`Accept`-Dossier belegt **Objekt plus Licht** mit relativen Positionen. Derselbe gemischte Inhalt und seine relative Lage wurden im Host für diesen Fall nicht geprüft. |
| DD-042.08 | Native Cancel-Geste hält Karte und Vorlagendatei bytegleich; Host-**Escape** hält Katalog, Karte und Verlauf unverändert. | Der Host prüft weder das sichtbare X noch einen benannten Cancel-Befehl. Gleichwertige Abbruchwirkung ist belegt, aber die gepaarte Bedienstelle ist offen. Der direkte neue Originalbeleg muss außerdem in Matrix/Acceptance verlinkt werden. |
| DD-042.11 | Vorlagenwerkzeug, Liste und Forget werden geöffnet; Vorlage erscheint nach Frischstart. | Das verbindliche Fallziel fordert zusätzlich eine **eigene Setwahl**. Sie fehlte auf diesem Build; DD-042.12 ist dort Abweichung. .11 erst auf dem Build mit Setfilter erneut vollständig prüfen. |
| DD-042.14 | Vorlagenwert lässt sich wählen, Forget wird aktiv, auch nach Frischstart. | Das Fallziel verlangt, dass die Wahl **Vorschau und nächste Platzierung** bestimmt. Beides wurde hier nicht geprüft; ein einzelner Listeneintrag kann Verwechslungen zwischen Definitionen nicht aufdecken. |

DD-042.12 war auf diesem Build `deviation`; DD-042.13 trotz technischem Host-`pass` wegen nur einer Vorlage und offener Reihenfolge `open`. Diese beiden Fälle zählen nicht zu den zwölf Kandidaten. Für .12 liegt der ungetestete Fixkandidat `release/dd04212-set-filter` vor.

Der gescheiterte erste Dialogaufruf bleibt eine eigene Zuverlässigkeitslücke für .01. Der zweite Hostlauf bestand nach einer 200-ms-Zustandsaufnahme. Ein Endbuildtest sollte die Dialogöffnung ohne diesen diagnostischen Zwischenschritt wiederholen.
