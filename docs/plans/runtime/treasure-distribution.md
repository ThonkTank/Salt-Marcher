# Einen Schatz gemeinsam verteilen

Fachumfang: [Nachbereitung und Loot](../../SCOPE.md),
[Encounter-/Rewardvertrag](../../../ROADMAP-SALTMARCHER-CATALOG-ENCOUNTER-PLAN.md)
und [Beutebilanz](loot-balance.md). Der GM wählt aktive Empfänger, verteilt ganze
Einheiten und bestätigt die geprüfte Gesamtverteilung. Restmengen bleiben im
Schatz. XP, Käufe und Münzabbuchungen gehören zu anderen Commands.

## Codeeinstiege der Beuteoberflächen

- **Schatzeditor und Gesamtverteilung:** [`treasury-ui.ts`](../../../src/app/treasury-ui.ts),
  `initTreasury`, erzeugt den Button `treasury-distribute` und bindet
  `TreasureDistribution` aus `treasure-distribution-ui.ts` an den eigenen
  `execute`-Callback des Schatzeditors.
- **Persönliche Beute im Partyfenster:** [`party-topbar-ui.ts`](../../../src/app/party-topbar-ui.ts),
  `initPartyTopbar`, bindet `PartyLootPanel` aus `party-loot-ui.ts` an
  `live.ts:runPartyProgress` → `progression-ui.ts:executePartyProgress`.
  Die Berichtigung nutzt die eigene Figuren-/Postenauswahl des Partyfensters;
  dieser Anschluss liest den Posten vor der Buchung mit ID-/Revisionsprüfung.
- **Live-Ledger: Stapel und Weitergabe:** [`progression-ui.ts`](../../../src/app/progression-ui.ts)
  ruft [`drawLedgerStacks`](../../../src/app/ledger-stack-ui.ts) mit seiner
  Ledgerauswahl und seinem `execute`-Callback auf. Dort beginnen Teilen,
  Zusammenführen und Weitergabe bereits erhaltener Beute.

Alle drei Wege nutzen `window.campaign.executeProgress` und den vorhandenen
Storewriter in `src/app/storage/progression.ts`. Die verschiedenen
Auswahlbesitzer bleiben auch am gemeinsamen Writer erhalten. Für verlorene
Antworten und modale Schreibversuche gilt der gemeinsame
[Bestätigungsweg](../../../ARCHITECTURE.md#modale-buchungen).

## Aktueller Daten- und Bedienweg

`treasure-distribution-ui.ts` liest den ausgewählten Schatz und aktive Figuren,
zeigt Mengen je Posten/Empfänger und eine abschließende Zusammenfassung.
`ProgressAction.allocate-batch` bindet Schatzrevision, Gegenstandsdefinitionen und
Membershiprevision jedes Empfängers. `storage/progression.ts` führt alle
Teilzuweisungen in derselben Transaktion aus. Jede Portion prüft den noch
unverteilten Bestand; erst danach schreibt sie Ledger und History. Der Schatz
bekommt genau eine neue Revision. Ein ungültiger späterer Empfänger, eine falsche
Definition oder ein Ledgerfehler lässt keine frühere Teilzuweisung und kein
Receipt zurück. Keine zweite allgemeine Verteilungsarchitektur.

Ein bestätigtes Receipt entscheidet das Buchungsergebnis. Scheitert danach das
Neuladen von Liste, Schatz, Verlauf oder abhängigen Ansichten, wechselt die
bereits gebuchte Verteilung zur schreibgeschützten Bestätigung. Der
Kampagnenstatus nennt sowohl den gespeicherten
Auftrag als auch den Anzeigefehler; eine zweite Erfolgsmeldung verdeckt ihn nicht.
Der Sender gibt einen Schreibfehler an die noch zugehörige offene
Dialoggeneration zurück; sie zeigt ihn bei den erhaltenen Mengen und scrollt ihn
sichtbar. Schließen und Buchungssperre folgen dem gemeinsamen Bestätigungsweg.
Nach Statusklärung wird der aktuelle Schatz gelesen. Ein Receipt bleibt der
ursprünglichen Verteilung zugeordnet, auch nach persönlichen Korrekturen.

Die Bestätigung trägt die tatsächlich angezeigte Action mit Mengen, Empfängern
und ihren Basen. Veränderte Eingaben brauchen eine neue Prüfung. Ein alter
Bestätigungsaufruf darf weder diese neue Verteilung buchen noch den nächsten
Dialog schließen. Owner, Dialoggeneration und dargestellte Grid-/Empfängerfassung
binden auch entfernte Eingabe-, Auswahl- und Pagingcontrols. Reset stellt
gesperrte Controls wieder her und invalidiert ausstehende Reads sowie den Flush
vor Öffnung. Späte Fehler oder `finally`-Antworten entsperren keine neuere Ansicht.

Storeproben in `desktop-treasure-batch.test.mjs` prüfen Restmengen, mehrere
Empfänger, bekannte und unbekannte Definitionwerte, unveränderte XP-/Rastdaten,
Receiptreplay/Fresh und bytegleichen Rollback bei Mengen-, Definition-,
Membership-, Doppelzuordnungs- und kontrolliertem zweitem Ledgerfehler.
`desktop-treasure-distribution-context.test.mjs` prüft die beschriebenen
Dialog-/Bestätigungsgrenzen. Das qualifiziert lokale Teilverträge, keine native
oder vollständige Recovery-/Portabilitätsabnahme.

## Identität bei fehlendem Schatz-Read

Ein angeforderter Schatz ist erst nach bestätigtem Read die sichtbare Auswahl.
`TreasureDistribution.loadBook` hält währenddessen den Picker beim tatsächlich
geöffneten Schatz. Scheitert der Wechsel, bleiben dessen Rohmengen und Empfänger
sichtbar erhalten; eine frühere Review wird ungültig. Der Fehler benennt, dass
der bisherige Schatz offen bleibt. Erneute Auswahl des gewünschten Ziels liest
neu, ohne automatisch eine Zuweisung zu senden. Nur ein erfolgreicher aktueller
Read übernimmt dessen Identität und leert die neue Verteilung.

Die bestehenden Owner-/Dialog-/Readgenerationen verwerfen ältere Antworten.
Die gelesene Schatzkennung muss zur angeforderten Auswahl passen. Reset entfernt
zusätzlich alte Grid-, Empfänger-, Auswahl- und Pagingprojektionen. Ein Fehler
beim erneuten Öffnen zeigt daher keine früheren Posten; er bleibt lokal sichtbar,
die Prüfung ist gesperrt und Auswahl liest ausdrücklich erneut. Der äußere
Öffnungsablauf darf einen inneren Readfehler nicht als Erfolg überschreiben.

Die Kontextproben prüfen Fehler mit erhaltenen A-Mengen, erfolgreichen B-Retry
mit ausschließlich B-Zuweisung, leeres fehlerhaftes Erstladen und eine alte
Fehlerantwort nach neuer bestätigter Auswahl. Das ist keine dauerhafte Sicherung
unbestätigter Mengen beim Schließen; der unten beschriebene Workingdraftanschluss
bleibt offen. Ledger-/Definition-/Mengenregeln und der vorhandene Batchwriter
bleiben unverändert, ohne Schemaänderung oder zweiten Verteilungswriter.

## Weiteren Schatz anlegen bei offenen Eingaben

`treasury-new` sichert vor dem kanonischen Create den bisherigen Rohentwurf über
`flushTreasury`/`keepTreasuryDraft`. Unvollständige Mengen und freie Notizen werden
als Arbeitsstand erhalten; sie werden dadurch nicht zu bestätigten Schatzmengen.
Scheitert das Sichern, bleibt der bisherige Editor offen und es entsteht kein
neuer Schatz. Weitere Eingaben während des wartenden Keeps werden noch vor dem
Wechsel gesichert. Der vorhandene Pendingguard verhindert doppelte Anlagen bei
schnell wiederholtem Klick. Nach dem Entwurfsdrain wird er erneut geprüft, bevor
die Editorgeneration wechselt: Ein inzwischen gestarteter Applycommand behält
seine Autorität und wird nicht durch den wartenden Create widerrufen. Kampagnen-/Editorwechsel widerrufen den alten Auftrag.

Vor dem Create wird die bisherige Editorgeneration widerrufen; das entwertet
ältere Schatz-Auswahlreads und verzögerte Debouncecallbacks. Sie dürfen
einen danach angelegten Schatz nicht nachträglich aus dem Editor verdrängen.
Rohentwurf, ursprüngliche Schatzrevision/Definitionreferenzen und bereits vergebene
Mengen bleiben im bestehenden Store. Wiederöffnung/Fresh liest denselben Entwurf;
Übernahme verlangt weiterhin den vorhandenen Revisionsabgleich. Kein neues
Draftformat, keine Migration und kein zweiter Schatzwriter.

`desktop-treasury-owner-dom.test.mjs` deckt Create vor Debounce, Keepfehler,
neuere Eingaben während Keep, Doppelklick, Kampagnenwechsel und späte Auswahl ab.
Die Zuordnungsprobe bestätigt zusätzlich den bereits vorhandenen Flushschutz,
ohne dafür eine weitere Produktabstraktion einzuführen. Die native Probe mit tatsächlichem SQLite-Savefehler prüft unvollständige Mengen,
unveränderte Allocations/Ledger, blockierten Create und Wiederaufnahme im Editor
sowie einem frisch geöffneten Store. Diese Grenze betrifft Schatzentwürfe;
die unbestätigten Mengen des separaten Verteilungsdialogs brauchen weiterhin
den unten benannten dauerhaften Workingdraftanschluss.

## Belege nach späterer Korrektur und unabhängiger Kopie

Die Storeprobe in `desktop-treasure-batch.test.mjs` verfolgt eine tatsächliche
Schatzverteilung mit anschließender Weitergabe, Verkauf und Erlöskorrektur sowie
eine XP-Buchung mit späterer verknüpfter Abwärtskorrektur. Statusabfrage und
Wiederholung der ursprünglichen Commands liefern ihre ursprünglichen Receipts;
sie verändern weder neuere XP noch Ledger oder bereits verteilte Mengen.
Der Nachweis gilt auch nach normalem Store-Neustart.

In der unabhängigen Kampagnenkopie verweisen XP-Korrekturen und der
Empfangsverlauf einer Weitergabe auf die kopierten Originaleinträge.
`campaign-data.ts` behandelt dafür ausschließlich
`progress_event(kind=loot-transfer-received).sourceId` als lokale Ledgerreferenz;
Providerquellen und freie Prosa bleiben opaque. Bestehende Quellkampagnen und
Snapshotbytes bleiben unverändert. Keine neue Tabelle oder Migration;
bereits importierte fehlerhafte Historienlinks werden dadurch nicht repariert.

Das qualifiziert Storezustände und Referenzen, keinen echten IPC-Antwortverlust,
UI-Pendingablauf oder portierten Replay eines ursprünglichen Commands.

## Offene kanonische Itemgrenze

Die gepinnte Lootanforderung verlangt unveränderliche Definitionreferenzen mit
Version/Artefakthash auch für historische Generatorruns und kanonische Münzen;
Schätze und Character Loot besitzen ausschließlich Instanz-/Verteilungsfakten.
Die heutigen `Treasure.items`-/Ledgerpayloads enthalten noch kopierte Namen,
Kategorien und Werte. Die vorhandene Versionsauflösung und aktuelle Definition-
Projektion allein erfüllen diesen vollständigen Vertrag nicht.

Vor einer Formatumstellung müssen `storage/progression.ts`, Generatorannahme,
`storage/item-definitions.ts` und Campaigncopy/-import gemeinsam die tatsächlich
beobachteten Altwerte in immutable Legacydefinitionen überführen. Historische
Werte niemals aus einer neueren Definition erfinden oder still aktualisieren.
Originalpayloads und Runprovenienz erhalten; Referenzen und Allocations bei Kopie
vollständig remappen. Die neue Definition muss außerdem die in der Originalquelle
benötigten Stackability-/Container-/Komponentenfakten tragen. Erst mit diesen
Fakten lassen sich nicht stapelbare Einzelinstanzen und gültige Packzuordnungen
an der vorhandenen Schreibgrenze abschließend prüfen. Abnahmen: Altbestand und
Run nach Neustart/Copy exakt, neuer Katalog beeinflusst nur neue Auswahl,
Schatz-/Ledgerkorrektur erhält dieselbe Itemidentität, nicht stapelbare Zuweisung
über einer Einheit schreibt nichts. Dieser Migrations-/Quellenauftrag bleibt
offen; die hier beschriebenen Entwurfs- und Batchtests ersetzen ihn nicht.

## Nächste ausführbare Schritte

1. Den vorhandenen `writeConfirmed('progress', …)`-Weg in `treasury-ui.ts`
   mit der Batchaction bis zur UI qualifizieren: verlorene Antwort nach bestätigtem
   Write, Pendingstatus und Reopen/Fresh. Die native Probe deckt kontrollierte
   Ablehnung, Verlust der Schreibantwort plus fehlschlagende Statusabfrage,
   explizite Klärung ohne Wiederholung und anschließende Korrektur/Weitergabe ab.
   Weitere Crash-/Portabilitätsfälle bleiben offen. OriginalcommandID/Fingerprint und
   neuere Rawmengen getrennt erhalten. Ein bestätigtes Receipt verbraucht nur
   seinen Auftrag; fehlende Antwort erzeugt keine zweite Verteilung.
2. Authored Rohmengen und Empfängerauswahl vor Navigation/Close dauerhaft sichern,
   auch bei ungültigen Zahlen und nicht lesbarer Quelle. Wiederaufnahme benötigt
   ursprüngliche Schatz-/Definition-/Membershipbasis und ausdrückliche Prüfung;
   nicht auf einen frisch gelesenen Stand umbiegen. Andere Workingdraftstores
   dienen als Anschluss, kein paralleles Ledger oder neues Dokumentformat.
3. Ursprung aus verschobenen/angenommenen Rewards, archivierte Figuren,
   Trash/Restore, Definitionänderung und unabhängige Kampagnenkopie einschließlich
   bereits verteilter Mengen qualifizieren. Bekannte Werte bleiben Definitions-
   bzw. historische Ledgerwerte; ein unbekannter Wert wird nicht als null Gold erfunden. Verkäufe und Kaufpreise haben eigene Wahrheiten.
4. Große Schätze/Roster über begrenzte Queries anbinden und Kosten messen.
   25 Posten, acht Spalten und 25 sichtbare Figuren begrenzen die Darstellung,
   nicht bereits die vollständig gelesenen Quellen. Native Tastatur, Dialogscroll,
   Esc/Fokusrückgabe, 200 %, Close/Fresh und langsame Reads separat prüfen.

## Schätze finden und vollständig umhängen ab0.124

Die Schatzliste bietet Titel-/Zuordnungssuche, aktive Gruppen/Orte, einen
Posteingang für unplatzierte oder nicht verfügbare Zuordnungen und optional nur
Restmengen. 25erSeiten werden über denselben Filter fortgesetzt; Antworten älterer
Filter/Aktivierungen werden verworfen. Ein geöffneter Schatz außerhalb der
geladenen Treffer bleibt ausdrücklich als solcher sichtbar, damit offene Eingaben
nicht durch eine Suchänderung verschwinden.

`treasure-anchor` ändert an derselben Schatzidentität genau eine Zuordnung:
Scenegruppe, Ort oder unplaced. Aktuelle Zielverfügbarkeit, Schatzrevision,
Begründung und offene Mengenentwürfe werden im vorhandenen Progressreceipt geprüft.
Mengen, Allocations und persönliche Ledger bleiben erhalten; ursprüngliche
Rewardreferenzen bleiben je Posten nachvollziehbar. Verlauf und Chronik zeigen die
Umhängung. Alte Scenerewards können zusätzlich einen Herkunftsort enthalten; beim
Lesen gilt deren Scene als aktueller Anker. Neue explizite Umhängungen setzen beide
Felder eindeutig. Ein Papierkorbort/archivierte Gruppe bleibt als offene
Zuordnung auffindbar und wird nicht still auf unplaced umgeschrieben.

Unbenannte laufende Gruppen tragen in Liste, Zuordnungsfilter und Zielauswahl
„Unbenannte Gruppe“ mit kurzer Gruppenkennung. So bleibt die gültige leere
Bezeichnung ohne erzwungene Umbenennung auswählbar und wieder auffindbar.
`tools/test-desktop-treasure-anchors.mjs` prüft denselben teilweise verteilten
Fund von der Gruppe zum Ort, nach Neustart in den Posteingang und zurück zur
Gruppe, anschließend erneutes Öffnen und Suche nach der kurzen Kennung.
Bestand, Zuweisungen und das persönliche Ledger werden dabei separat geprüft.

## Anschluss an die persönliche Beute

Nach bestätigter Sammelverteilung zeigt der Dialog die tatsächlich gebuchten
Anteile und den unverteilten Rest. Die Empfängerlinks öffnen die persönliche
Beute direkt. Diese Bestätigung beschreibt die Buchung; spätere Weitergaben
und Korrekturen stehen im Ledger. Veraltete Bestätigungen und Empfängerlinks
können keine neue Buchung oder Navigation auslösen.

In der persönlichen Ansicht bleibt die unverteilte Beute hinter der Rückkehr
zur Gruppe. Die interne Weitergabe steht vor den getrennt aufklappbaren
Verkaufs-, Korrektur- und Stapelaktionen. Ein erhaltener Eintrag mit Menge null
heißt dort „Kein Restbestand“; seine Historie bleibt erhalten.

`tools/test-desktop-treasure-distribution.mjs` führt die Aufgabe mit einem
eigenen Fund vollständig nativ aus: 101 Münzen auf drei Figuren, zwei Tränke,
Adas persönliche Münzmenge mit Grund von 33 auf 32 berichtigen, einen Trank
weitergeben, normal schließen, erneut öffnen und alle Bestände sowie den Rest
prüfen. Der Schatz behält die historisch verteilten 99 Münzen und zwei Restmünzen;
die persönliche Mengenkorrektur ist keine Rückgabe in den Fund. Die abschließende
Leseprüfung kontrolliert Definitionen, Vorher-/Nachher-Verlauf, unveränderte Bytes
des ursprünglichen Verteilungsreceipts, Herkunft, Fortschritt und Weitergabeempfänger.
`--reject-once` ergänzt einen tatsächlich sichtbaren Ablehnungsgrund ohne Ledgerwirkung;
`--reply-loss` ergänzt verlorene Antwort, gesperrten Wiederholungsversuch und die
vorhandene Statusklärung. Die Probe wartet vor dem Zoom auf das geladene Fenster,
entfernt alte Erfolgsdateien und verlangt begrenzte normale Prozessabschlüsse. Das ist ein
gezielter Ablaufnachweis, keine vollständige Loot- oder Produktabnahme.

Die [Ausgangsansicht](../../reference/gm-ux-qa/treasure-distribution-20261019/before-transfer.png),
[Bestätigung](../../reference/gm-ux-qa/treasure-distribution-20261019/after-receipt.png)
und [Weitergabe](../../reference/gm-ux-qa/treasure-distribution-20261019/after-transfer.png)
zeigen den untersuchten Anschluss. Derselbe Fund wurde am 19.10.2026 in
[Bag of Holding](https://www.bagofholding.cloud/) verteilt, der Trank von Ada an
Cleo gegeben und das Blatt nach geschlossenem Tab erneut geöffnet:
[erhaltene Bestände und Rest](../../reference/gm-ux-qa/treasure-distribution-20261019/bag-of-holding-fresh.png).
Die Münzteilung erforderte dort manuelle Rest- und Anteilszeilen; die
Weitergabe war über das Gegenstandsmenü direkt erreichbar. Eine unveränderliche
Buchungshistorie des Vergleichsprodukts ist damit nicht belegt.
