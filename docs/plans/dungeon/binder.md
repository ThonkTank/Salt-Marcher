# Dungeon-Binder am Spieltisch

Stand: 14.10.2026. Der Binder verbindet bestehende Raum-Keys, Geschosse,
Ausgänge, Fallen und gebundene Encounter-/Gruppen-/Schatzinhalte mit dem
laufenden Spiel. Er nutzt `CampaignStore.dungeon`, `DungeonBinderIndex` und
`DungeonBinder`; Lesen und Blättern bestätigen weder Entdeckung noch Bewegung,
Weltzeit, Kampf oder Loot. Der vollständige [Dungeonumfang](smr04-spatial-coverage.md)
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
