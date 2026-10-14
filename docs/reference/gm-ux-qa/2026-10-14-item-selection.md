# GM-UX-QA: Gegenstände vorbereiten und sicher vergeben

PRODUCT/SCOPE: unabhängiger Katalog, nachvollziehbare Definitionen/Revisionen,
Beute und geschützte Nutzerprosa. ROADMAP: Katalog → Spielabend/Live/Loot.
Eigene native Electron-Wegwerfkampagne mit echtem SQLite-Store; kontrollierte
IPC-Verzögerung/-Einzelfehler nur in dieser Instanz. Kein Nutzer-Vault,
keine Abnahme einer installierten Release-Version.

- Ausgangsproblem: „Persönliche Beute vergeben“ ohne geladenen Shop erzeugte
  keinen Eintrag und keine neue Rückmeldung. Ursache war die zu breite
  `shopReady`-Sperre aus der vorherigen Shopkorrektur.
- Beim Wechsel Seil → Heiltrank blieb das Seil verwendbar: Die zurückgehaltene
  Heiltrankantwort ließ eine tatsächlich gebuchte Seilvergabe zu. Eine reine
  Namensänderung normalisierte zusätzlich unveränderte CRLF-Beschreibungen.
  Native Baseline: ohne Shop null Vergaben; während Wechsel Seil 1, Heiltrank 0;
  Prosa nicht bytegleich. Regulär geschlossen, danach absichtlich rote Assertion.
- Änderung: Katalogaktionen funktionieren unabhängig von Shops. Eigener
  angeforderter Definitionskontext sperrt Bearbeiten, Kopieren, Trash,
  Vergabe und Schatzanlage während Laden/Fehler; Dispatch prüft zusätzlich.
  Lokaler Fehler mit Wiederholen desselben Gegenstands; falsche/veraltete
  Antworten werden verworfen. Unvollständige Entwürfe bleiben korrigierbar,
  gültige Eingaben werden vor dem Wechsel gesichert. Unbearbeitete Prosa bleibt
  originalgetreu; SRD bleibt geschützt und wird als eigene Kopie bearbeitet.
- Ergebnis: Ohne Shop Seil an Ada vergeben und unverteiltes Seil angelegt.
  Wechsel blockiert alte Aktionen, danach genau ein Heiltrank an Ada.
  Richtwerte 200/500 Kupfer und Definitionen korrekt, Borin leer, ursprüngliche
  Seildefinition payload-/checksumgleich. Aktuelle Definition in Hafenbestand
  übernommen. Umbenennen erhält Prosa; nach Neustart eigene Kopie gespeichert,
  beide Beschreibungen bytegleich. Lesefehler/Wiederholen nativ geprüft.

Vergleich: [ausgeführte Markdown-Aufgabe](2026-10-14-item-catalog-markdown.md).
[Foundry Items](https://foundryvtt.com/article/items/) dokumentiert Bearbeiten,
Duplizieren und die Übergabe an Figuren als separate Owned Items. Der Vergleich
stützt die unabhängige Katalogaufgabe und explizite Zuordnung. Dokumentenvergleich;
keine eigene Foundry-Nutzung, kein allgemeiner Geschwindigkeits-/Paritätsbeleg.
Foundry-Kopien und hier revisionierte Katalogreferenzen sind verschiedene Modelle.

Regression: zehn neue Store-/Rendererfälle in
`tests/desktop-item-selection.test.mjs`; native Probe
`tools/test-desktop-item-selection.mjs`. Zusätzlich bestehende Shop-/Ledger-
und Kontextfälle sowie integrierte Masken-, Legendary-, Musik-, Import- und
Generierungsquellenprüfungen. 78 Tests, Typprüfung, Build; drei native Abläufe
mit je Neustart und sechs normalen App-Ausgängen. Version 0.46.0.
Ein interner Testworker, höchstens ein eigener schwerer Job; Ressourcen im Beleg.
Details: [Verifikation](2026-10-14-item-selection-verification.json).

Offen: vollständige Produkt-/Kombinationsabdeckung, praktisch genutzter
Konkurrenzvergleich und menschliche GM-Zeitmessungen. Diese Runde ist keine
Gesamtproduktabnahme.

Belege: [Vorher](2026-10-14-item-selection-before.json),
[Nachher](2026-10-14-item-selection-after.json),
[Ergebnisbild](2026-10-14-item-selection-after.png),
[Lesefehler/Wiederholen](2026-10-14-item-selection-retry.png),
[Prüflog](2026-10-14-item-selection-checks.log).

Mitintegrierte neue NPC-Vorgaben, Condition-Shortcuts und Legendary-Turngrenzen
sind keine vollständige native Fachabnahme dieser neuen Features. Die geprüfte
Masken-Reconciliation erhält kanonische Gesundheit und setzt beim nächsten
legendären Akteur dessen Zugbudget korrekt zurück.
