# Einen Handlungsstrang wieder aufnehmen und den nächsten Abend vorbereiten

Die Spielleitung hat Nera als NSC, das offene Gerücht **Drei Glockenschläge**, die abgeschlossene Spur **Wiedergefundene Fässer** und Raumhinweise zum **Archiv**. Sie soll diese Quellen einmal einem Handlungsstrang zuordnen, später wieder öffnen, die unerledigte Frage erkennen und daraus einen verwendbaren Spielabend vorbereiten. Originaltexte und bereits vorhandene Besuchsinhalte müssen erhalten bleiben.

## Tatsächliche Ausgangslage und Vergleich

Zuerst wurde die echte Kampagnenwerkstatt auf `96ee8e91bdacbfac97c395a7d25d798fa56b29c4`, Version 0.134.0, mit einem isolierten SQLite-Profil benutzt: zwölf gewöhnliche Notizen, Archiv und ein vorbereiteter Abend. Der Gerüchtstatus wurde vor dem UI-Lauf über den regulären Progress-Schreiber bestätigt. Die neue Quest **Die Aufzug-Verschwörung** und ihre drei Beziehungen **Quelle** wurden anschließend über die Oberfläche angelegt.

Die Beziehungen blieben nach einem regulären Prozessende erhalten, zeigten an der Übersichtsnotiz aber nur Namen. Zum Erkennen der offenen Frage mussten die drei Notizen einzeln geöffnet und gelesen werden. Die vorhandenen Rückverweise führten dabei korrekt zur Übersichtsnotiz zurück; der Raum-Key war ebenfalls bereits erreichbar. In der Besuchsplanung fand die Suche nach dem Handlungsstrang nur die Übersichtsnotiz. Die drei benötigten Identitäten mussten erneut einzeln gesucht und ausgewählt werden. Die bisherige Spielabendmappe zeigte danach bereits korrekt die vollständigen Quellen. [Verifizierter Vorher-Lauf](before/result.json), [Beziehungen](before/linked-sources.png), [erneute Suche in der Planung](before/thread-search-in-plan.png).

Ein erster Harness-Durchlauf hatte fälschlich auch den Titel der geschlossenen Spur im Beziehungsanhang ausgeschlossen. Diese Referenz war korrekt: Der geschlossene Quelltext selbst war nicht ausgewählt. Nach Korrektur der Assertion wurde der Ablauf mit frischen Daten vollständig wiederholt. Nur der verifizierte Lauf in `before/result.json` zählt als Vorher-Nachweis; dies war kein Produktfehler.

Danach wurde dieselbe Aufgabe in [TiddlyWiki Empty](https://tiddlywiki.com/empty.html), tatsächlich angezeigte Version **5.4.1**, ausgeführt. Die drei Quellen erhielten den Tag **Aufzug**, die Gerüchte zusätzlich **Offen** beziehungsweise **Erledigt**. Ein normal verfasster Filter in der Übersichtsnotiz zeigte alle Quelllinks und die vollständigen Texte der nicht erledigten Quellen. Nach Schließen, Suchen und erneutem Öffnen der Übersichtsnotiz blieb dieses Ergebnis verwendbar. Aus Neras eingebettetem Original führte der Archiv-Link zum Raum; die Übersicht blieb im Story-Kontext.

Die Spielabendseite **Abend 8 · Die Nachtwache** bettete die Übersicht mit `{{Die Aufzug-Verschwörung}}` ein. Das sichtbare Ergebnis enthielt die offene Frage und Neras Text samt Raumlink; der geschlossene Text fehlte, sein Quelllink blieb vorhanden. [Gemeinsame Quellenansicht](tiddlywiki/open-sources.png), [verwendbarer Abend](tiddlywiki/next-session.png).

Dieser Weg benötigt gepflegte Tags und selbst verfasste Filter-/Widgetsyntax. Ein erster Überschriftenversuch innerhalb des Widgets wurde als literale Zeichen angezeigt und anschließend regulär auf HTML-Überschriften korrigiert. Verwendet wurde unter anderem:

```html
<$list filter="[tag[Aufzug]!tag[Erledigt]]">
<h3><$link/></h3>
<$transclude mode="block"/>
</$list>
```

Die beobachtete Stärke ist das gemeinsame Lesen lebender Originalquellen. Der konkrete Werkstattablauf soll diese Arbeitsweise ohne selbst geschriebene Abfragesyntax ermöglichen. Es wird keine allgemeine menschliche Überlegenheit behauptet. Die Datensätze sind nicht gleich groß; TiddlyWiki enthielt sechs synthetische Tiddler, die Werkstatt zwölf Ausgangsnotizen. Wiederöffnen wurde dort im selben Dokument geprüft, keine Datenträger- oder Browser-Neustartpersistenz.

## Änderung und erneute vollständige Nutzung

**Notizmappe öffnen…** steht beim gewöhnlichen Notizeditor. Die Mappe liest die direkten Beziehungen und aktiven Notiz-Textverweise der aktuellen Übersichtsnotiz. Sie ist eine Leseansicht vorhandener Notizen, kein neuer Inhaltstyp und keine zweite Ablage. Gewöhnliche Notizen lassen sich gemeinsam suchen und als Beziehungen **Quelle** ergänzen.

Originaltexte, bestätigte Gerücht-/Questzustände und gespeicherte Raumhinweise stehen zusammen. Geschlossene Spuren sind zunächst ausgeblendet und bleiben in den ursprünglichen Beziehungen erhalten. Unlesbarer Status wird ausdrücklich angezeigt und nicht automatisch ausgewählt; fehlende oder beschädigte Quellen sind gesperrt. Raum-Buttons öffnen den vorhandenen Key-Editor und kehren zur Mappe zurück. Die Übersicht verfolgt direkte Quellen, keine rekursive Auflösung des Beziehungsgraphen.

Die Auswahl geht entweder an einen vorhandenen Besuch oder legt über die vorhandene Vorbereitung einen neuen Abend/Besuch an. Nur IDs werden verknüpft. Vorhandene Besuchsquellen, Vorlesetext, Belohnung und andere Besuche bleiben erhalten. Die normale Spielabendmappe zeigt anschließend alle gewählten vollständigen Quellen. Vorhandene Quelltexte werden dabei nicht in den Plan kopiert.

Bewusst abgewählte Quellen und selbst eingegebene Namen bleiben bei Filterwechsel und Aktualisierung erhalten. Eine inzwischen geänderte Quelle wird zur erneuten Entscheidung abgewählt. Während des Schreibens bleibt die übergebene Auswahl unveränderlich. Der Schreiber prüft innerhalb derselben Transaktion die Übersichtsrevision, direkte Mitgliedschaft sowie Notizrevision und bestätigten Statusstand der ausgewählten Mitgliedsnotizen. Ein Konflikt ändert weder Besuch noch Quittungen; bei einem neuen Abend wird die ganze Anlage zurückgerollt. Verlorene Antworten verwenden die bestehenden unveränderlichen Session-/Preparation-Belege, keine automatische zweite Buchung und keinen neuen Schreiber.

Nach der Umsetzung wurde der vollständige Ablauf erneut über die echte Desktop-Oberfläche ausgeführt, jeweils mit frischen synthetischen Profilen:

- Drei Quellen in einer gemeinsamen Auswahl zuordnen; offene Texte und Zustände zusammen lesen; geschlossene Spur anzeigen und wieder ausblenden; eine ausdrückliche Abwahl und eigene Zielnamen dabei erhalten; Archiv öffnen und zurückkehren.
- App regulär schließen, frisch starten, Übersicht suchen und Mappe wieder öffnen. Der folgende Abend wird ohne erneute Suche nach den Mitgliedsnotizen vorbereitet.
- Einmal den bestehenden Besuch ergänzen, einmal ausdrücklich einen benannten neuen Spielabend und Besuch anlegen. Die Übergabe wird tatsächlich bei **200 % Zoom** ausgeführt. Die normale Spielabendmappe enthält danach die offene Frage und den NSC, nicht den geschlossenen Quelltext.
- Nach Prozessende bestätigt der Speichervergleich: sämtliche zwölf ursprünglichen Notizdokumente, ursprünglicher Plantext, importierte Raumabschnitte und bestätigter geschlossener Status sind unverändert. Die Übersichtsbeziehungen enthalten weiterhin alle drei Quellen; die vorbereitete Auswahl besteht genau aus Übersicht, Nera und offenem Gerücht.

[Vorhandener Besuch](after/result.json), [frisch geöffnete Notizmappe](after/fresh-thread.png), [ausgeführte Übergabe bei 200 %](after/prepare-200percent.png), [fertige Spielabendmappe](after/next-session-packet.png), [ausdrücklich neuer Abend](after-new-plan/result.json).

## Technischer Nachweis und Grenzen

Produktquellstand **c437ccc4ae9463f022177036a0b339852e705607**, integriert durch **1d605b92**, Version **0.135.0**. Die [Validierungsdatei](validation.json) bindet die nativen Läufe an fünf übereinstimmende Desktop-Artefakthashes. Als betroffene Regressionen wurden die Inhaltssuche/Verknüpfung beim Besuch und der gemeinsame Notizeditor neben dem Raum-Key erneut bedient. Unveränderte frühere Abläufe wurden nicht allein zur Berichtspflege vollständig wiederholt.

**152 von 152 gezielten Tests bestanden.** Acht native App-Starts auf diesen Artefakten endeten regulär; ihre eigenen Haupt-PIDs waren anschließend nicht mehr vorhanden. Beide Typprüfungen sowie Plugin- und Desktop-Build bestanden. Die [gezielten Tests](targeted-tests.txt) prüfen Speicher und tatsächliche Preparation-/Session-Integration sowie asynchrone UI-Antworten. Dazu gehören Statuswechsel inklusive Zurückwechseln, beschädigte Quellen, aktive Textverweise jenseits einer Vorschaugrenze, 40 Treffer pro Seite und höchstens 200 geprüfte Mitgliedsquellen pro Anforderung, Kampagnenwechsel, veraltete Kontrollen, reine Lesezugriffe, Transaktionsrollback, unveränderte Quittungswiederholung und spätere Texteingaben während der Bestätigung. Die Mappe öffnet bis zu zehn erste Quelltexte selbstständig; weitere werden beim Aufklappen gelesen. Weitere Kandidaten für das Hinzufügen benötigen eine genauere Suche, wenn die erste Seite mit 40 Treffern nicht genügt.

Die zuvor veröffentlichte vollständige [CI 38814025322](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/actions/runs/38814025322) auf **e4072f63** ist erfolgreich: 2.890 Tests, 2.889 bestanden, keiner fehlgeschlagen, einer übersprungen. Das ist ein eigener Nachweis für den früheren Stand. Die vollständige CI des neuen veröffentlichten Kopfes wird separat verfolgt. PR-Merge, Release, Nutzerabnahme und Abschluss des breiteren Vergleichsauftrags sind damit nicht behauptet.

Nachtrag: Die vollständige CI `38818222989` auf `76406c96` endete mit drei Fehlern bei 2931 Tests. Die Ursachen, korrigierten Test-Port-/DOM-Umgebungen und der verifizierte Kopier-Dialogzustand sind im [Nachbereitungs-Zwischenstand](../note-followup-20261016/README.md) dokumentiert. Die dortige neue Gesamt-CI ist ein eigener Nachweis; dieser frühere Kopf wird nicht nachträglich als grün bezeichnet.
