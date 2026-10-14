# Shopbesitzer, Wiederherstellung und Zeitfolgen

Die bestätigten Program Capabilities L557–612, Revision
`9de85c1a26f526acbc1af332ac5962e185c0aab2`, verlangen NPC-/Ortshops, atomaren
Handel, Ownerwarnung samt Neuzuordnung, wiederherstellbare Beziehungen sowie
manuelles, fixes und gewichtetes Auffüllen. Diese Ziele bleiben Teil von
SMR-08/AC-10; der aktuelle fixe Zeitweg schließt das Shopprodukt noch nicht.
Kaufpreis-/Ledgerregeln stehen im [gemeinsamen Lootfachplan](loot-balance.md).

## Aktueller Stand und konkrete Grenzen

`storage/items.ts.owner` prüft die Shopzuordnung und den verfügbaren Owner.
`ShopView.unavailable` berücksichtigt sowohl Shoptrash als auch Ownertrash.
Die Beziehung wird dabei erhalten: Wiederherstellung des Owners reaktiviert
seine Beziehung, aber keinen ausdrücklich gelöschten Shop. `readShops` macht
unlesbare Shop-/Ownerrecords einzeln sichtbar. `items-ui.ts` lässt die bestehende
Ownerauswahl bearbeiten; eine Neuzuordnung schreibt denselben revisionierten
Shop samt Verlauf. Kauf und Verkauf behalten die strukturierte Gegenpartei.

Die Vorbereitung löscht NPC-/Ortsinhalte über `note-trash`/`location-trash`.
Ihre Buttons in `preparation.ts` prüfen nach Flush ihren ursprünglichen Context
und Ownerstand, bieten jedoch noch keine ausdrückliche Warnung mit betroffenen
Shops und keinen geführten Neuzuordnungsweg vor dieser Aktion. Der allgemeine
Shopeditor ersetzt diesen fachlich geforderten Ablauf nicht.

`restockDue` konsumiert den bestätigten Zeitfortschritt in derselben Transaktion
wie Scene-/Worldfolgen. Zuvor lud es auch die Besitzer rein manueller Shops.
Ein fehlender Besitzer blockierte dadurch sogar einen unabhängigen Clockstep,
obwohl der Shop keine automatische Regel besaß. Nun werden nur Shops mit einer
fälligen Regel an ihren Owner gebunden. Bestandsstruktur und Preise werden
weiterhin geprüft; bei einer fälligen Regel bleiben Ownerfehler und vollständiger
Rollback bindend. Vor einer zukünftigen Fälligkeit blockiert allein der fehlende
Owner keine unabhängige Zeit. Shopreads und Handel geben den Fehler weiterhin
aus; beschädigte Originaldaten werden nicht neu gespeichert oder verschwiegen.

Bei Shop-/Ownertrash wird der Bestand während der Sperre nicht aufgefüllt.
Der bisherige Code lässt die alte Fälligkeit bestehen: Ein späterer aktiver
Clockstep kann diese Perioden nachholen. Diese Feststellung ist keine bestätigte
Trash-/Restockpolitik. Wiederherstellung muss diesen Fall ausdrücklich erklären;
keine stille Umdeutung gespeicherter Zeit oder automatische Datenreparatur.
Gewichtete Auffüllungen und Kalenderereignisse sind noch nicht angeschlossen.

## Nächste ausführbare Lieferungen

1. **Ownerwarnung und Neuzuordnung vor Trash.** Betroffene Shopidentitäten,
   Revisionen und Verfügbarkeit gezielt zur ausgewählten NPC-/Ortsidentität lesen.
   `PreparationAPI`/IPC/Store und `preparation.ts` erhalten einen kleinen Preview-
   und Bestätigungsweg: abbrechen, ausgewählte Shops an einen verfügbaren Owner
   derselben Campaign übertragen oder mit dem bisherigen Owner in Trash halten.
   Vor dem Dialog Basis-/Ownereingaben speichern; durchgehend ursprünglichen
   Campaigntoken, Owner-ID/Revision und betroffene Shoprevisionen halten. Der
   Writer prüft die vollständige aktuelle Shopzuordnung erneut in einer
   Transaktion. Ein zwischenzeitlich neuer zugehöriger Shop verlangt eine neue
   Vorschau. Keine Folge aus einzeln ungeprüften Shopwrites und anschließendem
   Ownertrash. Bestehende Shopidentität, Bestand, Preise und Historie erhalten;
   eine ausdrückliche Shoptrashentscheidung wird bei Ownerrestore nicht aufgehoben.
   Benötigte defekte Records blockieren die Entscheidung mit sichtbarem Grund.
   Abnahme: mehrere Shops, konkurrierende Neuzuordnung/Anlage, invalides Ziel,
   Dialog-/Campaignwechsel, Commitverlust, Fresh, Copy und vollständiger Rollback.
2. **Trashzeit und Restock nachvollziehbar schließen.** An einer festen Regel
   Ownertrash → mehrere unabhängige Scenezeiten → Ownerrestore → nächster Step
   prüfen. Bestehende aufgezeichnete Auffüllungen behalten. Die fachlich gewählte
   Fortsetzungsregel und nächste Fälligkeit müssen der Spielleitung sichtbar sein;
   Wiederherstellung ist nicht automatisch eine Erlaubnis, vergangene Worldsteps
   oder manuelle Bestandskorrekturen nochmals anzuwenden. `shop_event`, Clockbasis
   und gespeicherte Regel im selben Storeabschluss binden. Wiederholung und
   Restart ändern nur denselben bestätigten Ausgang, keine fremde Scenezeit.
3. **Gewichtete und kalendergebundene Regeln liefern.** Regeltyp, bindende
   revisionierte Itemtabelle/Filter, nächster Trigger und gespeicherte Zufallsbasis
   am Shop halten. Tatsächlich fällige Clock-/Kalenderereignisse konsumieren;
   keine zweite Zeitquelle. Vor Ausführung aktuelle zulässige Itemdefinitionen
   und Regeln prüfen, tatsächliche Auswahl/Mengen/Herkunft in `shop_event`
   erklären. Retry/Fresh verwenden die bestätigte Auswahl. Manuell verwaltete
   Bestandszeilen bleiben außerhalb dieser Regeln. Automatische konfigurierte
   Restocks benötigen keine zusätzliche Bestätigungsfolge pro Ereignis.
   Item-/Tabellenquellen und Randfälle mit keinen zulässigen Kandidaten am echten
   Writer nachweisen, bevor ein allgemeiner Generatoranschluss geplant wird.
4. **Aufwand und Bedienung qualifizieren.** Der Zeitweg scannt weiterhin alle
   Shoprecords; der frühe Fälligkeitsfilter spart Ownerreads, ist keine breite
   Lastqualifikation. Gemischte manuelle/fällige Shops und lange Historien messen;
   bei Bedarf gezielte fällige Queries und fortgesetzte Listen gemeinsam liefern.
   Aktuelle Validatorgrenzen wie 1.000 Bestandszeilen ersetzen keine Quellen-
   oder Produktqualifikation. Native Ownerwarnung, Zeitfehler, Tastatur, 200 %,
   Auffindbarkeit aus Scene und Statusklärung einer verlorenen Handelsantwort
   bleiben Bestandteil der Endabnahme.

## Aussagekräftiger lokaler Nachweis

`tests/desktop-shop-owner-time.test.mjs` nutzt den tatsächlichen SQLite-Store:
fehlender Owner eines manuellen Shops blockierte vor der Korrektur den Clockstep.
Eine fällige automatische Regel bleibt bei Ownerfehler atomar gesperrt; eine
zukünftige Regel bindet den Owner erst bei Fälligkeit. Ownertrash, Restore und
Neuzuordnung erhalten Shopidentität, Wortlaut, Bestand und Verlauf. Die Fixture
weist keine native Warnung, Trashzeitpolitik oder gewichtete Regeln nach.
