# GM-Referenzsuche und Regeln am Spieltisch

Status: Geltender Fachvertrag; offene Erweiterungen sind als Ziele beschrieben.
Owner: runtime
Last Reviewed: 2026-10-24 (Struktur und Quellen; Fachabnahme separat)
Source of Truth: Dieses Dokument besitzt das benannte Thema; Code belegt den Iststand, das Abnahmeregister den Prüfstand.

Stand: 20.10.2026. Ergänzt [Katalog und Regeln](../../catalog/requirements/catalog-encounters.md),
[Live-Scenes](smr03-live-scene-contract.md), [Katalogsuche und Filterlieferung](catalog-browsing.md)
und [Gesamtumfang](../../project/requirements/scope.md).

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
- **Regel im Gruppenkontext verwenden:** Unter „Regeln und Proben am Tisch“
  öffnet „Regel nachschlagen…“ die begrenzte Regelsuche in einer Leseansicht.
  Nach ausdrücklich bestätigtem Anheften kehrt der Fokus zur neuen Gruppenregel
  zurück. „Probe vorbereiten“ wählt deren Regelbezug und führt zur Bezeichnung;
  vorhandene Eingaben bleiben erhalten. Erst „Würfeln und protokollieren“ würfelt.
  Das letzte Ergebnis nennt seine gespeicherte Regelbasis und Revision auch nach
  Gruppenwechsel und Neustart. Die Suchtreffer verdrängen keine Gruppenpins oder
  Probenfelder mehr.
- **Regelstand festhalten:** Der kampagnengebundene `rule`-Notiztyp lässt sich
  zusätzlich als eingefrorene Regelreferenz an eine Scene heften (maximal 50).
  Quellenrevision, Titel, Vorlesetext und GM-Notizen bleiben erhalten. Änderungen
  und nicht verfügbare Quellen werden angezeigt; Aktualisieren/Lösen ist ausdrücklich.
  Diese Regelstände unterscheiden sich von den allgemeinen Szenentisch-Verweisen.
- **Proben protokollieren:** d20-Proben mit Normal/Vorteil/Nachteil, Modifikator,
  optionalem SG und Regelbezug besitzen einen gruppengebundenen Verlauf. Receipts
  bewahren das bestätigte Ergebnis einschließlich der damaligen Würfel/Regelbasis.

Regelbezogene Würfe binden die angezeigte eingefrorene Quellenrevision des Pins.
Hat ein anderer Aufruf diesen Pin inzwischen aktualisiert, weist Main die Probe
vor dem Würfeln und ohne Verlauf-/Receiptänderung ab. Bezeichnung, Wurfart,
Modifikator und SG bleiben zur erneuten Prüfung erhalten; erst nach ausdrücklich
aktualisierter Ansicht kann der GM den neuen Stand verwenden. Eine geänderte
Definition allein entwertet den noch unveränderten eingefrorenen Pin nicht.
Auch „Aus Quelle aktualisieren“ bindet die zuletzt gelesene aktuelle
Quellenrevision. Freie und Statblockwürfe benötigen weiterhin keine Regelbasis.
Bereits bestätigte alte Commands ohne diese zusätzliche Bindung werden über
ihren vorhandenen Receipt wiederholt; neue regelbezogene Commands benötigen
sie. Proben-, Receipt- und Archivformate bleiben ohne Migration erhalten.
Store-/Controllergegenproben sowie der native Lauf prüfen parallele
Pinaktualisierung, Ablehnung, erneute Prüfung und Neustart mit beiden historischen
Regelrevisionen. Installationsweite Definitionen bleiben eine getrennte Lieferung.

## Nachgewiesenes Verhalten und Grenzen

[Schnellsuche (historisch)](https://github.com/ThonkTank/Salt-Marcher/blob/05e8f2f97fc729dba8b6fef3830c566cdc47adad/tests/catalog/desktop-quick-reference.test.mjs) prüft mit echtem
Store und DOM entfernte Treffer, überholte Enter-Anfragen, Quellenänderungen beim
Speichern, unveränderte Textübergaben und Pins ohne Zeit-/Fortschrittswirkung.
[Regel-UI (historisch)](https://github.com/ThonkTank/Salt-Marcher/blob/05e8f2f97fc729dba8b6fef3830c566cdc47adad/tests/catalog/desktop-rule-reference-authority.test.mjs) und
[Regelspeicher](../../../tests/catalog/desktop-rule-reference-store.test.mjs) prüfen
Campaign-/Scenewechsel, Revisionsschutz, erste State-Anlage, Proben, Replay, Fresh
und unabhängige Kopien. Reads und readonly Snapshotprüfung schreiben keinen State.
Ungültige Aktionen/Revisionen werden abgewiesen; vorhandene Prosa bleibt erhalten.

Das belegt lokale Controller-/Storepfade. Der unten beschriebene native Ablauf
ergänzt reguläres Schließen, Neustart und 100 Prozent für die konkret geprüfte
Gruppenaufgabe. Native Replyverlust- und vollständige Tastaturabnahme bleiben
offen. Installationsweite Regeldefinitionen, deren Konfliktimport und die
Trennung aktueller Definitionen von historischen Fakten sind noch nicht
vollständig umgesetzt.


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
noch die andere Gruppe ersetzen. „Aktualisieren“ fragt beide erneut ab.

Der Speicher liest angeheftete Regeln samt heutigen Quellen mit einem gemeinsamen
`LEFT JOIN`, statt je Pin erneut zu lesen. Campaign und Notiz-ID binden die
Quelle; die gespeicherte Pinreihenfolge bleibt erhalten. Fehlende oder archivierte
Quellen, ungültige Quellprüfsummen und andere Notizarten lassen den eingefrorenen
Text lesbar.
Quellenprüfung und Probenhistorie bleiben getrennt. Es gibt
keine Schemaänderung oder Migration. Die Authoritygegenproben halten beide
Reader einzeln zurück, liefern Fehler und fremde Sceneantworten und prüfen
anschließende Commands/Revisionsbasen. Das ist DOM-/Controllernachweis, keine
native Fehler-/Fokus-/Recoveryqualifikation.

Auch syntaktisch oder fachlich beschädigte aktuelle Quellen bleiben von den
gültigen eingefrorenen Pins getrennt. Identität und Revision müssen zur
Quellzeile passen, bevor eine Quelle als aktuell gilt oder angeheftet bzw.
aktualisiert werden darf. Eine ungültige Quelle erscheint beim betroffenen
Pin als nicht verfügbar; dessen Text, andere Pins und regelbezogene Proben
bleiben nutzbar. Beschädigte Pins selbst werden weiterhin abgewiesen.
`desktop-rule-reference-store.test.mjs` prüft diese Grenze und unveränderte
Quellbytes; die native Regelprüfung verfolgt sie über Gruppenwechsel und
Neustart bei 100 Prozent Zoom. Das ist keine Reparatur oder Exportfreigabe der
beschädigten Quelle.

Die Enter-Gegenfälle in `desktop-quick-reference.test.mjs` halten einen
Nebenindex offen, prüfen frühe Detailöffnung und genau einen Request je Quelle,
binden schon sichtbare Teiltreffer ein und verwerfen verspätete Öffnungsabsichten
nach Navigation/Close. Reads verändern weder Autorenprosa noch Kampagnenfakten.
Eine neue Query invalidiert den alten Auftrag; bloß erneut Enter zu drücken
startet keinen identischen Nebenindex ein zweites Mal. Die Gesamtstatuszeile
wartet weiterhin auf die angefragten Quellen, während gesunde Referenzen bereits
nutzbar sind. Das ist keine automatische Auflösung mehrdeutiger Begriffe und
keine vollständige Reference-Graph-Lieferung.

Der native Aufruf `npm run test:desktop-rule-context-ui` verwendet
`tools/test-desktop-rule-reading.mjs`: vollständiges Lesen, Gruppenregeln,
regelbezogene Proben und Wiederöffnen beider Gruppen bei 100 Prozent.
Eine zurückgehaltene A-Antwort wird erst nach dem Wechsel nach B freigegeben;
B muss anschließend mit eigener Regelrevision speichern können. Der frühere
separate Kontextlauf verwendete die versteckte Kampagnenauswahl und scheiterte
vor diesem Gegenfall. Gemeinsame Fixtures, Start und Neustart werden nur noch
an einem Ort gepflegt. Ergebnisbelege binden Gitstand, Dirty-Status und Buildhashes.

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
   Index-/Detailfehlern, Netzsperre, Tastatur und 100 % prüfen. Lange Texte und
   große Indexmengen messen, bevor zusätzliche Suchstrukturen eingeführt werden.

## Weitere ausführbare Schritte

1. **Speicherbestätigung schließen.** `executeSceneRule` an den gemeinsamen
   `CommitReference`-/Status-/`writeConfirmed`-Weg anschließen und Pendingcommands
   in `flushLive` berücksichtigen. Abnahme: Pin/Refresh/Unpin vor/nach Commit
   unterbrechen, Scenewechsel, Close/Fresh; Replyverlust lesend am gleichen Command
   aufklären, keine neue Command-ID als automatischer Retry.
2. **Regelsuche weiter abnehmen.** Das Regelpanel verwendet jetzt den vorhandenen
   begrenzten Notizsuchweg, filtert Regeln vor der Seitengrenze und bietet weitere
   Treffer an. „Regel lesen“ zeigt das Original vor dem Anheften; die Übernahme
   prüft atomar die angezeigte Quellenrevision. [Vollständiger nativer Ablauf und
   Obsidian-Gegenprobe](https://github.com/ThonkTank/Salt-Marcher/blob/16eb0aa8807ac21704abfea5412ac3a22033a23a/docs/reference/gm-ux-qa/2026-10-14-rule-context.md#hausregel-vor-dem-festhalten-lesen)
   prüfen Suche, Lesen, Probe, Gruppenwechsel und Fresh bei 100 Prozent Zoom.
   Beschädigte Quellen, sehr große Regelbestände und vollständige
   Campaignwechselabnahme bleiben von diesen Belegen getrennt.
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
mit Vorlagentitel und Revision. Ein noch offener Entwurf ist ausdrücklich als
unbestätigter Entwurfsstand beschriftet. Er benötigt keinen heutigen Katalogzugriff.
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

Der aktuelle SRD-Katalog ergänzt die zwölf im gebundenen Import fehlenden
Reaktionen aus derselben Upstream-Version als „Reaktion: …“ in den vorhandenen
Eigenschaften. Diese Texte sind lesbare Regelreferenzen ohne automatische
Reaktionsauflösung. Gespeicherte Vorlagen-/Kampfquellen bleiben unverändert;
„Aktuellen Katalogstand ansehen“ zeigt die ergänzte Definition.
