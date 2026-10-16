# Eine verknüpfte NSC-Notiz beim Raum-Key bearbeiten

Direkter Vergleich vom 15. Oktober 2026: Kampagnenwerkstatt 0.130.0 mit
Electron 44.7.0 unter Linux und die offizielle
[Logseq-Browserdemo](https://demo.logseq.com/), angezeigte Version **1.0.0**.
Die Version wurde in Einstellungen → Allgemein abgelesen. Beide Oberflächen
wurden mit eigenen synthetischen Notizen benutzt.

## GM-Aufgabe

Beim Schreiben des Wachstuben-Keys Neras bestehende Motivation nachlesen,
„Sie fordert Sold, bevor sie den Keller erwähnt“ ergänzen und am Raumtext
weiterarbeiten. Die Notiz soll dieselbe Kampagnennotiz bleiben.

Die Kampagnenwerkstatt startet mit zwei vorbereiteten Räumen und einer
verknüpften NSC-Notiz; diese Ausgangsdaten legt der öffentliche CampaignStore
vor dem Appstart an. Anschließend erfolgen Eingabe, Öffnen, Korrektur und
Rückkehr über die echte Desktopoberfläche. In Logseq wurden die beiden Seiten
über die Browseroberfläche angelegt. Verglichen wird der Arbeitsfluss mit
vorhandener Vorbereitung; daraus werden keine Autorenzeiten abgeleitet.

## Beobachtung

| Weg | Tatsächlich beobachtetes Verhalten |
| --- | --- |
| Kampagnenwerkstatt vorher auf `c88cd9b1` | Am Raum-Key steht `npc: Nera die Quartiermeisterin`; die einzige Aktion lautet „Entfernen“. Zum Bearbeiten: Key schließen, Vorbereitung öffnen, Weltwissen wählen, Nera suchen und öffnen. Raumtext und Raum-Suchfilter bleiben auf dem manuellen Rückweg erhalten. Kein Datenverlust als Befund. |
| Logseq: normaler Klick | Öffnet Nera als Hauptseite. Ein Rückverweis zeigt die Wachstube. |
| Logseq: Umschalt-Klick | Öffnet Nera rechts neben der weiterhin sichtbaren Wachstube. Die Notiz lässt sich direkt dort ändern. Das Starttutorial erklärt die Geste. |
| Kampagnenwerkstatt nachher | Der sichtbare Verweisname öffnet den bestehenden Notizeditor direkt neben dem Key. „Zum Raumtext“ bestätigt offene Eingaben, schließt den Notizbereich und setzt den Fokus in die GM-Notizen des Raums zurück. Raum, Suchfilter und eigener Wortlaut bleiben erhalten. |

[Logseq-Aufbau und beobachtete Antworten](comparator.json). Die Demo meldet
ausdrücklich, dass ohne lokales Verzeichnis keine dauerhafte Speicherung
erfolgt. Es wurde kein Verzeichnis freigegeben. Aussagen über Neustart,
Desktopversion oder sämtliche Logseq-Funktionen wären daher nicht belegt.

Der übernommene Nutzen ist der erhaltene Schreibkontext: Neras Motiv und der
Raum-Key sind bei ausreichender Breite gleichzeitig sichtbar. Unser normaler
Klick verwendet diesen Weg ohne zusätzliche Modifikatortaste. Auf schmalen
Ansichten stehen Notiz und Raumtext untereinander. Der Abgleich ist keine
allgemeine Überlegenheitsstudie mit menschlichen Spielleitungen.

## Umsetzung und Prüfung

Der Notizeditor, seine Eingabefelder, Arbeitsentwürfe, Speicher-/Konfliktaktionen
und deren Ereignisbehandlung werden vorübergehend im Keydialog angezeigt und
anschließend an ihren bisherigen Platz zurückgestellt. Es gibt keine zweite
Notizkopie oder Schreibschnittstelle. Der Kompositionsschutz umfasst die
verschobenen Felder. Ausstehende oder gescheiterte Notizeingaben lassen sich
vor dem Schließen prüfen. Ein nicht geöffnetes Ziel wird nicht mit dem Inhalt
der vorherigen Notiz dargestellt.

Der neue Direktweg gilt für die vorhandenen Notizarten NSC, Fraktion, Quest,
Gerücht und Regel. Orte und Pläne behalten hier ihren bisherigen Referenzweg;
ihre Kontextbearbeitung wurde in diesem Fall nicht geprüft.

- [Vorher-Ergebnisse](before.json), [vorherige Referenzanzeige](before-reference.png).
- [Nachher-Ergebnisse und Buildhashes](after.json),
  [Raumtext und Notiz nebeneinander](after-alongside.png),
  [Rückkehr zum Raumtext](after-returned.png),
  [schmale Ansicht bei 200 %](after-context-200percent.png).
- [Nativer Ablauf](../../../../tools/test-desktop-key-note-context.mjs):
  `npm run test:desktop-key-note-context-ui`. Geprüft sind gespeicherte
  Motivation nach frischem Appstart, erhaltene originale Raumprosa, zwei
  normale Exit-0-Abschlüsse, synthetische Composition-Ereignisse und ein
  tatsächlich ausgeführter, unverdeckter Rückkehrklick bei 200 %. Das ist kein
  physischer IME- oder allgemeiner OS-/A11y-Nachweis.
- [Kontextregressionen](../../../../tests/desktop-key-note-context.test.mjs) und
  [gemeinsamer Vorbereitungsschreiber](../../../../tests/desktop-preparation-context.test.mjs)
  prüfen Identität der wiederverwendeten Controls, erhaltene Eingaben,
  gescheiterte Flushes, verworfene spätere Antworten und Wiederherstellung beim
  Schließen. Zusammen mit den bestehenden Textverweisprüfungen bestanden lokal
  102 Tests. Beide Typechecks sowie Plugin- und Desktopbuild wurden geprüft.

Die erste 200-%-Nachkontrolle fand eine überdeckte Rückkehrschaltfläche.
Auf schmalen Ansichten verwenden Speicherstatus und Notizkopf nun normalen
Dokumentfluss. Der Nachher-Test prüft zusätzlich die Trefferfläche des Buttons
und den tatsächlichen Klick; eine bloße DOM-Sichtbarkeit genügt nicht.

## Getrennte CI-Grenze der vorherigen Suchrunde

Die Gesamt-CI von PR #170 auf `50b448f0` meldete 9 Fehler unter 2694 Tests.
Alle neun wurden auf dem unveränderten Ausgangsstand `d41a02d7` reproduziert:
drei Chronikfälle, ein Sitzungsreviewfall und fünf Treasury-DOM-Fälle.
Der gezielte Basislauf hatte 16 Tests, davon 7 bestanden und dieselben 9
fehlgeschlagen; [Zusammenfassung und Wiederholungsbefehle](lookup-base-ci.json). Die ursprüngliche
vollständige lokale Ausgabe bleibt erhalten; sie steht auch im Gitstand `86ac38be`.
Diese Basisfehler werden nicht als bestandene Gesamtprüfung bezeichnet.

Notizorganisation, umfassende Rückverweise, lange Raum-Keys und weitere
Vergleichsfälle bleiben Teil des laufenden Auftrags. Dieser Fall ersetzt
weder deren direkte Bedienprüfung noch die vollständige Produktabnahme.

## Gemeinsamer Stand beider Vergleichsrunden

Nach der Zusammenführung mit der vorherigen Suchkorrektur bestanden 149
gezielte Prüfungen. Beide nativen Abläufe wurden auf demselben Desktopbuild
erneut ausgeführt: [Suchablauf](integrated-lookup.json) und
[Notizkontext](after.json) binden dieselben fünf Artefakthashes. Alle fünf
Appstarts endeten regulär mit Exit 0; ihre eigenen PIDs waren anschließend
nicht mehr vorhanden. Die lokale Bestätigung hebt die oben dokumentierten
neun allgemeinen CI-Basisfehler nicht auf.

Der abschließende Build auf `f8d5fb8d` enthält den gemeinsamen
Integrationsstand `91aacfe3` und beide Notizverbesserungen.
[Prüfzusammenfassung](integration-validation.json) und native Artefakthashes
binden die wiederholten Prüfungen an diesen sauberen Quellstand.
