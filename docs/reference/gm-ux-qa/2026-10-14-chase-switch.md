# GM-UX-QA: Zwei Verfolgungen sicher abwechselnd führen

PRODUCT/SCOPE und der LiveScene-Fachvertrag verlangen mehrere unabhängige
Runtime-Masken. Wegwerfkampagne im realen Electron-Desktop, echter SQLite-Store,
zwei laufende Verfolgungen. Nutzer-Vault und installierte Ausgabe unberührt.

- Ausgangsproblem: Bei verzögerter Auswahl von „Waldpfad“ blieb „Hafenflucht“
  bedienbar. Ein Klick bestätigte dort Runde 1, obwohl die Auswahl bereits
  Waldpfad meinte. Derselbe native Vorherlauf änderte den Abstand auf 36 m;
  „Aktualisieren“ setzte ihn auf 18 m zurück. Normales App-Ende, anschließend
  erwarteter Fehlschlag der Schutzassertion.
- Vergleich: Die [einfache Markdown-Liste](2026-10-14-chase-markdown.md) hält
  dieselben zwei unabhängigen Tabellen. Eine tatsächliche UTF-8-Bearbeitung mit
  frischem Dateilesen [erhält den Hafenabschnitt](2026-10-14-chase-markdown-comparison.json)
  und [ändert nur Waldpfad](2026-10-14-chase-markdown-after.md). Die direkte Textbearbeitung braucht
  keinen asynchronen Besitzerwechsel; auf Papier bleiben unbestätigte Werte
  ebenso sichtbar. [Obsidian](https://obsidian.md/help/advanced-syntax)
  dokumentiert entsprechende Tabellen. [Foundrys Encounter-Tracker](https://foundryvtt.com/article/combat/)
  unterstützt mehrere Begegnungen derselben Scene mit getrennten Runden/Zügen.
  Dies ist ein Vergleich der dokumentierten Fähigkeiten; keine eigene
  Foundry-/Obsidian-Bediensitzung und keine gemessene Papiergeschwindigkeit.
- Änderung: Request-Generation plus Campaign-/Scene-/Maskenprüfung sperren
  Schreiben bis zur passenden Antwort. Fehler erscheinen lokal; Aktualisieren
  lädt genau die fehlgeschlagene Auswahl. Veraltete Antworten und abgetrennte
  Teilnehmer-Callbacks dürfen keinen anderen Owner ändern. Die Auswahl zeigt
  den tatsächlich gewählten Titel einschließlich Status. Offene Rundenwerte,
  Komplikation und übrige Eingaben bleiben je Maske innerhalb des geöffneten
  Workspace erhalten; unveränderter Stand baut Teilnehmerfelder nicht neu auf.
  Erst Bestätigung verbraucht die Rundenvorschläge. Auch eine zunächst fehlende
  Bestätigungsantwort wird per Receipt aufgelöst und verbraucht dieselbe Runde.
- Ergebnis: Native Auswahl B sperrt alte Aktionen, selbst ein direkt ausgelöster
  alter Handler schreibt nichts. A bleibt bytegleich bei Runde 0; B erhält
  genau Runde 1, 36 m, Erschöpfung 1 und „Umgestürzter Wagen“. Refresh,
  A→B→A/B und Lesefehler-Retry behalten die Vorschläge. Transportfehler nach
  tatsächlicher Buchung, anschließende Statusabfrage und frischer Store belegen
  genau eine Runde. Nativer Neustart zeigt die bestätigten Werte. Abschluss
  erzeugt genau einen Historyeintrag. CRLF-Teilnehmernotizen bleiben exakt.

Ein bestätigter Rundenklick speichert die vollständige Runde zusammen und die
Receipt-Abfrage vermeidet eine zusätzliche Buchung. Das ist in dieser Aufgabe
belegt; eine einfache Texttabelle bietet diesen Produktvorteil ohne zusätzliche
Logik nicht. Eine allgemeine Zeitersparnis oder Konkurrenzparität ist daraus
nicht ableitbar. **Offene Rundenvorschläge sind weiterhin flüchtig:** sie sind
keine dauerhaften Entwürfe nach Kampagnenreaktivierung oder Neustart. Nur bereits
bestätigte Runden sind hier restartqualifiziert. Diese Einschränkung bleibt ein
weiterer Prüf-/Verbesserungspunkt und zählt nicht als bestandene Autosave-Abnahme.

80 Regressionen, Desktop-Typprüfung und Build bestanden. Drei native Abläufe
(Verfolgung, Kampf, Archiv) mit je Neustart, sechs normale App-Ausgänge.
Spätere Integration der Spielerinitiative erhält kanonische gemeinsame
Teilnehmerzustände; deren Coretests sind enthalten. Keine separate native
Freigabe der Spieleranzeige. QA-Spitzenverbrauch 733,2 MiB bei 4-GiB-Limit,
kein Swap und keine Subagenten. [Verifikation](2026-10-14-chase-switch-verification.json).

[Vorher](2026-10-14-chase-switch-before.json),
[Nachher](2026-10-14-chase-switch-after.json),
[Ergebnisbild](2026-10-14-chase-switch-after.png),
[Prüflog](2026-10-14-chase-switch-checks.log).
Gesamtes Produkt, alle Kombinationen und praktische Originalvergleiche bleiben offen.

Fortsetzung desselben Tages: Die oben dokumentierte flüchtige Entwurfslücke ist
mit [dauerhaften Verfolgungsentwürfen](2026-10-14-chase-drafts.md) geschlossen.
Die ursprünglichen Belege und ihre damalige Reichweite bleiben historisch erhalten.
