# #40: Ursache des Shared-Ort/Key-Save-Ausfalls (D01)

Hex, `E2E-01-SHARED-LOCATION-KEY-D01`, 10.10.2026. Ein begrenzter Diagnoseeingang zu
`SHARED-LOCATION-H01-SAVE-01` und `E2E01-HEX-SPACE-RUNTIME-NAVIGATION-001`.
Der ursprüngliche [native H01-Befund](../atlas-shared-location-h01/README.md) bleibt
unverändert **FAIL**. Dieses Paket enthält keine Produktreparatur und keine neue
GUI-/Neustartprobe. [Gebundene Quittung](receipt.json).

## Ursache und Nachweis

Der reale Editor erzeugt ausdrücklich einen lokalen, noch nicht registrierten Ort.
`AtlasView.resolveLocation()` gibt dafür den kanonischen neuen Ortspfad zurück.
Die nachfolgende Save-Kette unterstützt bisher nur Nutzbytesänderungen innerhalb
eines unveränderlichen bestätigten Campaignbestands.

| Grenze | Konkreter Befund |
| --- | --- |
| `AtlasCampaignNavigation.checkFiles()` / `save()` | Neue Terrain-Dateien sind ausdrücklich zugelassen, neue Location-Dateien fehlen im bestätigten Inventar und werden verworfen. Das passiert **vor** `repository.save()`. Die Fehlerbehandlung verwendet dieselbe Prüfung erneut; sie verwirft auch den unveränderten Entwurf, entzieht den Mount und meldet „Speicherbasis ist unbestätigt“. |
| `AtlasCampaignManifestSave.checkFiles()` / `records()` / `owners()` | Ein direkter Aufruf des Repository-Saves scheitert ebenfalls vor der Transaktion: acht erfasste native Dateien passen nicht zu sieben bestätigten Dateien. Zusätzlich verbieten die Recordbelege `before: null` und neue Recordkennungen. |
| `CampaignRuntimeManifestSaveParticipant.prepare()` / `authorizedOwners()` | Ein unbekannter nativer Ortspfad wird vor der Ownerprüfung abgewiesen. Ein isolierter zusätzlicher Atlas-Ownerrecord wird ebenfalls vor seiner Autoritätsprüfung abgewiesen. Dateierzeugung und Record-/Manifestbestand sind im bestehenden Vertrag ausdrücklich unveränderlich. `validateRecovery()` verwendet dieselbe unveränderliche Closure. |

Die [Gegenprobe](probe.ts) verwendet tatsächliche Repository-, Navigation-,
Campaign-Provider-, Adapter- und Participantklassen mit einem isolierten
Speicherport. Sie reproduziert Create, Undo/Redo, Key und Move mit den ursprünglichen
H01-Kennungen. Ihr Entwurf ist **bytegleich** zum erhaltenen H01-Entwurf:
SHA-256 `101ac69851e8dd87e742c67eb3e1f62ecdde84e43bddea1f401fd3b63474c585`.
Es gibt weder einen erzwungenen Produktfehler noch einen ersetzten Savepfad.

Je sechs Szenarien auf beiden expliziten Quellständen bestanden:

- No-op-Navigationssave erreicht das echte Repository und erhält den aktiven Mount.
- Save des neuen Orts erreicht das Repository **nullmal**, schreibt **nullmal**,
  erhält sämtliche Before-/Draftbytes und den Providercontext, entzieht aber den Mount.
- Direktes Repository-Save desselben neuen Orts scheitert im Adapter ohne Schreibvorgang.
- Eine Namensänderung an einem bereits bestätigten Ort wird gespeichert und erhält
  eine frische Registryrevision.
- Der Campaign-Participant verwirft den neuen Ortspfad vor jeder Ownerautorität.
- Er verwirft auch einen zusätzlichen Atlas-Ownerrecord vor jeder Ownerautorität.

[H01-Quellstand](h01-result.json): `b87a066e38f1a0000def253bf50e45ee4a5d604f`.
[Aktueller komponierter Stand](shared-result.json): `a6c4d89df40746bcce1cc0726f725c97708bc4b7`,
einschließlich freigegebenem Shared `93b670aca7927e1915f4c299eb131b4faa8b9fe3`
aus PR61 mit unabhängigem R02-PASS und erfolgreicher Exact-SHA-CI.
Die vier untersuchten Produktdateien sind zwischen H01 und diesem Stand bytegleich;
[Quellbindung](source-bindings.json). Die gezählte Nullzahl von Aufrufen/Schreibvorgängen
stammt aus dieser Modellgegenprobe; H01 selbst wurde nicht nachträglich instrumentiert.
Sie erklärt dessen erhaltene Dateien und sichtbaren Mountentzug. Die später gemeldete
widerrufene Kampagnenbindung ist eine Folge dieses Entzugs, nicht der erste Savefehler.

## Konkreter Reparatureingang, nächster separater Lauf

Hex behält #40 und den Atlas-Navigations-/Adapterteil auf PR62. Eine bloße
Ausnahme in `checkFiles()` reicht nicht. Der benötigte Campaign-Save-Vertrag liegt
bei Campaign/Data; dieses Paket übernimmt oder startet dessen fremden Scope nicht.
Der bestehende Owner erhält diesen konkreten Eingang über #40/#12.

1. Die Navigation muss bestätigte Beforedateien weiterhin vollständig prüfen und
   einen geschlossenen lokalen neuen Ortsentwurf gesondert validieren: kanonischer
   Pfad, tatsächlich fehlende Datei, eindeutige Location-/Placement-/Section-IDs,
   zugehörige Worldposition und unveränderter Context. Unbekannte fremde Dateien
   dürfen dadurch keine Saveberechtigung erhalten. Ein Abbruch vor der Transaktion
   darf einen weiterhin belegbar gültigen Mount/Entwurf nicht wegen derselben
   unpassenden Inventarprüfung entziehen.
2. Der native Atlasadapter muss vollständige Before-/After-Ownerbelege für die neue
   Location, ihre Sections und ihr Worldplacement liefern. Der Campaign-Participant
   benötigt einen engen, ausdrücklich vom vorhandenen Atlasowner autorisierten
   Bestandserweiterungseingang. World-/Locationdatei, Atlas-Recordinventar und
   Registry müssen gemeinsam gebunden werden; City-/Dungeonowner, Campaignidentität,
   fremde Nutzbytes und Policies bleiben erhalten. Keine zweite Registryautorität.
3. Derselbe zulässige Delta muss Prepare, Acknowledgment, Rollback und Recovery
   passieren. Ein Journal muss die vollständige neue Datei mit `before: null`, die
   exakten World-/Manifestbytes und den ursprünglichen Draft belegen. Vorherige
   und neue Dateimengen dürfen nicht als unveränderlich gleiche Liste geprüft werden.
4. Regressionen müssen erfolgreiches Create/Key/Move/UndoRedo/Save, fremde Pfad-/ID-
   Kollision, Abbruch vor Commit, unterbrochenes Journal, Rollback/Retry und Fresh-
   Open prüfen. Anschließend folgt mit **neu abgestimmtem** GUI-Slot die echte
   Save-/frischer-Prozess-Probe und die unabhängige #40-Abnahme.

Der nächste eigene Lauf ist gezielte Reparatur bzw. Konsum des konkreten qualifizierten
Campaign-Vertragseingangs. Detaillinks/CITY und E2E-02–04 bleiben danach.
Tests, tatsächliche Hostbedienung, Originalparität, Großkarten und Installation
bleiben getrennte Nachweise; D01 schließt keines dieser Produktgates.

## Wiederholen

Vom Repository aus mit Node 22 und dessen installierten Entwicklungsabhängigkeiten:

```sh
node docs/reference/atlas-shared-location-d01/run.mjs /absoluter/quellstand /qa/D01-result.json /absolutes/repository-mit-H01-Belegen
```

[Runner](run.mjs) bündelt nur den angegebenen Quellstand. Ausgabe und Testbundle
liegen am angegebenen QA-Ort. Fixtures, H01-Belege und Nutzervault bleiben read-only.
[Erhaltungsprüfung](preservation.json) bestätigt die historischen H01-Artefakte,
den geschützten Originalcheckout und die fremden Checkpoint-/Acceptancebereiche.
