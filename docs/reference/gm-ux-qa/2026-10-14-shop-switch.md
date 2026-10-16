# GM-UX-QA: Marktbesuch ohne falschen Händler oder Verkäufer

PRODUCT/SCOPE: Shops, atomarer Handel, geschützte Prosa, zuverlässiger Neustart.
ROADMAP E2E-03 und SMR-AC-10. Eigene native Electron-Wegwerfkampagne mit echtem
SQLite-Store. Verzögerungen und Einzelfehler ausschließlich an eigener IPC;
kein Nutzer-Vault und keine Abnahme der installierten Release-Version.

- **Ausgangsproblem:** Beim Wechsel Hafenladen → Bergladen blieb der Hafenbestand
  kaufbar. Der Kauf wurde dort gebucht (5 → 4), obwohl Bergladen angefordert war.
  Beim anschließenden Verkäuferwechsel Ada → Borin blieb Adas Inventar aktiv;
  der Verkauf entfernte ihr ursprüngliches Seil (4 → 3), Borins zwei Tränke
  blieben unverändert. Der Bergladen bekam dadurch ein zusätzliches Seil (7 → 8).
  Baseline schloss normal und scheiterte danach absichtlich an der Sperrassertion.
- **Weiterer reproduzierter Befund:** Leeren Shopnamen korrigieren und speichern
  änderte unberührte CRLF-Notizen. Separater nativer Vorherbeleg mit regulärem
  Schließen und Neustart, Assertion `shopNotesPreserved=false`.
- **Änderung:** Angeforderter Shop und geladener Verkäufer bilden getrennte,
  bewachte Lesekontexte. Alte Aktionen sind während Laden/Fehler gesperrt;
  Inventaroptionen verschwinden sofort. Schreibdispatch und gebundene
  Bestandsschaltflächen prüfen den Kontext zusätzlich. Fremde/verspätete
  Antworten werden verworfen. Lokale Fehler bieten Wiederholen desselben
  Ziels. Unvollständige Shopentwürfe bleiben im bisherigen Editor korrigierbar.
  Nicht bearbeitete Shopprosa behält ihre Originalbytes. Status/Wiederholen
  stehen im Shopbereich und verändern die Zweispaltenstruktur nicht.
- **Ergebnis:** Expliziter Kauf beim Bergladen: Hafen 5, Berg 6; neue Kaufportion
  für Ada mit 500 Kupfer tatsächlicher Zahlung. Borins Verkauf: Tränke 2 → 1,
  Verkaufsportion mit 300 Kupfer Erlös, Bergladen erhält einen Trank. Adas
  ursprünglicher Eintrag bleibt payload-/checksumgleich. Beide Lesefehler und
  Wiederholen, Reparatur des leeren Namens und unveränderte CRLF-Notizen grün.
  Native Wiederöffnung bestätigt Mengen und Zuordnung.

Vergleich: [manuell geführte Markdown-Aufgabe](2026-10-14-shop-markdown.md).
[Foundry Item Piles](https://foundryvtt.com/packages/item-piles/) dokumentiert
Händler mit Preisen/Mengen und Handel zwischen Figuren; die
[Autorenanleitung](https://github.com/fantasycalendar/FoundryVTT-ItemPiles/blob/master/docs/creating-item-piles.md)
bindet das Untersuchen an eine konkrete Figur. Das ist die passende Referenz für
explizite Parteien. Dokumentenvergleich; keine eigene Item-Piles-Nutzung und
kein praktisch belegter Geschwindigkeits-/Paritätsanspruch.

Regression: zehn Store-/Rendererfälle in tests/desktop-shop-switch.test.mjs;
native Probe tools/test-desktop-shop-switch.mjs; angrenzende Ledger-, Import-,
Musik-, Kampf- und Regelkontextprüfungen. Prüfzahlen, Quellhashes, normale
App-Ausgänge und Ressourcen: 58 Tests, Typprüfung, Build; Shop, persönliches
Ledger und Kampf je mit nativem Neustart grün (sechs normale App-Ausgänge).
Letzter QA-Job 782 MiB Spitze, ein interner Testworker, ein eigener schwerer Job.
Version 0.44.0. Mitintegrierte legendäre Aktionen sind regressionsgeprüft; der
native Kampflauf ersetzt deren vollständige manuelle Fachabnahme nicht.
 [Verifikation](2026-10-14-shop-switch-verification.json).

Offen bleiben vollständige Produkt-/Kombinationsabdeckung, eigene Nutzung des
Konkurrenz-Handels und allgemeine GM-Geschwindigkeitsvergleiche. Dieser belegte
Teilablauf ist keine Gesamtproduktabnahme.

Belege: [Handel vorher](2026-10-14-shop-switch-before.json),
[Handel nachher](2026-10-14-shop-switch-after.json),
[Prosa vorher](2026-10-14-shop-switch-shop-prose-before.json),
[Shopfehler](2026-10-14-shop-switch-shop-read-error.png),
[Inventarfehler](2026-10-14-shop-switch-seller-read-error.png),
[Prüflog](2026-10-14-shop-switch-checks.log).
