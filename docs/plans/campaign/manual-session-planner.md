# Spielabendpläne: bearbeiten, ersetzen und kopieren

Stand: 14.10.2026. Umfang: [SCOPE](../../SCOPE.md), [#69](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/69)
und [Quellenregister](../../scope-sources.json). Manuelle Planung benötigt weder
Planungsparty noch Generator; Generierung und Übernahme ins Live-Spiel sind
zusätzliche Abläufe.

Bindende Generierungsvorgaben: [Iststand, Quellenprüfung und nächste Schritte](generation-constraints.md).

## Aktueller Anschluss

Die Desktopvorbereitung speichert Pläne, geordnete Besuche, exakte Notizen und
optionale Ortsverweise im gemeinsamen SQLite-Store. `session-ui.ts`,
`storage/session.ts` und `storage/plan-replacement.ts` ergänzen Besuchsinhalte,
Gruppen, Belohnungen sowie Ersetzung und Wiederverwendung. Die reinen
`ManualPlan`-Codecs prüfen den Planvertrag. Das ältere `ManualPlannerPanel`
und seine Browservorschau sind flüchtige Prototypen; ihre Memory-Tests belegen
keine native Desktoppersistenz.

Der Live-Besuchsbinder zeigt übernommene Besuche seitenweise mit festgehaltenen
Texten, Ergebnissen und Weltverweisen. Planänderungen ersetzen diese Übernahmen
nicht; ältere Übernahmen ohne vollständige Bindung werden als solche markiert.
Datenbank-Reopen und unabhängige Kopie sind geprüft; die native Bedienprobe
bleibt offen.

## Daten- und Bedienvertrag

- Pläne behalten ihre Identität und monotone Revision. Neue oder kopierte
  Besuche bekommen eigene kampagnenlokale IDs; gleiche Orte verbinden keine
  Besuchsidentitäten. Unbenannte Pläne und ortlose Besuche sind gültig.
- Eingaben bleiben an Campaign, Plan, Besuch und ursprüngliche Revision
  gebunden. Aktualisieren übernimmt keine offene Eingabe. Veraltete Antworten
  dürfen fremde Texte, Auswahl oder einen neueren Stand nicht verändern.
- Ersetzen prüft Ziel- und Vorlagenbasis gemeinsam in einer Transaktion.
  Reihenfolge, Ortsverweise, Prosa und Wissensbezüge werden übernommen;
  „Timeline leeren“ entfernt die Besuche ohne neue Party oder neuen Plannamen.
- Noch nicht angenommene Gruppen werden unabhängig kopiert. Angenommene
  Worldgruppen und platzierte Beute behalten ihre Identität und ihren Zustand.
  Unbestätigte Gruppeneingaben bleiben bei Bereinigung als unabhängige Gruppe
  erhalten. Vorschläge der entfernten Timeline werden verworfen.
- Vergebene Belohnungen bleiben abgeschlossen. Offene Rewards erhalten eigene
  IDs; bereits platzierte Beute bleibt derselbe Worldbestand. Eine Vergabe in
  der Kopie verändert nicht den Vergabestatus der Vorlage.
- Die Historie hält Plan, Vorlage sowie vorherige und neue Besuchs-IDs fest.
  Unabhängige Kampagnenkopien remappen auch gelöschte historische Besuchs-IDs.
  Freie Texte, Quellpakete und archivierte Originalbytes bleiben unverändert.
  Laufende Scenes behalten ihren übernommenen Inhalt und ihre Herkunft.

## Einzelne Szenen wiederverwenden

`session-copy-ui.ts` lässt Besuche auswählen, ordnen und als neuen Abend oder
am Ende eines bestehenden Plans übernehmen. `copy-visits` prüft Quell- und
Zielbasis in derselben Transaktion wie neue Besuchsdetails und Receipt.
Dialog-, Source-/Target- und Controlstände bleiben getrennt gebunden; entfernte
Controls und verspätete Reads/Writes ändern keine neuere Auswahl.
[Dialogprüfung](../../../tests/desktop-session-copy-context.test.mjs) und
[Speicherprüfung](../../../tests/desktop-session-copy-integrity.test.mjs) prüfen
Reopen, Auswahl, Antwortreihenfolge, Quellschutz, Append, unabhängige offene
Rewards, Replay und atomaren Rollback.

Offen: den Sessionreceipt an den bestehenden Commitstatus anschließen und
ungeklärte Originalcommands vor Send dauerhaft sichern. Auswahländerung/Reset
verwerfen bisher den lokalen Retrystand. Nach Fresh muss eine verlorene Antwort
am gleichen Command geklärt werden, damit Append keine Besuche verdoppelt.
Die Quellenliste liest weiterhin die vollständige Preparation; 40 sichtbare
Karten begrenzen den Quellaufwand nicht. Gebuchte Beute, mehrfach referenzierte
Worldgruppen, Trash/Restore sowie native Fokus-, Tastatur- und Lastgrenzen
benötigen ihre betroffenen Abnahmen.

## Geprüft und noch offen

[Ersetzung und Kopie](../../../tests/desktop-plan-replacement-copy.test.mjs)
prüfen den echten Writer, Export/Import, Fresh, Historienverweise und exakte
Texte. [Worldgruppen und Rewards](../../../tests/desktop-plan-replacement-world.test.mjs)
prüfen erhaltene NPC-/Treasure-Identitäten, Vergabestatus, Retry und Rollback.
[Bereinigung](../../../tests/desktop-session-retention.test.mjs) erhält Rohentwürfe
und prüft Ersetzung aus demselben Plan. Das sind Storeprüfungen, keine native
Bedien-, Crash- oder Undoabnahme.
[Vorschlagsprüfungen](../../../tests/desktop-session-proposal-store.test.mjs) kontrollieren gemeinsam gelesene und gesicherte Vorschläge, Budget- und Quellenbezüge, unabhängige Generierungskennungen, historischen Beuteausgleich sowie unveränderte Sicherungen bei beschädigten Daten. Ältere Partyprofile und archivierte Wissensverweise bleiben gültige Vorschauhistorie.

Die nächsten konkreten Prüfungen und Korrekturen:

1. Beschädigte oder fortentwickelte NPCs mit mehreren Besuchsreferenzen
   ersetzen, leeren, kopieren und frisch öffnen: HP, Zustände und Identitäten
   erhalten; keine weiteren NPCs erzeugen.
2. Allokierte/verkaufte Beute und korrigierte Gutschriften kombinieren:
   effektive Bestände und Ledger vor/nach Ersatz, Retry, Kopie und Fresh
   vergleichen; bestätigte Fakten nicht erneut ausführen.
3. Offene Profil-, Besuchs-, Gruppen- und Rewardeingaben vor Ersatz sichern.
   Verzögerte Antworten, Contextwechsel, Schreibfehler und unklare Commits
   prüfen; dieselbe Command-ID per Status aufklären. Danach Save → normal
   schließen → frischer Prozess sowie Tastatur, 200%-Ansicht und Undo/Redo
   im nativen Produkt prüfen.

Für Entwürfe und Belohnungen gilt der bestehende
[Daten- und Recoveryanschluss](../runtime/combat-and-narrative-recovery.md).
Eine zweite Timelinearchitektur oder generische Historyabstraktion ist nicht nötig.
