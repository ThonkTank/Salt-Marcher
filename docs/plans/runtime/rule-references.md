# GM-Referenzsuche und Regeln am Spieltisch

Stand: 15.10.2026. Ergänzt [Katalog und Regeln](../../../ROADMAP-SALTMARCHER-CATALOG-ENCOUNTER-PLAN.md),
[Live-Scenes](smr03-live-scene-contract.md), [Katalogsuche und Filterlieferung](catalog-browsing.md)
und [Gesamtumfang](../../SCOPE.md).

## Ziel und vorhandene Nutzerwege

Die gepinnten Program Capabilities, Revision
`9de85c1a26f526acbc1af332ac5962e185c0aab2`, L57–70 und L659–668, verlangen
wiederverwendbare installationsweite Regeldefinitionen, aktuelle Referenzen für
laufendes/künftiges Spiel und erhaltene historische Fakten. Quellenhash im Register:
`714051ef2b72a5aa0a791c0b3bf8c6fffaa7e381f3b72d86222190089a1cfd2e`.

- **Nachschlagen:** Die GM-Schnellsuche (`Strg+K`) sucht Weltinhalte einschließlich
  Regelnotizen, Kreaturen, Gegenstände und Begegnungen. Begrenzte Trefferseiten,
  Detailansicht, verknüpfte Inhalte, Zurück/Vorwärts und Aktualisieren sind vorhanden.
- **Verwenden:** Inhalte lassen sich am Szenentisch anheften, Texte zum Bearbeiten
  öffnen, Vorlesetext übernehmen oder Kreaturen/Begegnungen am Spieltisch vorbereiten.
  Lesen und Anheften verändern keine Zeit oder Belohnungen. Übergaben prüfen den
  angesehenen Quellenstand erneut nach dem Speichern offener Eingaben.
- **Regelstand festhalten:** Der kampagnengebundene `rule`-Notiztyp lässt sich
  zusätzlich als eingefrorene Regelreferenz an eine Scene heften (maximal 50).
  Quellenrevision, Titel, Vorlesetext und GM-Notizen bleiben erhalten. Änderungen
  und nicht verfügbare Quellen werden angezeigt; Aktualisieren/Lösen ist ausdrücklich.
  Diese Regelstände unterscheiden sich von den allgemeinen Szenentisch-Verweisen.
- **Proben protokollieren:** d20-Proben mit Normal/Vorteil/Nachteil, Modifikator,
  optionalem SG und Regelbezug besitzen einen gruppengebundenen Verlauf. Receipts
  bewahren das bestätigte Ergebnis einschließlich der damaligen Würfel/Regelbasis.

## Nachgewiesenes Verhalten und Grenzen

[Schnellsuche](../../../tests/desktop-quick-reference.test.mjs) prüft mit echtem
Store und DOM entfernte Treffer, überholte Enter-Anfragen, Quellenänderungen beim
Speichern, unveränderte Textübergaben und Pins ohne Zeit-/Fortschrittswirkung.
[Regel-UI](../../../tests/desktop-rule-reference-authority.test.mjs) und
[Regelspeicher](../../../tests/desktop-rule-reference-store.test.mjs) prüfen
Campaign-/Scenewechsel, Revisionsschutz, erste State-Anlage, Proben, Replay, Fresh
und unabhängige Kopien. Reads und readonly Snapshotprüfung schreiben keinen State.
Ungültige Aktionen/Revisionen werden abgewiesen; vorhandene Prosa bleibt erhalten.

Das belegt lokale Controller-/Storepfade. Native Close-/Replyverlust-, Restart-,
Tastatur- und Skalierungsabnahme bleiben offen. Installationsweite Regeldefinitionen,
deren Konfliktimport und die Trennung aktueller Definitionen von historischen
Fakten sind noch nicht vollständig umgesetzt.


## Fehlerisolation der vorhandenen Sessionleser

Die Schnellsuche liest ihre fünf begrenzten Quellen unabhängig. Ein ausstehender
Kreaturindex hält verknüpfte Begriffe und deren Detailansicht nicht zurück; Fehler
bleiben bei ihrer Quelle sichtbar. Ein Enter-Intent bindet den laufenden Suchrequest und den bisherigen
Detailkontext. Er öffnet genau den ersten schon verfügbaren oder neu eintreffenden
Treffer, ohne auf andere Quellen zu warten oder dieselbe Suche erneut zu starten.
Eine neue Query, Aktivierung, Schließen oder ausdrückliche Detailnavigation
verwirft den Intent; später eintreffende Quellen ersetzen keine neue Auswahl. DOM-/Storeprüfung und ein nativer Lauf mit verzögerter,
dann fehlerhafter Kreaturantwort bestätigen dies einschließlich Tastaturöffnung
und unveränderter Autorenprosa nach erneutem Öffnen.

`rule-reference-ui.refreshRuleReferences` liest Regelpins und Proben unabhängig.
Ein langsamer Reader verzögert die gesunde Ansicht nicht. Fehler erscheinen beim
betroffenen Inhalt; dessen Schreibbasis wird verworfen, die andere bleibt nutzbar.
Ohne Regelansicht zeigt der Regelwähler ausschließlich „Freie Probe“; ein
Scenewechsel entfernt auch die vorige Auswahl, bevor der Probenreader antwortet.
Eine beschädigte Probenhistorie sperrt Würfe, nicht Lesen/Aktualisieren/Lösen von
Regelreferenzen. Der gesunde Probenreader erlaubt freie und Statblockwürfe auch
bei nicht verfügbarem Regelreader; deren Storewriter benötigen keine aktuelle
Regelliste. Regelgebundene Würfe verwenden weiterhin die geprüfte eingefrorene
Pinbasis. Kein stilles Reparieren beschädigter Daten und keine automatische
Wiederholung von Schreibaufträgen.

Regel- und Probencommands invalidieren jeweils nur ihre eigenen ausstehenden
Reads. Token, Campaign, Scene und Aktivierungsgeneration begrenzen beide Reader;
eine alte Antwort oder ein alter Fehler darf weder einen neu bestätigten Stand
noch die andere Gruppe ersetzen. „Aktualisieren“ fragt beide erneut ab. Es gibt
keine Schemaänderung oder Migration. Die Authoritygegenproben halten beide
Reader einzeln zurück, liefern Fehler und fremde Sceneantworten und prüfen
anschließende Commands/Revisionsbasen. Das ist DOM-/Controllernachweis, keine
native Fehler-/Fokus-/Recoveryqualifikation.

Die Enter-Gegenfälle in `desktop-quick-reference.test.mjs` halten einen
Nebenindex offen, prüfen frühe Detailöffnung und genau einen Request je Quelle,
binden schon sichtbare Teiltreffer ein und verwerfen verspätete Öffnungsabsichten
nach Navigation/Close. Reads verändern weder Autorenprosa noch Kampagnenfakten.
Eine neue Query invalidiert den alten Auftrag; bloß erneut Enter zu drücken
startet keinen identischen Nebenindex ein zweites Mal. Die Gesamtstatuszeile
wartet weiterhin auf die angefragten Quellen, während gesunde Referenzen bereits
nutzbar sind. Das ist keine automatische Auflösung mehrdeutiger Begriffe und
keine vollständige Reference-Graph-Lieferung.

## Automatische Begriffsreferenzen: nächste zusammenhängende Lieferung

Die [Originalanforderung Reference Graph](https://github.com/ThonkTank/Salt-Marcher/blob/9de85c1a26f526acbc1af332ac5962e185c0aab2/docs/reference/requirements/requirements-reference-graph.md)
verlangt mehr als Suche und explizite Autorenverweise. Automatische Erkennung,
mehrdeutige Kandidaten, verschachtelte Vorschauen und über Scenewechsel erhaltene
angeheftete Lesekarten sind derzeit offen. Die konkreten alten Tab-/Renderernamen
sind Umsetzungsmittel; lesbare Session, erhaltene Arbeitskontexte und vollständige
Navigation bleiben Fachziele. Der World-Beziehungsgraph ersetzt diese Fähigkeit
nicht.

1. **Quellen und eindeutige Ziele.** `scene-desk-contracts`, `storage/scene-desk`
   und `storage/text-references` liefern bestehende `DeskRef`-/Detailidentitäten;
   `features/catalog` liefert Kreaturprojektion samt Version/Attribution.
   Zunächst den tatsächlich verfügbaren Regelkorpus/Importweg feststellen:
   Kreaturdaten sind kein vollständiger Regelkorpus. Statische Regeln benötigen
   stabile Quellidentität und Detailblöcke mit Lizenz/Version, bevor ihr Name als
   funktionierendes Ziel veröffentlicht wird. Kampagnenorte/-Fraktionen bleiben
   eigene aktuelle Quellen. Kanonische Namen und ausdrücklich veröffentlichte
   Aliasse transportieren; freie Beziehungslabels oder zufällige Linktexte nicht
   automatisch als globale Aliasse umdeuten. Bestehende Autorenprosa und IDs
   bleiben unverändert. Eine notwendige Aliasdatenmigration erst mit dem
   bestätigten Autoren-/Importweg festlegen.
2. **Erkennung als reine Projektion.** Eine gemeinsame Textprojektion neben
   `text-references.ts` erzeugt stabile nicht überlappende Spannen: Unicode-
   Normalisierung mit Zuordnung auf Originaloffsets, erlaubte Groß-/Kleinschreibung,
   Wortgrenzen und längster gültiger Treffer. Kampagnennamen exakt behandeln;
   identischer Name mit mehreren Zielen bleibt eine Kandidatenmenge. Keine
   Quelltextumschreibung oder Mutation von Eingabefeldern. Abnahme: kombinierte
   Unicodezeichen, Emoji vor einem Treffer, „Opportunity Attack“ vor „Attack“,
   wiederholte Namen, Fraktion/Ort mit gleichem Namen und sehr langer Text.
3. **Lesen im laufenden Kontext.** Gemeinsame Projektion in Sessionprosa,
   `creature-detail-ui.renderCreatureDetail`, Zustandslabels, Gruppennotizen und
   Referenzdetails anschließen. Detailnavigation über vorhandene Deskreader;
   Scenezuordnung des Vor-/Zurückverlaufs explizit machen (Schnellsuche besitzt
   bislang einen Dialogverlauf). Vorschau nach 350 ms Hover/Fokus, 150 ms
   Übergang zum Karteninhalt, verschachtelte Ziele ohne feste Tiefe; nur bereits
   im Vorfahrenpfad vorhandene Ziele als Zyklus sperren. Fünf Sekunden direkte
   Zeigerabsicht oder ausdrückliches Anheften erhalten eine bewegliche Karte im
   Arbeitsspeicher. Scene-/Tabwechsel bewahren sie; Neustart leert sie. Kein
   weiterer dauerhafter Wissensbestand. Fokus, Escape und Verschieben brauchen
   erreichbare Tastaturbedienung und native Nachweise.
4. **Aktualität und Kosten.** Statischen Index und Kampagnenindex getrennt
   versionieren; bestätigtes Erstellen/Umbenennen/Löschen invalidiert nur den
   Kampagnenanteil. Bei jeder Detailnutzung aktuelle Identität/Revision prüfen,
   entfernte Ziele verständlich als nicht verfügbar zeigen. Kein veralteter
   Kampagnencache als aktuelle Wahrheit und keine Netzwerkabfrage. Mit zwei
   Kampagnen, Umbenennen/Löschen bei offener Karte, verspäteten Antworten,
   Index-/Detailfehlern, Netzsperre, Tastatur und 200 % prüfen. Lange Texte und
   große Indexmengen messen, bevor zusätzliche Suchstrukturen eingeführt werden.

## Weitere ausführbare Schritte

1. **Speicherbestätigung schließen.** `executeSceneRule` an den gemeinsamen
   `CommitReference`-/Status-/`writeConfirmed`-Weg anschließen und Pendingcommands
   in `flushLive` berücksichtigen. Abnahme: Pin/Refresh/Unpin vor/nach Commit
   unterbrechen, Scenewechsel, Close/Fresh; Replyverlust lesend am gleichen Command
   aufklären, keine neue Command-ID als automatischer Retry.
2. **Regelsuche vereinfachen.** Das Regelpanel lädt weiterhin die ganze
   `Preparation` und zeigt höchstens 20 Regeln ohne Folgeseite. Den vorhandenen
   begrenzten Suchweg nutzen oder um nötige Regeltexte ergänzen; keine dritte Suche
   bauen. Abnahme: Regeln hinter vielen anderen Notizen, GM-Textsuche, weitere
   Treffer, Quellenänderung und Campaignwechsel.
3. **Aktuelle Definitionen und Geschichte verbinden.** Den vorhandenen
   SharedDefinition-/Importkonfliktweg für installationsweite Regeln verwenden,
   Quellen-/Lizenzprovenienz und kampagneneigene Hausregeln erhalten. Laufende/
   künftige Referenzen lesen aktuelle Definitionen; abgeschlossene Fakten behalten
   ihre Basis. Eingefrorene Pins und freie Prosa migrieren. Abnahme: zwei Kampagnen,
   gleichnamige Definitionen, Änderung, abgeschlossene Scene und Konfliktimport.
4. **Daten- und Bedienabschluss prüfen.** Pins ohne State, Row-/Sourceidentität,
   semantische Receipts, archivierte Quellen und Erasure schließen. GM-Notizen
   bleiben in der GM-Oberfläche; die passive Anzeige verwendet ihre geprüfte
   Projektion. Danach die offenen nativen Nutzerabläufe abnehmen.


## Kreatur-Statblocks und gespeicherte Quellen

Katalog, Kampftisch, Schnellsuche, Weltgraph, Dungeon-/Besuchsmappe und
Generator verwenden denselben Statblockrenderer in `creature-detail-ui.ts`.
Attribute, Modifikatoren, Eigenschaften, Aktionen und Quellen werden damit
über alle Leseorte gleich dargestellt. Die optionalen Kampfaktionen ändern
ausschließlich den Encounter; der Kreaturkatalog bleibt schreibgeschützt.

Ein Gegnerklick in der Encounter-Vorlage zeigt deren eingefrorenen Quellenstand
mit Vorlagentitel und Revision. Er benötigt keinen heutigen Katalogzugriff.
Fehlt dieser gespeicherte Statblock, bleibt die Lücke sichtbar. Die ausdrückliche
Aktion „Aktuellen Katalogstand ansehen“ öffnet die heutige Definition zum Lesen
und für neue Katalogübernahmen; sie ersetzt die Vorlagenquelle nicht. Der
Leseverlauf wechselt zwischen diesen Ständen, ohne die Suche oder den
Vorlagenentwurf zu ändern. Beim Kampagnenwechsel wird der Verlauf geleert.
Eingefrorene Leseansichten erteilen keine Katalog- oder Live-Übernahmeautorität.

Im NSC-Dossier erscheinen Laden und Fehler direkt im aufgeklappten Statblock.
„Statblock erneut laden“ wiederholt nur den Lesezugriff für dieselbe Kennung.
Ein verspätetes Ergebnis darf weder eine andere Kreatur noch einen anderen
Dossierkontext ersetzen. Die lokale und native Prüfung dieses Anschlusses ist
von der vollständigen Fach-/OS-/Owner-Abnahme weiterhin getrennt.
