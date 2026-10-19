# Shops: Besitzer und Zeitfolgen

Grundlage: Program Capabilities L557–612, Revision
`9de85c1a26f526acbc1af332ac5962e185c0aab2`. SMR-08/AC-10 verlangt NPC-/Ortshops,
atomaren Handel, Ownerwarnung/Neuzuordnung, wiederherstellbare Beziehungen sowie
manuelles, fixes und gewichtetes Auffüllen. Kaufpreis-/Ledgerregeln stehen im
[Lootfachplan](loot-balance.md).

## Vorhandener Ablauf und Grenzen

Gegenstandsvergabe und Handel verwenden das ohnehin geladene Live-Roster für
Figurennamen, Aktivstatus und Mitgliedschaftsrevisionen. Ein zusätzlicher
Fortschrittsread mit XP-, Rast- und Kampfdaten ist dafür keine Voraussetzung.
Käufer sind aktive, Verkäufer und Beuteempfänger auch inaktive Rosterfiguren;
archivierte Figuren bleiben ausgeschlossen. Die Writer prüfen ihre jeweiligen
Revisions- und Bestandsbasen weiterhin selbst.

`items.ts.owner` prüft die Zuordnung; `ShopView.unavailable` berücksichtigt
Shop- und Ownertrash. Ownerrestore erhält die Beziehung, hebt ausdrücklichen
Shoptrash nicht auf. Shopreads zeigen defekte Records einzeln. Der Shopeditor
kann denselben Shop mit Bestand, Preisen und Historie neu zuordnen; Handel
behält die strukturierte Gegenpartei. Vor NPC-/Orttrash fehlen noch die
Warnung mit betroffenen Shops und eine geführte Neuzuordnung.

Die Sceneprojektion bezieht neben ihren vorbereiteten Figuren die tatsächlich
am aktuellen Ort platzierten NSCs ein (`npcIdsAtLocation`). Ein Händler braucht
keine zusätzliche Figurengruppe, damit sein Shop direkt im Livebereich erscheint.
Lesen verändert weder Position, Bestand noch Ledger; Owner-/Shoptrash und
Handelsregeln bleiben beim vorhandenen Shopreader/-writer.

Der Handelsverlauf zeigt bei Käufen den tatsächlich gezahlten Gesamtpreis und
bei Verkäufen den tatsächlichen Erlös aus dem bereits gespeicherten
Ledger-Snapshot des Belegs. Spätere Preis-, Definitions- und Mengenänderungen
ändern diese Anzeige nicht. Fehlende historische Beträge bleiben ausdrücklich
unbekannt; heutige Richt- oder Shoppreise werden nicht eingesetzt. Die Anzeige
benötigt keine weitere Abfrage und verändert keine historischen Payloads.

Der Verlauf startet mit den neuesten 50 Belegen. „Ältere Einträge laden“ liest
weitere Seiten über die letzte angezeigte Belegkennung; spätere Buchungen
verschieben diese Fortsetzung nicht. `shopHistory` bindet die Kennung an
Kampagne und Shop und liest ausschließlich vorhandene `shop_event`-Zeilen.
Ein Index auf Kampagne/Shop unterstützt diese Lesegrenze. Es gibt keinen neuen
Verlaufsbestand und keine Umschreibung alter Belege. `ShopView.historyNext`
bleibt wegen bestehender gespeicherter Receipts optional; deren volle erste
Seite kann über dieselbe letzte Belegkennung weitergelesen werden. Unabhängige
Kampagnenkopien remappen auch diese Fortsetzung innerhalb gespeicherter
Shopreceipts; Quellbelege und ihre Payloads bleiben in der Quelle unverändert.

Der Renderer erhält bei Ladefehlern sichtbare Einträge und offene Handelsfelder.
Shopwechsel, neue Shopstände und Kampagnenaktivierung entwerten frühere Antworten;
der nächste Versuch bleibt ausdrücklich. Nach der letzten Seite erhält die
Statuszeile den Fokus, wenn zuvor der nun verborgene Ladeknopf fokussiert war.
Die seitenweise Verlaufsanzeige ist
kein Lastbeleg für das gesamte Shoplesen: Der vorhandene Auffüllzeithinweis
prüft weiterhin den gespeicherten Gesamtverlauf, um spätere bestätigte
Auffüllungen gegenüber einer zurückliegenden Gruppenzeit kenntlich zu machen.
Eine spätere Beschleunigung dieses Fachreads benötigt denselben belegten
Zeitstand und eigene Last-/Integritätsprüfung.

`tools/test-desktop-shop-switch.mjs` prüft zusätzlich Kauf → Teilverkauf →
regulärer Neustart mit Bestand und beiden Beträgen am selben Shop; die
gezielten Storeprüfungen erhalten Rundungs-, Replay- und Rollbackregeln.

Der Handelsbereich verwendet eine gemeinsame ausdrücklich gewählte Figur für
Kauf und Verkauf. Inaktive Figuren bleiben als Verkäufer verfügbar; Kaufbuttons
sind für sie gesperrt. Überschrift, Buchungsschaltflächen und Verlauf nennen die
Figur auch beim Scrollen. Katalog und Shops besitzen direkte Bereichsschalter;
Shopdaten, Zeitbasis und Warenlieferungen sind gesammelt aufklappbar.
Gemeinsame Ladefehler und deren Wiederholen bleiben in beiden Bereichen sichtbar. Neue Shops
und die geführte Ortszuordnung öffnen diese Verwaltung. Der Gesamtweg bis zum
Teilrückverkauf und Neustart steht in `tools/test-desktop-shop-trade.mjs`.
Der native Ablauf prüft tatsächlich abweichende Preise (5,01 GM Kauf / 0,77 GM
Erlös), 55 spätere Auffüllungen, geänderte heutige Shoppreise und erneutes
Lesen der alten Beträge nach einem kontrollierten Seitenfehler. Regulärer
Close/Fresh und 100/200 Prozent bleiben getrennte Laufbelege; vollständige
SMR-AC-10- und Plattform-/Owner-Abnahme bleiben offen.
[Beobachteter Vergleich und Grenzen](../../reference/gm-ux-qa/2026-10-14-shop-switch.md#kauf-und-teilrückverkauf-unter-einer-figurenwahl--19102026).

`restockDue` schreibt mit bestätigter Scenezeit/Weltfolgen atomar. Nur eine
fällige automatische Regel benötigt den Shopowner: fehlende Owner manueller
oder erst später fälliger Shops blockieren keine unabhängige Zeit. Shopstruktur
und Preise werden weiterhin geprüft. Eine fällige Regel mit defektem Owner
verlangt vollständigen Rollback; Reads/Handel bleiben bei Ownerfehler gesperrt.
Originaldaten werden nicht repariert oder neu gespeichert.

Shop-/Ownertrash unterbricht Auffüllen. Alte Fälligkeiten bleiben bestehen;
ein aktiver Step nach Restore kann Perioden nachholen. Diese aktuelle Wirkung
ist noch keine bestätigte Trashzeitpolitik. Gewichtete Auffüllung über gespeicherte Shoptabellen ist implementiert;
Kalenderereignisse als eigener Triggertyp bleiben offen.

Die vorhandenen festen Intervalle sind verstrichene Millisekunden. Shopeditor,
Zeitbasis und Zeitkonflikthinweis benennen ihre Tage deshalb als jeweils
24 Stunden. Ein frei konfigurierter Kampagnentag kann eine andere Länge haben;
Kalenderänderungen deuten bestehende Intervalle oder bestätigte Fälligkeiten
nicht um. Kalendergebundene Regeln brauchen einen eigenen ausdrücklichen
Triggertyp und gespeicherte Kalender-/Regelbasis, keine still geänderte Einheit
bestehender Werte. Für diese Klarstellung gibt es keine Datenmigration.

Automatische Auffüllungen halten pro Zeile ursprüngliche Regelparameter, Anzahl
der Perioden, erste/letzte Fälligkeit und Mengen vor/nach dem Vorgang fest.
Spätere Regeländerungen verändern diese Fakten nicht; alte Einträge bleiben ohne
Rekonstruktion lesbar. Vor dem Speichern gilt derselbe Strukturvertrag wie beim
Lesen. Eine nicht darstellbare nächste Fälligkeit verwirft den gesamten Abschluss
einschließlich Zeit, anderer Auffüllungen, Verlauf und Receipt. Die
[Storeprüfung](../../../tests/desktop-shop-restock-boundary.test.mjs) deckt
Mehrzeilenregeln, Korrekturen, Replay, Fresh und vollständigen Rollback ab.

## Reise, gemeinsame Zeit und unabhängige Kopie

`world.ts.journeyRow` prüft Route, Abschnittsdauern, Gesamtdauer und
Checkpoint gemeinsam an Read-, Write- und Backupgrenzen. Die Route enthält
2–1001 benachbarte Hexe mit begrenzten ganzzahligen Koordinaten; jede Kante
besitzt eine positive sichere Ganzzahldauer. Die gespeicherte Gesamtdauer
muss ihrer mathematisch exakten Summe entsprechen. Eine exakt darstellbare
Summe oberhalb der sicheren Ganzzahlgrenze bleibt zulässig; gerundete Summen
werden abgewiesen. Beschädigte Fachwerte mit gültiger Checksum dürfen weder
weitergeschrieben werden noch den sicheren Backupvorgänger ersetzen. Es gibt
keine automatische Reparatur oder Migration.

Spätere Clock-/Positionsbasen dürfen bei historischen Reisen fehlen: Lesen
bleibt möglich, Fortsetzung ohne diese Basis wird abgelehnt. Ein Interrupt
auf dem letzten Hex mit `nextIndex === route.length` ist gültig; ausdrückliches
Fortsetzen bestätigt nur die Ankunft, ohne Bewegung, Zeit oder Restock erneut
zu buchen. Route und Abschnittsdauern waren bereits im Erstformat Pflicht.

Die [Reise-/Restockprüfung](../../../tests/desktop-restock-journey.test.mjs)
verbindet zwei Gruppenuhren, manuelle Korrektur, Regelwechsel, offene Reise,
Restart, Receiptwiederholung und unabhängige Kopie. Nur neue Perioden wirken;
Source und Snapshot bleiben unverändert und bestätigte Historie behält ihre
ursprüngliche Regel. Ein Fehler im zweiten Abschnitt rollt den ersten samt
Position, Zeit, Bestand und Receipts zurück. Gegenproben prüfen beschädigte
Routen, Dauern, Summen und Checkpoints an allen drei Grenzen sowie gültige
Paused-/Ended-/Arrived-/Zielinterruptzustände. Diese Storebelege ersetzen keine
native Reisebedienung oder vollständige Produktabnahme.

## Nächste Lieferungen

1. Vor Ownertrash betroffene Shop-IDs/Revisionen zeigen: abbrechen, verfügbarem
   Owner derselben Campaign zuordnen oder die Beziehung in Trash behalten.
   Owner und vollständige aktuelle Shopzuordnung gemeinsam prüfen/bestätigen;
   neue/anders zugeordnete Shops verlangen eine neue Vorschau. Identität,
   Bestand, Preise und Historie erhalten. Konkurrenz, ungültiges Ziel,
   Campaignwechsel, unbekannten Commitausgang, Fresh, Copy und Rollback prüfen.
2. Ownertrash → mehrere Scenezeiten → Restore → nächster Step an einer festen
   Regel prüfen. Fortsetzungsregel/nächste Fälligkeit sichtbar erklären;
   bestehende Auffüllungen und manuelle Korrekturen nicht erneut anwenden.
3. Kalendergebundene Regeln und katalogweite Filter an revisionierte Tabellen/Filter,
   fällige Trigger und gespeicherte Zufallsbasis binden. Tatsächliche Auswahl,
   Menge und Herkunft in `shop_event` festhalten; Retry/Fresh erhalten das
   Resultat. Eine Zeitquelle, keine Bestätigungsfolge je konfiguriertem Ereignis.
4. Gemischte Shops und lange Historien messen; erst bei Bedarf fällige Queries
   und fortgesetzte Listen liefern. Native Ownerwarnung, Zeitfehler, verlorene
   Handelsantwort, Tastatur, 200 % und Auffindbarkeit aus Scene abnehmen.

[Storeprüfungen](../../../tests/desktop-shop-owner-time.test.mjs) belegen manuelle/
fällige/zukünftige Regeln mit fehlendem Owner, Rollback sowie Ownertrash,
Restore und Neuzuordnung ohne Verlust der Shopidentität. Native Warnung,
Trashzeitpolitik und gewichtete Regeln bleiben offen.

## Gewichtete Warenlieferungen

Der Shopeditor bietet benannte Tabellen aus vorhandenen Mengenstapeln, exakte
Dezimalgewichte, Mengenbereiche und 1–100 Ziehungen je Lieferung. Die aktuelle
Shoprevision bindet Änderungen; jede Tabelle behält zusätzlich eine Revision
und eine gespeicherte Zufallsbasis. Einzelstücke sind ausgeschlossen. Manuelles
Würfeln speichert Auswahl, historische Definition, Mengen und Seed im selben
Receipt-/Bestandsabschluss; derselbe Auftrag liefert keine zweite Lieferung.

Optionale Intervalle verwenden verstrichene Millisekunden bzw. ausdrücklich
24-Stunden-Tage. Neu angelegte/geänderte Regeln beginnen an der gewählten
Scenezeit; bestätigte Fälligkeiten werden nie rückwirkend neu gewürfelt. Die
gemeinsame bestätigte Zeitverarbeitung addiert nur ausgewählte Zeilen und
hält erste/letzte Fälligkeit, Anzahl, Regelrevision und konkrete Ergebnisse
im Shopverlauf. Kampagnenkopien remappen Tabellen-/Bestandsidentitäten und
behalten Zufallsbasis und bestätigten Bestand. Kalenderereignisse können ab0.121 Lieferungen auslösen; katalogweite dynamische
Filter sind ab0.122 als zusätzliche Warenquelle implementiert.

Im Shop wird entweder ein Zeitintervall oder ein Agendaereignis gewählt. Die
Ereignisrevision wird gebunden. Der erste Beginn liegt strikt nach der gewählten
Scenezeit; frühere Termine werden bei neuer/erneuerter Bindung nicht nachgeliefert.
Einmalige Ereignisse setzen nach der Lieferung ihre nächste Fälligkeit auf null.
Wiederkehrende Ereignisse holen alle neuen Beginne gesammelt nach, auch bei
Reiseabschluss und unabhängig vom Gruppenort. Ein zweiter Gruppenzeitstrang
liefert bereits abgearbeitete Termine nicht erneut. Ereignisänderung, Papierkorb
oder fehlendes Ereignis pausieren die Bindung sichtbar im Shop; „Ereignisbindung
erneuern“ startet mit der aktuellen Revision ab der ausdrücklich gewählten Zeit.
Der Verlauf bewahrt Ereigniskennung/-revision/-namen, Regel und konkrete Mengen.

Ein Schritt mit mehr als100.000 Zufallsziehungen wird vor der Auswahl mit
einem Hinweis auf kleinere Zeitabschnitte abgewiesen; es wird nichts gekürzt.
Bestandsüberlauf verwirft den gesamten bestätigten Zeitabschluss. Dieser
Operationsschutz ist keine Qualifikation für große gemischte Shopbestände.

## Dynamische Kataloglieferungen

Auch leere Shops können eine Kataloglieferung anlegen. Suche, Kategorie, Magie,
Seltenheit, Einstimmung und Quelle filtern dieselben Definitionen wie der
Gegenstandskatalog. Die Treffervorschau zeigt Anzahl, Beispiele und gesperrte
Definitionen. Jeder passende Gegenstand erhält dieselbe Chance; frei gewichtete
Einzelzeilen stehen weiterhin über die vorhandene Mengenstapelquelle bereit.

Bei Bestätigung wird der aktuelle Katalog innerhalb derselben Transaktion
ausgewertet. Auch mehrere nachgeholte Termine verwenden diesen aktuellen Pool;
vergangene Katalogzustände werden nicht erfunden. Papierkorb und unlesbare
Definitionen sind ausgeschlossen, ihre Anzahl wird dokumentiert. Die History
bewahrt Filter-/Regelrevision, Poolgröße/-Hash und konkrete Definitionen,
Revisionen, Namen, Mengen und tatsächlich verwendete Preise. Ein leerer Pool
liefert keine Waren und bestätigt den Termin trotzdem.

Nur gezogene Waren erzeugen neue Zeilen. Ein vorhandener Mengenstapel derselben
Definition und Revision erhält die Menge; Preise und Notizen bleiben erhalten.
Andernfalls gilt der in der Lieferregel festgelegte Kauf-/Verkaufspreis.
Einzelstücke bleiben erhalten. Manuelle, Intervall- und Ereignisauslöser nutzen
denselben Ablauf. Neue passende Definitionen werden ohne Regeländerung beim
nächsten Termin berücksichtigt. Historische Ergebnisse bleiben unverändert.
