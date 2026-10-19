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

## Kauf und Teilrückverkauf unter einer Figurenwahl · 19.10.2026

Erneut vollständig geprüft auf `6e53670d2` plus den durch Bundlehashes
bezeichneten Änderungen: Borin kauft drei Seile im Hafenladen für insgesamt
6 GM, verkauft eines für 1 GM zurück und findet nach regulärem Schließen und
frischem Start seine zwei Seile, den Händlerbestand drei und beide Beträge wieder.
Adas ursprüngliche vier Seile sowie Borins zwei Heiltränke bleiben unverändert.

Im [Ausgangsstand](2026-10-19-shop-trader-before.png) blieb nach Borins Kauf
weiterhin Ada als Verkäuferin gewählt. Der tatsächliche Durchlauf korrigierte
dies vor dem Verkauf ausdrücklich; ein unbeabsichtigter Verkauf wurde dabei
nicht ausgeführt. Katalog und Shopverwaltung verlangten zusätzliche Scrollwege;
zwischen Kauf und Verkauf standen die gewichteten Auffüllregeln.

Jetzt sind Katalog und Shops über zwei direkt sichtbare Bereichsschalter
aufrufbar. Der [Handelsbereich](2026-10-19-shop-trader-after.png) verwendet eine
Figurenwahl für beide Richtungen; inaktive Figuren dürfen weiterhin verkaufen,
können aber keinen Kauf auslösen. Eine aufklappbare Verwaltung bündelt Shopdaten,
Zeitbasis und Warenlieferungen. Die nötige Bestands-/Preisbearbeitung bleibt am
Artikel erreichbar. Neue Shops und Ortszuordnungen öffnen die Verwaltungsfelder.
Der Katalog nennt den gewählten Shop an seinem direkten Rückweg.

Verkaufsüberschrift, Verlauf und Buchungsschaltflächen nennen die handelnde
Figur. Gerade beim [Scrollen bei 200 %](2026-10-19-shop-trader-after-200.png)
bleibt sie damit unmittelbar an der Buchungsaktion sichtbar. Die bisherige
zweite Figurenwahl und die Verwaltung zwischen Kauf und Teilverkauf entfallen;
Mengen, verhandelbare Gesamtpreise und die Auswahl des tatsächlich verkauften
Originalstapels bleiben notwendig. Münzen werden gemäß Originalanforderung
weiterhin außerhalb dieses Ledgers verwaltet.

`tools/test-desktop-shop-trade.mjs` prüft denselben Gesamtweg bei 100 % und 200 %,
einschließlich [identischem Verlauf nach Neustart](2026-10-19-shop-trader-fresh.png),
kanonischer Portionen, Preisanteile, Händlergegenpartei und unveränderter anderer
Gegenstände. Danach werden Katalogsuche, ausgewählter Shop am Rückweg und
erneutes Öffnen der Verwaltungsfelder ohne Datenänderung tatsächlich bedient. Vier normale App-Ausgänge in den abschließenden Zoomläufen.
`tools/test-desktop-shop-switch.mjs` besteht weiterhin die verzögerten Wechsel,
Lesefehler/Wiederholen, korrigierbaren Entwürfe, geschützte CRLF-Notizen und
101-Kupfer-Rundung mit Teilverkauf/Neustart. 55 gezielte Store-/DOMtests bestanden;
die 17 Shopfälle wurden nach der letzten Beschriftungsänderung erneut bestanden.

Die gleiche GM-Aufgabe wurde tatsächlich in der öffentlichen
[Foundry-PF2e-Demo](https://demo.foundryvtt.com/) unter Foundry 14 Build 365 mit
eigenen, eindeutig benannten Testakteuren abgeschlossen. Der ausgeführte Weg
war **manuelle Inventarführung mit Transaktionsnotiz**: drei Seile im eigenen
Figurenbogen erfassen, Händlerbestand von fünf auf zwei setzen, Kaufpreis im
Artikeltext notieren; für den Teilverkauf Figurenbestand auf zwei und
Händlerbestand auf drei setzen und 1 GM Erlös ergänzen. Nach erneuter Anmeldung
wurden beide Bestände und die [beiden Beträge am Original](2026-10-19-shop-trader-foundry-fresh.jpg)
wieder gelesen. Die ursprüngliche leere Zuordnung des öffentlichen Player-01-Slots
wurde wiederhergestellt und die eigene Sitzung abgemeldet.

Die versuchte automatische Händlerübertragung kam nicht zustande und ist
weiterhin **nicht qualifiziert**. Dieser Vergleich beansprucht weder einen
vollständigen Foundry-Handelsmechaniknachweis noch Münzabrechnung oder einen
kontrollierten Serverneustart. Er belegt den tatsächlich ausgeführten manuellen
GM-Arbeitsweg bis zum erneut brauchbaren Ergebnis. SaltMarcher spart dabei die
getrennte Bestands- und Verlaufsführung bereits durch seinen bestehenden Writer.
Die aktuelle Verbesserung beseitigt zusätzlich die widersprüchlichen
Figurenauswahlen und die beobachteten Verwaltungsumwege. Allgemeine menschliche
Verständlichkeit oder Überlegenheit wurden nicht gemessen.

[UI-Spuren, kanonische Ergebnisse, Versionen, Bundlehashes und Prozessenden](2026-10-19-shop-trader.json).
Native Quellbuilds sind geprüft; Paketinstallation und Owner-Abnahme bleiben offen.
