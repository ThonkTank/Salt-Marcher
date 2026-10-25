# Spielabendpläne: bearbeiten, ersetzen und kopieren

Status: Geltender Fachvertrag; offene Erweiterungen sind als Ziele beschrieben.
Owner: campaign
Last Reviewed: 2026-10-24 (Struktur und Quellen; Fachabnahme separat)
Source of Truth: Dieses Dokument besitzt das benannte Thema; Code belegt den Iststand, das Abnahmeregister den Prüfstand.

Stand: 15.10.2026. Umfang: [SCOPE](../../project/requirements/scope.md), [#69](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/69)
und [Quellenregister](../../project/requirements/sources.json). Manuelle Planung benötigt weder
Planungsparty noch Generator; Generierung und Übernahme ins Live-Spiel sind
zusätzliche Abläufe.

Bindende Generierungsvorgaben: [Iststand, Quellenprüfung und nächste Schritte](generation-constraints.md).

## Vorschauen wieder aufnehmen und ihre Berechnung lesen

Gleiche gespeicherte Planungsrevision, gleicher Seed, dieselben Inhaltsvorgaben
und unveränderte Welt-, Katalog-, Preset-, Tabellen- und Beutegrundlagen öffnen
jetzt dieselbe Vorschau. Wiederholung erzeugt keine zusätzlichen Encounterläufe.
Eigene Szenentexte, Belohnungsänderungen und Übernahmestände bleiben erhalten.
Die Auswahl von Encounter-Tabellen wird als ungeordnete Menge verglichen:
Umgeordnete Tabellenkennungen öffnen dieselbe gespeicherte Berechnung. Nur die
Vergleichskopien werden sortiert, einschließlich älterer Origin-V1-Daten;
gespeicherte Originalbytes und der Aufruferrequest bleiben unverändert.
Doppelte Tabellenkennungen bleiben ungültig. Orts-, Notiz- und verbindliche
NPC-Reihenfolgen werden nicht sortiert, da sie Szenenbindungen beeinflussen.
Storegegenproben prüfen bearbeitete Vorschau, keine zusätzlichen Datenbytes,
Fresh und weiterhin verschiedene Läufe bei vertauschten Ortsbesuchen.
„Neuer Seed für weiteren Entwurf“ macht eine zusätzliche Berechnung ausdrücklich.
Geänderte Quellrevisionen oder relevante Ledger-/XP-Grundlagen erzeugen einen
neuen Lauf; vorherige Ergebnisse bleiben lesbar. Einzelne Neugenerierungen
bleiben eigene gespeicherte Varianten und ersetzen die gemeinsame Herkunft nicht.

„Gespeicherte Berechnungsgrundlage“ zeigt pro Szene die ursprünglichen Seeds,
Presetnamen/-revisionen und Regel-/Kataloghashes sowie ursprüngliche strukturierte
Belohnungen neben dem Hinweis auf spätere Bearbeitung. Neustart und unabhängige
Kampagnenkopie erhalten diese Herkunft mit korrekt umgebundenen Referenzen.
Ältere Vorschauen besitzen keinen nachträglich erfundenen Herkunftsbeleg.
Dies liefert Wiederaufnahme und Nachvollziehbarkeit; der vollständige originale
Reward-Engineumfang einschließlich aller Packing-/Channel-/Curse-Regeln und
asynchroner Orchestrierung bleibt ein eigener offener Produktumfang.

## Gezielte Planbestätigung und Wiederaufnahme

`changePreparationPlan` bestätigt nur den betroffenen `ManualPlan`;
`reconcilePreparationPlan` liest dessen Beleg, aktuelle Revision und Besuchszeilen
in einer Transaktion. Nicht angewandt, Konflikt und unlesbares Ziel bleiben
unterschieden. Die initiale Verzeichnisabfrage bleibt ein eigener Einstieg.
Interne Sessionänderungen benutzen den transaktionalen Writer ohne anschließenden
ungenutzten Verzeichnisread. ID-Indizes ersetzen wiederholte lineare Besuchssuchen.

Der Renderer übernimmt den bestätigten Plan und aktualisiert seine Listen,
erhält aber spätere editierbare Werte über den gemeinsamen Editorübergang.
Notizen, Ortssuche und fremde Entwürfe werden durch Planantworten nicht ersetzt.
`tests/campaign/desktop-plan-projection.test.mjs` verbietet globale Reads bei wachsendem
Hintergrundbestand und prüft Replay, Fresh, Konflikte und Rollback;
`tests/campaign/desktop-timeline-search.test.mjs` prüft auch spätere Eingabe während Recovery.
`tools/test-desktop-manual-timeline.mjs` führt ohne Party drei Besuche, wiederholten
Ort, Umordnung, späte Eingabe, Antwortverlust, Neustart und unabhängige Liveübernahme
aus. Dies ist keine vollständige manuelle Sessionplanner-Abnahme.

## Aktueller Anschluss

Die Desktopvorbereitung speichert Pläne, geordnete Besuche, exakte Notizen und
optionale Ortsverweise im gemeinsamen SQLite-Store. `session-ui.ts`,
`storage/session.ts` und `storage/plan-replacement.ts` ergänzen Besuchsinhalte,
Gruppen, Belohnungen sowie Ersetzung und Wiederverwendung. Die reinen
`ManualPlan`-Codecs prüfen den gemeinsamen Planvertrag.

Im Kopf des Notizeditors öffnet **Für Spielabend verwenden…** die Quellenwahl
und das Ziel vor den Originaltexten. Die Übersicht und ihre geladenen Quellen
lassen sich dort einzeln auswählen. Ein vorhandener aktueller Abend/Besuch ist
vorausgewählt; neue Ziele erhalten eigene Namen. Auswahlfelder ohne vorhandene
Alternativen entfallen. Die Quellenwahl bleibt auch bei vielen geladenen Notizen
auf einen Teil der Fensterhöhe begrenzt und scrollt beim Tastaturfokus mit.
Spielabend, Besuch und Bestätigung folgen direkt auf diesen Bereich.
**Notizmappe öffnen…** bleibt der Einstieg zum Lesen
und Bearbeiten der Quellen. Beide Wege verwenden dieselben Originalnotizen und
die bestehenden geprüften Besuchsverknüpfungen.

Geschlossene Spuren lassen sich nach Abschalten von „Geschlossene Spuren
ausblenden“ im Originaleditor wieder öffnen und ergänzen. Die Notizmappe hält
eine revisionsgebundene Auswahl; Checkboxen, Anzahl und Besuchsauftrag werden
daraus abgeleitet. Geänderte ungeprüfte Quellen sind nicht vorausgewählt.
„Quellenauswahl leeren“ setzt diese Auswahl gemeinsam zurück, ohne die getrennte
Wahl der Übersicht, das Besuchsziel oder vorhandene Besuchsverknüpfungen zu
ändern. Anschließend geladene oder neu hinzukommende Quellen bleiben abgewählt;
einzeln ausdrücklich gewählte Quellen behalten ihre Revisionsbindung. Der
Rückweg aus einer untergeordneten Mappe bewahrt diese Entscheidung. Ein neues
Öffnen der Mappe beginnt wieder mit der üblichen Vorauswahl; es gibt keinen
zusätzlichen gespeicherten Auswahlstand.
Im eingeblendeten Quelleneditor führt „Mit dieser Mappe zum Spielabend…“ über
den vorhandenen Flush zur bereits geprüften Dossierauswahl und ihrem Ziel.
Die eigene Mappe einer Quelle bleibt separat über „Notizmappe öffnen…“ erreichbar.
Aktualisieren, Filterwechsel und Rückwege aus Quelleneditor oder untergeordneter
Mappe verwenden denselben Leseablauf für die zuvor gelesenen Originalkennungen.
`noteThreadMembers` liefert dafür dieselbe geordnete Mitgliedschaft wie der
Speicherleser und die Übergabeprüfung. Neue Verknüpfungen vor einer gewählten
Quelle können sie nicht durch eine gleich große andere Seite ersetzen. Gelesen
wird bis zur letzten weiterhin verknüpften bekannten Kennung; der Cursor zählt
auch ausgefilterte geschlossene Quellen. Entfernte Quellen erzwingen daher
keinen vollständigen Durchlauf durch ungeprüfte weitere Seiten.
Die Vorauswahl gilt nur beim ersten Öffnen. Beim Wiederlesen bleiben neue
Quellen abgewählt; bestehende Auswahl und Ziel bleiben erhalten. Neue ungeprüfte
Quellrevisionen bleiben abgewählt. Eine noch ausstehende oder fehlgeschlagene
Seite gibt keine Übergabe frei. Nach einem Lesefehler stellt Aktualisieren erneut
die zuvor gelesenen Kennungen her; einzelnes Nachladen umgeht diese Prüfung nicht.
Ein Kontextwechsel entwertet alte Antworten.
[Native Wiederaufnahme und Obsidian-Gegenprobe](https://github.com/ThonkTank/Salt-Marcher/blob/16eb0aa8807ac21704abfea5412ac3a22033a23a/docs/reference/gm-ux-qa/note-followup-20261016/README.md#abgeschlossene-spur-wieder-aufnehmen-und-denselben-abend-weiterverwenden).
Der native Ablauf `tools/test-desktop-note-reopen.mjs` prüft Spur und NSC-Notiz,
denselben vorhandenen Spielabend und weitere Bearbeitung nach regulärem
Close/Fresh bei echtem Fensterzoom von 100 und 200 %. Explizites Aktualisieren
erhält die ausgewählte Quelle auch nach dem Einfügen von 40 weiteren
Verknüpfungen vor ihr und der Verschiebung auf Seite drei. Er prüft außerdem
die begrenzte Quellenwahl
mit 42 Quellen, jeden Tab-Schritt bis zur letzten Quelle und den anschließenden
Fokus auf dem Spielabendziel. Das ist keine vollständige SMR-AC-03-Abnahme.

Gespeicherte Begegnungen werden erst ab zwei Suchzeichen über den vorhandenen
Katalogzugang gelesen. SQL begrenzt auf neun Metadatensätze: acht auswählbare
Treffer plus Überlaufhinweis. Neue Eingaben, Besuchs-/Planwechsel und neuere
Antworten entziehen alten Treffern die Freigabe. Dieselbe Besuchsauswahl behält
beim Speichern den Suchtext und liest passende Treffer erneut. Angehängte Gruppen
behalten ihren eigenen konkreten Begegnungsstand. Session-Lesungen und neue
Schreibbelege enthalten keine globale Begegnungsliste mehr; historische Belege
bleiben unverändert lesbar und wiederholbar.

Der Live-Besuchsbinder zeigt übernommene Besuche seitenweise mit festgehaltenen
Texten, Ergebnissen und Weltverweisen. Planänderungen ersetzen diese Übernahmen
nicht; ältere Übernahmen ohne vollständige Bindung werden als solche markiert.
Seitenwechsel und Suche entfernen alte Aktionen sofort; Antworten und Übergaben
bleiben an die ursprüngliche Campaign, Gruppe und Besuchsauswahl gebunden.
Datenbank-Reopen und unabhängige Kopie sind geprüft; die native Bedienprobe
bleibt offen.

Eine bestätigte Spielabendübergabe kann einen neuen Einstieg atomar in Plan und
Mappe speichern. Wahlweise bleibt der neue Besuch im Editor geöffnet oder seine
GM-Mappe öffnet sich sofort auf genau diesem Besuch. Eine während der Antwort
veränderte Auswahl öffnet keine Mappe aus einem älteren Auftrag.

## Daten- und Bedienvertrag

- Pläne behalten ihre Identität und monotone Revision. Neue oder kopierte
  Besuche bekommen eigene kampagnenlokale IDs; gleiche Orte verbinden keine
  Besuchsidentitäten. Unbenannte Pläne und ortlose Besuche sind gültig.
- Eingaben bleiben an Campaign, Plan, Besuch und ursprüngliche Revision
  gebunden. Aktualisieren übernimmt keine offene Eingabe. Veraltete Antworten
  dürfen fremde Texte, Auswahl oder einen neueren Stand nicht verändern.
- Ein leerer XP-Pool einer manuellen Belohnung bleibt eine offene Eingabe.
  Speichern und Verlassen warten auf eine Zahl oder das Entfernen der Belohnung;
  ausdrücklich eingegebene `0` ist gültig und wird nicht aus Leere abgeleitet.
- Beutezeilen behalten ihre Eingabeknoten beim Ergänzen, Entfernen und nach
  bestätigtem Speichern. Unfertige Mengen bleiben offen; nur positive ganze
  Mengen geben den Schreibauftrag frei. Zeilenbefehle greifen auf den aktuellen
  Besuch zu; entfernte Controls ändern keine neue Belohnung. Erneutes Anlegen
  nach Entfernen zeigt leere Beute und den neuen XP-Wert.
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
Plantexte, Besuchsinhalte und Freigabebasis kommen aus derselben geprüften
Session-Lesung. Der Dialog hält keine zweite Plankopie; Ersetzen und Mappe
verwenden denselben gelesenen Plan statt ihn nochmals zu laden. Der Plananteil
ist eine Lesesicht und wird nicht zusätzlich in historischen Receipts gespeichert.
[Dialogprüfung](../../../tests/campaign/desktop-session-copy-context.test.mjs) und
[Speicherprüfung](../../../tests/campaign/desktop-session-copy-integrity.test.mjs) prüfen
Reopen, Auswahl, Antwortreihenfolge, Quellschutz, Append, unabhängige offene
Rewards, Replay und atomaren Rollback.

Spielabend-Eingaben, Ersetzen und Szenenkopien verwenden die vorhandene
Belegprüfung: Vor Send wird die Referenz mit Originalkennung und Fingerprint
dauerhaft gesichert. Eine fehlende Antwort wird lesend geklärt; bei ungeklärtem
Status bleiben weitere Buchungen gesperrt. Dialogwechsel entfernt den Beleg
nicht. Bestätigte Antworten aktualisieren nur ihren ursprünglichen Editor;
spätere Texte und neue Kopierauswahlen bleiben offen. Auch nach Dialogreset
aktualisiert die Statusklärung die Timeline; alte Refreshantworten gehören weiter
zu ihrer ursprünglichen Aktivierung. Eine inzwischen geänderte Kopierauswahl
liest Quelle und Ziel erneut, behält Reihenfolge, Namen, Partywahl und Filter
und wartet auf eine neue ausdrückliche Bestätigung. Fehlende gewählte Besuche
bleiben zum bewussten Entfernen sichtbar; sie werden nicht still übersprungen.
Jeder neue Anlageauftrag bekommt eine neue Plan-ID. Der frühere lokale
Kopier-Retry und seine vorab reservierte Plan-ID entfallen.
[Speicher- und Bedienprüfungen](../../../tests/campaign/desktop-preparation-context.test.mjs)
belegen verlorene Antworten, reine Statusabfrage, spätere Texte und genau einen
Append nach Dialogreset. Ein frischer Store liest denselben Beleg; native
Prozessende-/Neustartprüfung einschließlich wiedergefundener Referenz bleibt offen.
Die Quellenliste liest weiterhin die vollständige Preparation; 40 sichtbare
Karten begrenzen den Quellaufwand nicht. Gebuchte Beute, mehrfach referenzierte
Worldgruppen, Trash/Restore sowie native Fokus-, Tastatur- und Lastgrenzen
benötigen ihre betroffenen Abnahmen.

## Geprüft und noch offen

[Ersetzung und Kopie](../../../tests/campaign/desktop-plan-replacement-copy.test.mjs)
prüfen den echten Writer, Export/Import, Fresh, Historienverweise und exakte
Texte. [Worldgruppen und Rewards](../../../tests/campaign/desktop-plan-replacement-world.test.mjs)
prüfen erhaltene NPC-/Treasure-Identitäten, Vergabestatus, Retry und Rollback.
[Bereinigung](../../../tests/catalog/desktop-session-retention.test.mjs) erhält Rohentwürfe
und prüft Ersetzung aus demselben Plan. Das sind Storeprüfungen, keine native
Bedien-, Crash- oder Undoabnahme.
[Vorschlagsprüfungen](../../../tests/campaign/desktop-session-proposal-store.test.mjs) kontrollieren gemeinsam gelesene und gesicherte Vorschläge, Budget- und Quellenbezüge, unabhängige Generierungskennungen, historischen Beuteausgleich sowie unveränderte Sicherungen bei beschädigten Daten. Ältere Partyprofile und archivierte Wissensverweise bleiben gültige Vorschauhistorie.

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

Für [Kampfentwürfe](../../runtime/contract/combat-recovery.md) und
[narrative Belohnungen](../../runtime/contract/narrative-recovery.md) gelten die jeweiligen
Daten- und Recoveryregeln.
Eine zweite Timelinearchitektur oder generische Historyabstraktion ist nicht nötig.

## Besuchsübergabe und Recovery

`prepareNextVisit` prüft Zielplan, Einfügeposition, angezeigte Revision,
Workspace/Aktivierung und neuere Eingaben einschließlich Mappen-Vorlesetext
und Planungsangaben. Im vorgeschlagenen Plan steht der
Einstieg vor dem nächsten Besuch, in einem anderen gewählten Plan am Ende.
Ein nicht gelisteter bisheriger Zielplan bleibt ausdrücklich ausgewählt und
wird beim Speichern geprüft; nur die eigene Neuanlageoption erzeugt einen Plan.
Keine gültige Select-Auswahl bedeutet keinen Schreibauftrag. Originaltexte
bleiben vollständig; die Ableitung des kurzen Titels verändert ihre Bytes nicht.

Der optionale `opening`-Teil speichert Planfolge, Vorlesetext und Wissensquellen
in einer Vorbereitungstransaktion. Ungültige Quellen oder Receiptfehler lassen
keinen halbfertigen Besuch zurück. Bei ungeklärter Übergabe an einen vorhandenen
Plan hält `retainOpenDrafts` den Originalauftrag unter dessen Ziel-ID fest;
der sichtbare Editor ist kein Ersatzowner. Spätere Zieltexte bleiben erhalten.
Nach neuer Storeinstanz klärt derselbe Beleg angewandt/nicht angewandt ohne
automatische Wiederholung. Der vorhandene Draftvertrag bleibt unverändert.

[Übergabeprüfungen](../../../tests/campaign/desktop-visit-handoff.test.mjs) und
[Dialogprüfungen](../../../tests/runtime/desktop-session-resume-context.test.mjs)
prüfen Zielbindung, spätere Eingaben und Originalauftrag. Native Gesamtfreigabe
und vollständige Wiederaufnahme nach Prozessende bleiben offen.

Nächster Recoveryabschluss: Anlageabsicht für einen neuen Plan
(`expectedRevision=null`) vor Send dauerhaft sichern, nach Crash finden und
mit demselben Receipt klären. Der bisherige Draftcodec setzt einen vorhandenen
Owner voraus; eine ungeklärte Anlage blockiert normales Verlassen.
`preparation-contracts.ts`, `preparation.ts`, Draftwriter/Backupprüfung in
`storage/store.ts` und Kopie in `storage/campaign-data.ts` gemeinsam prüfen:
Prozessende vor Send/nach Commit vor Reply, beschädigte Sicherung, späterer
Zielplan und unabhängige Kopie ohne automatische Ausführung oder Doppelanlage.
Bestehende Formate und historische Originaltexte erhalten.

## Zusammenhängender Vorbereitungsbereich

„Weltwissen und Orte“ und „Spielabend planen“ benutzen dieselben bestehenden
Editoren in voller Breite. Referenznavigation öffnet den passenden Bereich;
Umschalten sichert gültige Eingaben, ohne Autorenkopien zu erzeugen.
Die Generierung stellt Gruppe, Umfang, Szenenzahl und Auftrag vor optionale
Beute-/Weltvorgaben. Ledger-Ausgleich ist explizit; freie Planungszeilen brauchen
ihn nicht. Profilspeicherung erhält Eingabeknoten und neuere Werte, ungeklärte
Schreibantworten behalten dagegen ihre bisherige Sperre.


Weitere Fachabschnitte: [Teil 2](manual-session-planner-2.md)
