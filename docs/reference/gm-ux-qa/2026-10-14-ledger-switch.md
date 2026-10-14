# GM-UX-QA: Beim Verkauf den gewählten Fund treffen

Scope: PRODUCT (Nachbereitung), SCOPE (Lootledger/Stacks/Verkauf/Weitergabe),
ROADMAP E2E-02. Eigene Wegwerfkampagne; kein Nutzer-Vault, keine installierte
Release-Abnahme. Native Electron-Nutzung mit echtem CampaignStore/SQLite;
kontrollierte Verzögerung/Fehler nur an dessen eigener IPC-Antwort.

- Ausgangsproblem: Ada besitzt vier Seile à 2 GM und zwei Heiltränke à 5 GM.
  Seil öffnen, Heiltrank auswählen und dessen Detailantwort zurückhalten.
  Das Seil blieb bearbeitbar. Verkauf von Menge 1 für insgesamt 3 GM buchte
  tatsächlich ein Seil: Rest Seil 3, Trank 2, kumulativ 19 GM.
  Native Baseline schloss regulär und scheiterte danach absichtlich an der
  Assertion, dass die alte Verkaufsaktion gesperrt sein muss.
- Vergleich: [ausgeführte Markdown-Buchführung](2026-10-14-ledger-markdown.md).
  [Foundry Items](https://foundryvtt.com/article/items/) dokumentiert explizites
  Öffnen des Gegenstands und getrennte Owned Items auf Figurenbögen; Detail- und
  Inventarverhalten sind systemabhängig. Keine eigene Foundry-Nutzung und kein
  Paritäts-/Zeitmessungsbeleg. [Obsidian Tabellen](https://obsidian.md/help/advanced-syntax)
  bestätigen die einfache editierbare Alternative; kein eigener Obsidian-UI-Test.
- Änderung: Auswahl bindet sofort die angeforderte ID; altes Detail verschwindet,
  Formular und Stapel bleiben bis zur gültigen Antwort gesperrt. Schreibdispatch
  prüft zusätzlich aktuelle ID/Owner/Lesestatus. Lokaler Fehler mit Wiederholen
  lädt denselben Eintrag. Verspätete/fremde Antworten werden verworfen, auch
  nach Figurwechsel hin und zurück. Ein anderer erfolgreich geladener Eintrag
  setzt seinen Händler korrekt, auch wenn der erste Leseversuch scheiterte.
  Fieldset-Sperre erhält individuelle Stapelsperren (ein Stück nicht teilbar).
- Ergebnis: zurückgehaltener Wechsel sperrt Verkauf und gültige alte Stapelaktion.
  Expliziter Trankverkauf: Seil 4 (Payload/Checksum unverändert), Trank 1,
  verkaufte Trankportion 1 mit 300 Kupfer Erlös, kumulativ 1600 Kupfer,
  Borin unverändert, genau ein loot-sold-Verlaufseintrag. Fehlgeschlagenes
  Seillesen bleibt gesperrt; Wiederholen lädt Seil. Native Wiederöffnung behält
  die Mengen; Ein-Stück-Stapel bleibt unteilbar. Beide App-Starts schließen normal.

Regression: tests/desktop-ledger-switch.test.mjs (echter Store + Renderer-DOM),
tools/test-desktop-ledger-switch.mjs (native Vorher-/Nachher-Probe, --before
absichtlich rot auf altem Produkt). Gezielt zusätzlich Ledger-Historie,
Lootbilanz, Kampagnen-Atomicity, Membership, Maskenabgleich und mitintegrierte
Konzentrations-/Scenezeit-Grenzen. Prüfprotokoll und Ressourcenwerte siehe
[Verifikation](2026-10-14-ledger-switch-verification.json) und [Prüflog](2026-10-14-ledger-switch-checks.log).
51 Tests, Typprüfung, Build, zwei native Abläufe mit je Neustart grün; letzter
QA-Job maximal 725,1 MiB laut systemd. Version 0.44.0. Zusätzlich integriert:
gezielte Rettungswürfe; deren verspätete/fremde Gruppenantworten sind separat
regressionsgeprüft. Der native Kampflauf prüft gezielte Angriffe, keine vollständige
Abnahme des neuen Rettungswurf-Workflows.

[Vorher](2026-10-14-ledger-switch-before.json),
[Nachher](2026-10-14-ledger-switch-after.json),
[Ergebnisbild](2026-10-14-ledger-switch-after.png),
[Lesefehler mit Wiederholen](2026-10-14-ledger-switch-retry.png),
[Ein-Stück-Stapel](2026-10-14-ledger-switch-one-unit.png).

Offen: vollständige Produkt-/Kombinationsabdeckung und reale Konkurrenzparität;
dieser begrenzte Befund ersetzt keine Gesamtproduktabnahme.
