# Shops: Besitzer und Zeitfolgen

Grundlage: Program Capabilities L557–612, Revision
`9de85c1a26f526acbc1af332ac5962e185c0aab2`. SMR-08/AC-10 verlangt NPC-/Ortshops,
atomaren Handel, Ownerwarnung/Neuzuordnung, wiederherstellbare Beziehungen sowie
manuelles, fixes und gewichtetes Auffüllen. Kaufpreis-/Ledgerregeln stehen im
[Lootfachplan](loot-balance.md).

## Vorhandener Ablauf und Grenzen

`items.ts.owner` prüft die Zuordnung; `ShopView.unavailable` berücksichtigt
Shop- und Ownertrash. Ownerrestore erhält die Beziehung, hebt ausdrücklichen
Shoptrash nicht auf. Shopreads zeigen defekte Records einzeln. Der Shopeditor
kann denselben Shop mit Bestand, Preisen und Historie neu zuordnen; Handel
behält die strukturierte Gegenpartei. Vor NPC-/Orttrash fehlen noch die
Warnung mit betroffenen Shops und eine geführte Neuzuordnung.

`restockDue` schreibt mit bestätigter Scenezeit/Weltfolgen atomar. Nur eine
fällige automatische Regel benötigt den Shopowner: fehlende Owner manueller
oder erst später fälliger Shops blockieren keine unabhängige Zeit. Shopstruktur
und Preise werden weiterhin geprüft. Eine fällige Regel mit defektem Owner
verlangt vollständigen Rollback; Reads/Handel bleiben bei Ownerfehler gesperrt.
Originaldaten werden nicht repariert oder neu gespeichert.

Shop-/Ownertrash unterbricht Auffüllen. Alte Fälligkeiten bleiben bestehen;
ein aktiver Step nach Restore kann Perioden nachholen. Diese aktuelle Wirkung
ist noch keine bestätigte Trashzeitpolitik. Gewichtete Auffüllung und
Kalenderereignisse fehlen.

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
3. Gewichtete und kalendergebundene Regeln an revisionierte Tabellen/Filter,
   fällige Trigger und gespeicherte Zufallsbasis binden. Tatsächliche Auswahl,
   Menge und Herkunft in `shop_event` festhalten; Retry/Fresh erhalten das
   Resultat. Eine Zeitquelle, keine Bestätigungsfolge je konfiguriertem Ereignis.
4. Den Übergang Reiseabschnitt → gemeinsamer Restock → unabhängige Kopie
   gegen `world.ts.executeWorld`, `items.ts.restockDue`, Store-Zeitconsumer und
   `campaign-data.ts` prüfen. Zwei Gruppenuhren, eine manuelle Korrektur, geänderte
   Regel und offene Journey kopieren; nur neue Perioden dürfen wirken. Source
   und Snapshot bleiben unverändert, bestätigte Historie behält ihre damalige
   Regel. Restart/Receiptwiederholung bucht nichts erneut. Ein Fehler im zweiten
   Abschnitt rollt auch den ersten samt Position, Clock, Stock und Receipts zurück.
   Diese ergänzende Crossport-/Copyabnahme ist noch offen.
5. `world.ts.journeyRow` als gemeinsame Read-/Write-/Backupgrenze vervollständigen:
   benachbarte begrenzte Route, eine positive exakt darstellbare Dauer je Kante,
   passende Gesamtdauer und Checkpoint/Ankunftsstatus prüfen. Gültige Zwischen-,
   unterbrochene, beendete und kopierte Reisen erhalten. Beschädigte Altstände
   offenlegen; Originalbytes und sicheren Backupvorgänger bewahren, keine stille
   Reparatur. Gegenproben mit gültiger Checksum und ungültigen Fachwerten an Read,
   Write und Backup; Laufbelege sind dafür noch offen.
   Dabei sind zwei gültige Alt-/Randzustände zu erhalten: spätere Clock-/Positions-
   basen dürfen fehlen, solange die Reise lesbar bleibt und ihre Fortsetzung ohne
   diese Basis abgelehnt wird. Ein Interrupt auf dem letzten Hex darf bereits
   `nextIndex === route.length` besitzen; erst ausdrückliches Fortsetzen bestätigt
   die Ankunft, ohne noch einmal Bewegung, Zeit oder Restock zu buchen. Route und
   Abschnittsdauern waren dagegen bereits im ursprünglichen Journeyformat Pflicht.
6. Gemischte Shops und lange Historien messen; erst bei Bedarf fällige Queries
   und fortgesetzte Listen liefern. Native Ownerwarnung, Zeitfehler, verlorene
   Handelsantwort, Tastatur, 200 % und Auffindbarkeit aus Scene abnehmen.

[Storeprüfungen](../../../tests/desktop-shop-owner-time.test.mjs) belegen manuelle/
fällige/zukünftige Regeln mit fehlendem Owner, Rollback sowie Ownertrash,
Restore und Neuzuordnung ohne Verlust der Shopidentität. Native Warnung,
Trashzeitpolitik und gewichtete Regeln bleiben offen.
