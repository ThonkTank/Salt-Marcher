# Eigentümer der Kampagnentransferverträge

Status: Current
Owner: campaign
Last Reviewed: 2026-10-24
Source of Truth: Fachtypen und ihre `.transfer.json`-Deklarationen besitzen die Referenzbedeutung; automatisierte Prüfungen und native Abnahme bleiben getrennt.

Der [Archivvertrag](archive.md#copy-complete-import-remap-und-ownerlieferung)
verlangt eine unabhängige Kopie einschließlich Entwürfen und historischen
Beziehungen. `campaign-data.ts` koordiniert diesen Vorgang, entscheidet aber
nicht anhand von Feldnamen oder `_id`-Endungen über Identitäten.

## Wo eine Änderung hingehört

Neben den verwendeten Fachtypen liegen `.transfer.json`-Dateien. Beispielsweise
besitzt [drawing-contracts.transfer.json](../../../src/app/atlas/drawing-contracts.transfer.json)
die Bedeutung von `DrawingElement.targetFloorId`, während
[music-contracts.transfer.json](../../../src/app/music-contracts.transfer.json)
Audioverweise auf gemeinsame Definitionen bindet. Eine identische Zeichenfolge
kann in einem Namen unverändert bleiben und in einem Referenzfeld eine neue
Kennung erhalten.

Die Deklarationen neben den Speichermodulen ordnen jede kanonische Tabelle und
jede SQL-Spalte einem Fachowner und einer Behandlung zu. Es gibt drei
Tabellenbehandlungen: übernehmen, abgeleitete Suchdaten neu aufbauen und
bewusst nicht übertragbare Verwaltungs-/Atlasbefehlsbelege verwerfen. Die
vollständige Liste muss genau zu `data-format.json` und dem tatsächlichen
SQLite-Schema passen. Auch die FTS-Schattentabellen sind als abgeleitet erklärt.

[models.ts](../../../src/app/transfer/models.ts) verbindet gespeicherte Payloads
mit ihren TypeScript-Fachtypen und beschreibt interne Speicherhüllen ohne
Renderer-API. Die Referenzrollen unterscheiden lokale Kennungen, gemeinsame
Definitionen, lokal oder gemeinsam nutzbare Tabellen, historische
Definitionsfassungen, externe Kennungen, verlinkbaren Autorentext und opaque
Inhalte. Providerbytes, Kreaturquellen und Herkunftsbelege werden nicht als
beliebig durchsuchbare Referenzbäume behandelt. Aktivierungstokens werden
unbrauchbar gemacht; unvollständiger NPC-Entwurfstext bleibt erhalten.

## Ein Prüf- und Kopierweg

[registry.ts](../../../src/app/transfer/registry.ts) und
[codec.ts](../../../src/app/transfer/codec.ts) benutzen dieselben Verträge für
Vorprüfung, Sammeln der lokalen Kennungen und Umschreiben. Gespeicherte SQL-Zeilen
in Zeichnungs- und Reisehistorien werden an den Vertrag ihrer ausdrücklich
benannten Tabelle weitergegeben. Ihre Payload-Prüfsummen werden anschließend
neu berechnet. Die Fachprüfungen für Existenz, Zustand, Revision und historischen
Zusammenhang bleiben zusätzlich erforderlich; ein Transfervertrag ersetzt sie
nicht.

Unbekannte Tabellen, Spalten, Payloadfelder oder nicht unterstützte Varianten
führen vor Veröffentlichung zum Abbruch. Das geschieht auch dann, wenn ein
unbekanntes Feld scheinbar wie eine ID aussieht. Die Quelle bleibt unverändert;
die Veröffentlichung in den Zielstore bleibt eine Transaktion. Die bisherigen
V1-Capability-Referenzhüllen haben einen gesonderten, ausdrücklich begrenzten
Vertrag in [capability-references.ts](../../../src/app/transfer/capability-references.ts).
Ihre Providerdaten werden nicht in Core-Fachtypen umgedeutet.

## Verträge ergänzen und prüfen

1. Den Fachtyp und seine Deklaration gemeinsam ändern. Freie Stringfelder und
   Dictionaries brauchen eine ausdrückliche Rolle; `opaque` benötigt einen
   fachlichen Grund. Neue Tabellen erhalten ihren Owner am Speichermodul.
2. `node tools/build-transfer-contracts.mjs --write` erzeugt die Laufzeitverträge
   `contracts.json` und `tables.json`. Der Generator leitet nur die Struktur aus
   TypeScript ab, niemals die Referenzbedeutung aus einem Feldnamen.
3. Die generierten Änderungen prüfen. `npm run check:repo` kontrolliert die
   vollständige Tabellenzuordnung und vergleicht die Fachtypen mit dem
   eingecheckten Ergebnis. Ein neues Feld kann deshalb nicht unbemerkt in einem
   veralteten Transfervertrag fehlen.
4. Den betroffenen vollständigen Kopier-/Importablauf einschließlich frischem
   Öffnen prüfen. [Transferregressionen](../../../tests/atlas/desktop-transfer-contracts.test.mjs)
   sichern unterschiedliche Rollen gleicher Zeichenfolgen, Historienzeilen,
   Schemaergänzungen und unveränderte Eingangs-/Zieldaten bei Ablehnung.

Datenformat, Archivkennungen und Rendererprivilegien ändern sich dadurch nicht.
Worker-Verlagerung und Editorlebenszyklen gehören zu den getrennten Folgearbeiten.
