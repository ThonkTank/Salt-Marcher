# Dungeon-Binder am Spieltisch

Status: Geltender Fachvertrag; offene Erweiterungen sind als Ziele beschrieben.
Owner: dungeon
Last Reviewed: 2026-10-24 (Struktur und Quellen; Fachabnahme separat)
Source of Truth: Dieses Dokument besitzt das benannte Thema; Code belegt den Iststand, das Abnahmeregister den Prüfstand.

Stand: 15.10.2026. Der Binder verbindet bestehende Raum-Keys, Geschosse,
Ausgänge, Fallen und gebundene Encounter-/Gruppen-/Schatzinhalte mit dem
laufenden Spiel. Er nutzt `CampaignStore.dungeon`, `DungeonBinderIndex` und
`DungeonBinder`; Lesen und Blättern bestätigen weder Entdeckung noch Bewegung,
Weltzeit, Kampf oder Loot. Der vollständige [Dungeonumfang](../requirements/smr04-spatial-coverage.md)
bleibt bestehen.

## Aktueller Anschluss und Kontextgrenze

`dungeon-binder-model.ts` baut das GM-Verzeichnis aus geometrischen und
ungebundenen Rooms samt gemeinsamen Keys auf. `dungeon-binder-ui.ts` sucht,
blättert in 40er-Seiten und liest Inhaltsbindungen beim Öffnen ihrer Details.
Karten-/Keynavigation übernimmt die bestehende Renderer-Auswahl; Reiseziele
verwenden den vorhandenen Dungeon-Leitablauf. Die öffentliche Textvorschau
bleibt im GM-Binder; sie veröffentlicht keinen Text für Spieler.

Die Öffnungsabsicht erhält vor dem asynchronen Workspace-Flush ihre
Abbruchgrenze. Reset, Wiederöffnung und ein neuer Read machen ältere Absichten
und Antworten unwirksam. Angezeigte Raum-, Ausgangs- und Kartenaktionen tragen
Campaigntoken und Readfassung; entfernte Controls können keine neue Ansicht
steuern. Listenpaging trägt zusätzlich die dargestellte Listengeneration.
Die laufende Readgeneration ist von der zuletzt bestätigten Lesefassung getrennt.
Während Aktualisierung haben alte Aktionen keine Autorität; Filtern kann ihnen
keine neue Autorität geben. Entfernte
Featuredetails lösen keine Reads früherer Schatz-/Encounterbindungen aus.
Verspätete Antworten ersetzen keinen neueren Inhalt; Fehler bleiben lokal.

`tests/desktop-dungeon-binder-context.test.mjs` verwendet echte SQLite-Räume
und kontrollierte DOM-/IPC-Verzögerungen. Gegenproben betreffen Öffnen vor Flush,
Reset/Wiederöffnung, entfernte Raum-/Kartenbuttons, Aktualisierung und alte
Featuredetails und verspätete Navigationsfehler; aktuelle Navigation bleibt nutzbar. Das sind lokale Teilbelege,
keine vollständige native Binder- oder Dungeonabnahme.

## Levelübergreifende Raumreferenzen

Der GM-Binder verwendet konzeptionelles Level + Anzeigezahl + Raumname für
Liste, Dokumentüberschrift und Weiterlesen-Verweise. Die Level-ID stammt aus
dem kanonischen Room-Key; das physische Geschoss (`floorId`) bleibt ein eigener
Filter und ersetzt dieses Level nicht. Räume ohne Level behalten Zahl und Name.
Die Suche erfasst dieselbe zusammengesetzte Referenz, damit etwa
`Katakomben · 1` den richtigen Raum findet, auch wenn ein anderes Level ebenfalls
Raum 1 besitzt. Eine Levelumbenennung wirkt beim nächsten Read ohne Änderung an
Raum-IDs, Nummern oder Autorenprosa. Diese GM-Bezeichnungen werden nicht als
öffentlicher Raumtext veröffentlicht; Playerlabels und Exportfreigaben behalten
ihren eigenen Sichtbarkeitsvertrag.

Der Anschluss liegt lokal in `DungeonBinderIndex.label`/`matches`; vorhandene
Binderaktionen verwenden weiterhin stabile Raum-IDs. Keine neue Persistenz,
Migration oder zweite Levelwahrheit. Der direkte Nachweis umfasst gleichnamige
Räume mit gleicher Nummer auf demselben physischen Geschoss, Levelsuche,
zusammengesetzte Referenzen, Umbenennung und Räume ohne Level. Die nachfolgend
offene begrenzte Storeabfrage muss genau diese Suchsemantik erhalten.

## Nächste konkrete Lieferung

1. `DungeonBinderIndex` und `CampaignStore.dungeon` lesen derzeit das ganze
   Verzeichnis. 40 sichtbare Zeilen begrenzen weder den Read noch die Arbeit je
   Suchzeichen. Raum-/Key-/Feature-/Ausgangssuche und Floor-/Scopefilter als
   begrenzten Storequery unter einem konsistenten Snapshot liefern; stable Cursor,
   Trefferzahl und Fehlerstatus sichtbar halten. Keine versteckten Trefferlimits.
   Maßstab: vollständige Suche über ältere Treffer, 100.000 sparse Zellen mit
   realistischen Rooms/Keys, p95 nach den vorhandenen Fachbudgets messen.
2. Gezeigte Gruppenposition, Entdeckungen und Inhaltsbindungen können bei
   gleichbleibendem Campaigntoken veralten. Reise-/Gruppenaktionen müssen die
   gezeigte Scene-ID und ihre Fachrevision an den bestehenden Writer übergeben;
   ein frischer Read darf diese Zustimmung nicht heimlich ersetzen. Die
   Inhaltsports behalten aktuelle Definitionen und historische Fakten getrennt.
   Abnahme: Fokus/Position/Binding wechseln, während Details und Zielwahl offen
   sind; GM liest weiter, bestätigt aber keine Handlung für eine andere Gruppe.
3. Denselben Ablauf nativ prüfen: Raumlink → zurück → Filtern/Paging → Key
   bearbeiten → bestätigte Texte nach Fresh; Tastatur/200 %, verzögerte Reads,
   fehlende Bindungen und unverändert private GM-/Geheimtexte. Kein zusätzlicher
   Binderstore oder zweites Wissen-/Entdeckungsmodell.

Persistenter Reise-/Gruppenstand und noch offene Tempo-/Rundenregeln stehen im
[Dungeon-Reiseplan](travel-state.md); Binder- und Geometriebelege ersetzen dessen
Wiederaufnahme- und Entscheidungsabnahmen nicht.

## Räume ohne Umweg vorbereiten

Der Dungeon-Key bietet die vorhandene Raumanlage direkt in seiner Seitenleiste.
Vorherige gültige Eingaben werden gesichert; bei ungültigen Eingaben entsteht
kein weiterer Raum. Der neue Raum bleibt im ausgewählten Dungeon/Geschoss,
erhält eine freie rechteckige Ausgangskontur neben dem gewählten Kartenraum
und öffnet unmittelbar Name, Vorlesetext und GM-Notizen. Suchfilter werden dabei
geleert, damit der gerade angelegte Raum sichtbar bleibt. Vorhandene Räume,
Texte und Positionen werden nicht versetzt; Verbindungen werden separat geplant.

Die Kartenwerkzeuge bündeln spezialisierte Befehle unter „3D, Verbindungen und
Rauminhalte“. „Übersicht“ passt alle gerade gezeichneten Räume des sichtbaren
Geschosses ein; „Einpassen“ behält den einzelnen ausgewählten Raum im Fokus.
Beides ändert ausschließlich die Ansicht, einschließlich offener Konturentwürfe.


## Unabhängige Rauminhalte kopieren (0.129)

Der Dungeon-Key verbindet Quellraum und vorhandene Zielauswahl mit einer
expliziten Kopiervorschau. Bis zu 100 verschiedene Räume desselben Dungeons
können ausgewählte Namen, Vorlesetexte, GM-Texte, vollständige Beschreibungsblöcke,
Attribute, Tags, Referenzen, Key-Geheimstatus und Vorbereitungsstatus erhalten.
Die Quelle selbst bleibt ausgelassen. Ergänzen bewahrt vorhandene Inhalte;
Ersetzen betrifft ausschließlich ausgewählte Felder. Namen/Statusflags werden
bei Auswahl ausdrücklich ersetzt. Bei partieller Textersetzung an verknüpften
Zielen muss der GM ergänzen, die Zielvorlage lösen oder bewusst alle Blöcke ersetzen.

`key-copy-model.ts` berechnet sowohl Vorschau als auch Writerpatches. Ganze
Blöcke expandieren Textvorlagen zu unabhängigen Inhalten und rechnen alte
Markdown-Keyabschnitte als Text aus; Geometrie-/Attribut-/Ausgangsblöcke bleiben
Darstellungsanweisungen für die Zielgeometrie, keine kopierten Quellfakten.
Neue Blöcke bekommen je Ziel neue Kennungen. Andere beibehaltene Zielblöcke
behalten ihre Identität. Quelle, Raum-IDs, Anzeigezahlen, Level-/Gruppenzuordnung,
Polygone, originale Markdownabschnitte, Oberflächen, Features und Runtimewissen
werden nicht kopiert oder verändert. Referenzen behalten ihre Kampagnenziele.
Geerbte Quellattribute werden nur auf ausdrückliche Wahl als lokale Zielwerte
materialisiert; Unterdrückungen bleiben als solche erhalten.

Die Vorschau liest aktuelle Daten nach dem Flush gültiger eigener Eingaben und
zeigt für die ersten zehn Ziele getrennt vorlesbare und private Beschreibungen.
Weitere Ziele sind ausdrücklich als kompakte Liste markiert. Der Applycommand
bindet Quellraum-/Keyrevision, tatsächlich benötigte Textvorlagen-/Erbwerte und
sämtliche Zielraum-/Keyrevisionen. Veraltete Daten werden abgewiesen; ein später
Zielkonflikt rollt frühere Änderungen desselben Commands zurück. Die bestehende
Drawingtransaktion, History und Receipts machen den gesamten Stapel gemeinsam
rückgängig/wiederholbar. Keine neue Datenbank, Schemaänderung oder IPC-Operation.

Geprüft: echter Store mit zwei Zielen, Vorlagentext/Geheimnis, altem Markdown,
geerbtem Basaltattribut, externer Referenz und vorhandener Entdeckung. Kopien
besitzen unabhängige Kennungen; Spielertext erhält kein unbekanntes Geheimnis
oder private Suchnotizen. Replay verändert nichts, Undo/Redo und Fresh erhalten
Inhalte und Kennungen; Quellvorlagen- und später Zielkonflikt bleiben atomar.
Nativ geprüft: Quell-/Zielauswahl, Vorschau ohne Writes, spätere Vorlagenänderung,
Abweisung/Neuladen, getrennte Textvorschau, Apply, Undo/Redo und Neustart. Zwei
normale Exits, keine Rendererfehler. Große Stapel und 200%-Layouts bleiben unqualifiziert.
