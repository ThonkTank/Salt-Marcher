# GM-UX-QA: Einen Besuch über seinen Hinweis wiederfinden

PRODUCT/SCOPE: unabhängige manuelle Timeline, wiederholte Besuche, geschützte
Prosa und explizite Übergabe in eine unabhängige LiveSession. Native Electron-
Wegwerfkampagne mit echtem SQLite-Store, 65 Besuche gleichen Titels, zunächst
ohne Party, Ort oder LiveSession. Kein Nutzer-Vault und keine Release-Abnahme.

- Ausgangsproblem: Ein GM weiß noch „Kupfersiegel“, aber nicht, in welchem
  Hafenbesuch die Notiz stand. Die Timeline zeigte ausschließlich nummerierte
  Titel. Der native Vorherlauf musste 64 Besuchseditoren öffnen, bis die nur in
  Besuch 64 gespeicherte Notiz sichtbar wurde. Dabei blieb der Plan unverändert;
  App schloss normal und die fehlende Suchmöglichkeit scheiterte absichtlich an
  der abschließenden Assertion.
- Vergleich: [gleich aufgebaute Markdown-Sitzungsnotiz](2026-10-14-timeline-markdown.md)
  mit allen 65 Notizen; tatsächlicher `rg -n Kupfersiegel`-Aufruf findet den
  Hinweis direkt in Zeile 324. [Obsidian Search](https://obsidian.md/help/plugins/search)
  dokumentiert Inhaltsuche; [LegendKeeper](https://www.legendkeeper.com/features/)
  führt Volltextsuche als Funktion. Eigene Nutzung des nativen Produkts und der
  Textdatei; Konkurrenzvergleich anhand Primärdokumentation, keine eigene
  Obsidian-/LegendKeeper-Bedienung oder menschliche Zeitmessung.
- Änderung: Lokale Suche über Titel, Szenennotizen und verknüpfte Ortsnamen.
  Mehrere Suchwörter müssen vorkommen; Groß-/Kleinschreibung ist unabhängig.
  Trefferzahl und ausgeblendete aktuelle Auswahl sind sichtbar. Filterung lässt
  den geöffneten Editor und dessen Eingaben unberührt. Nummern und Umordnen
  beziehen sich auf die vollständige Timeline. Neue Besuche leeren die Suche,
  damit sie sichtbar bleiben. Plan-/Kampagnenwechsel setzen die flüchtige Suche
  zurück; alte Besuchs-Callbacks dürfen andere Pläne nicht umlenken.
- Ergebnis: Eine Suchanfrage plus ein zusätzlich geöffnetes Ergebnis findet denselben
  Hinweis. Vorher wurden 64 Besuche einschließlich der anfangs geöffneten Szene
  geprüft: 63 zusätzliche Editorwechsel statt einem zusätzlichen Wechsel. Offene Erstnotiz bleibt erhalten,
  null Treffer schließen den Editor nicht. Verschieben, Hinzufügen/Entfernen
  behalten 65 IDs und übrige CRLF-Prosa. Frischer Store und nativer Neustart
  bestätigen Reihenfolge und Texte. Vorbereitung allein legt keine Runtime an.
  Nach ausdrücklichem Fortsetzen/Bestätigen wird genau der gefundene Besuch
  übernommen; Live-Notizen werden geändert, die Originalnotiz bleibt unverändert.

Die Differenz belegt eingesparte Navigationsschritte in dieser Fixture, keine
allgemeine Überlegenheit gegenüber Texteditoren oder Konkurrenz. Die Suche
umfasst die genannten Timeline-Felder; zusätzliche Vorlese-/Gruppenfelder des
Spielabend-Editors sind nicht Teil dieser Suche.

Regression: sieben Renderer-/Storefälle in tests/desktop-timeline-search.test.mjs
mit kontrollierten Ports für die unabhängigen Zusatzeditoren; der native Lauf
benutzt sämtliche echten Controller. Zusätzliche Plan-, Runtime-, Masken-,
Musik- und Katalog-/Shopprüfungen. 90 Tests, Typprüfung, Build; drei native
Abläufe mit je Neustart, sechs normale App-Ausgänge. Version 0.47.0.
Ressourcenwerte und genaue Zählgrenze im Beleg. [Verifikation](2026-10-14-timeline-search-verification.json).
Vollständige Produkt-/Kombinationsabdeckung und praktische Konkurrenzparität
bleiben offen.

Belege: [Vorher](2026-10-14-timeline-search-before.json),
[Nachher](2026-10-14-timeline-search-after.json),
[Ergebnisbild](2026-10-14-timeline-search-after.png),
[Prüflog](2026-10-14-timeline-search-checks.log).
Mitintegrierte rundenbasierte Effekte sind regressionsgeprüft; der native
Kampflauf ersetzt keine vollständige Fachabnahme aller neuen Effekte.
