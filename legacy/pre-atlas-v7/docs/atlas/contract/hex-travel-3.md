# Checkpoint und Wiederaufnahme auf der aktuellen Atlasfläche

Status: Geltender Fachvertrag; offene Erweiterungen sind als Ziele beschrieben.
Owner: atlas
Last Reviewed: 2026-10-24 (Struktur und Quellen; Fachabnahme separat)
Source of Truth: Dieses Dokument besitzt das benannte Thema; Code belegt den Iststand, das Abnahmeregister den Prüfstand.

## Checkpoint und Wiederaufnahme auf der aktuellen Atlasfläche

Der native Prüfweg `tools/test-desktop-travel-checkpoints.mjs` bedient die
öffentliche Livekonsole: zwei Hexabschnitte mit ausdrücklich gesetzter
Zweistundendauer, Unterbrechung nach dem ersten Abschnitt, normal schließen,
frisch öffnen, ausdrücklich fortsetzen, ankommen, frisch öffnen, den letzten Schritt zurücknehmen,
nochmals frisch öffnen und denselben Schritt ausdrücklich wiederholen.
Er verwendet die vorhandene Atlaswurzel mit 3-Meilen-Hexen. Die frühere Probe
`test-desktop-travel-target.mjs` verwendet dagegen eine zweite Karte und den
inzwischen verborgenen Welttab; ihre historischen Ziel-/Labelbelege sind keine
Qualifikation dieses aktuellen Ablaufs.

Die neue Probe wartet zusätzlich auf die gezeichneten Canvaspixel: blauer
Gruppenmarker am bestätigten Hex, Restweg ab diesem Hex und kein Restweg nach
Ankunft. Nur auf den Konsolenstatus oder den abgeschlossenen Read zu warten,
kann vor dem nächsten Zeichenframe noch ein altes Kartenbild erfassen. Keine
SVG-Objektabfrage: der veröffentlichte Atlas ist inzwischen ein Canvas.
Die Pixelprüfung dekodiert ein eingebettetes Bildschirm-ICC-Profil vor dem
exakten Vergleich mit den sRGB-Quellfarben. Das native Produktbild bleibt
unverändert; der Start wartet auf den bestehenden sichtbaren Navigationsanschluss.
Frische kanonische Reads prüfen genau eine ursprüngliche Zeitbuchung je erreichtem Hex
und je einen zusätzlichen kausalen Zeitbeleg für Rücknahme und Wiederholung,
die unveränderte Reiseprosa, Position und Uhr sowie den terminalen Stand ohne
weitere Zeitbuchung. Belege enthalten Source-SHA, Dirty-Status, fünf Runtimehashes,
Profil, tatsächlichen Browserzoom und normale Prozessausgänge; fehlgeschlagene
Läufe können keinen alten Erfolgsbeleg hinterlassen.

### Kausale Rücknahme und Wiederholung

Die Originalanforderung
[Program Capabilities, Travel](https://github.com/ThonkTank/Salt-Marcher/blob/9de85c1a26f526acbc1af332ac5962e185c0aab2/docs/project/requirements/requirements-program-capabilities.md#L364-L368)
verlangt mehrere rücknehmbare Checkpoints samt ausschließlich durch sie erzeugten
Folgen und Schutz späterer autoritativer Scene-Fakten. Die Livekonsole bietet
nun beim bestätigten Reisestand „Letzten Reiseschritt zurücknehmen“ und
„Reiseschritt wiederholen“. Nach Ankunft steht dieser Stand vor dem Planungsformular;
die abgeschlossenen Wiedergaberegler entfallen. Eine zurückgenommene aktive
Reise bleibt pausiert. Wiederholen stellt die ursprünglichen Ergebnisse her,
ohne Zeitverbraucher erneut auszuführen oder automatisch weiterzureisen.

`storage/travel-history.ts` gehört zum bestehenden Worldwriter. Der Store hält
in `travel_checkpoint` pro Hexabschnitt die tatsächlich geänderten Runtimezeilen,
ihre Ursache, Gruppe, Epoche, Zeit und Position fest. Verbindungslokale temporäre
SQLite-Trigger erfassen die Änderungen innerhalb derselben Transaktion; unbekannte
Zeitverbraucher brechen den gesamten Checkpoint ab. Keine Tabellen- oder
Datenbanksnapshots werden zur Rücknahme eingespielt. Nur ursprünglich geänderte
Felder werden invertiert; unabhängige spätere Prosa bleibt erhalten. Konflikte
mit inzwischen geänderten betroffenen Feldern verhindern die gesamte Rücknahme.
Domänenvalidatoren prüfen den resultierenden Stand vor dem Commit.

Hat eine andere Scene derselben Epoche den betroffenen Zeitraum bereits bestätigt,
bleiben gemeinsame Weltfolgen bestehen. Diese Entscheidung bleibt am Checkpoint
auch für spätere Wiederholung gespeichert. Die eigene Uhr, Position und eigenes
Wissen werden weiterhin zurückgenommen. Neue Bewegung nach Rücknahme verwirft
den offenen Wiederholungszweig, erhält aber seine ursprünglichen Belege.
Originalreceipts und vorwärts gerichtete `scene_time_step` bleiben unverändert;
Rücknahme/Wiederholung erhalten eigene idempotente Receipts und zusätzliche
`travel-history-v1`-Zeitbelege. Nur ein gültiger ursprünglicher Checkpoint erlaubt
diesen rückwärts gerichteten Uhrübergang. Atlas-Autoren-Undo bleibt getrennt.

Fresh und unabhängiger Archivtransfer erhalten auch ausstehendes Wiederholen,
inklusive neu gebundener Checkpoint-, Zielort- und Zeitursachen-IDs. Ein fehlender
Checkpoint-Speicher oder beschädigte Ursachen werden abgewiesen. Es gilt der
[aktuelle Datenformatvertrag](../../project/contract/data-format.md).
Die vorhandenen Tests prüfen mehrere Schritte, neuen Zweig, unabhängige Prosa,
Receiptreplay, spätere fremde Scene, Restock, Fallenreset, abgeschlossene NPC-Arbeit,
Rollback unbekannter Zeitfolgen und unabhängige Kopie. Die native Probe bedient
Unterbrechung, Wiederaufnahme, Rücknahme und Wiederholung mit vier normalen
App-Starts und -Exits; technische Tests ersetzen keine Ownerabnahme.

Der Verlauf gilt innerhalb der aktuellen angenommenen Weltreise. Nach Annahme
einer neuen Route wird keine frühere Reise als Rücknahmeziel angeboten. Lokale
Dungeonreisen, jede mögliche Autonomy-/Wahrnehmungsfolge, größere Routen und
allgemeine Ownerabnahme sind dadurch nicht umfassend qualifiziert.
`SMR-AC-08/09` bleiben eigenständig offen.

## Nächste ausführbare Lieferungen

1. **Rücknahme über Routengrenzen und weitere Zeitfolgen.** Den vorhandenen
   kausalen Verlauf auf neue angenommene Routen und lokale Dungeonreisen erweitern
   und weitere Autonomy-/Wahrnehmungskombinationen tatsächlich qualifizieren.
   Administrative Zeit-/Platzierungsänderungen bleiben kein Ersatz.
2. **Gemeinsamer Biomkatalog und größere Routen.** Die ursprüngliche Hexquelle
   verlangt installationseigene, im Editor verwaltete Biome und denselben
   Definitionsbestand für Kreaturfilterung. Die aktuelle Terrainmenge ist weiter
   fest; Custom-Biome, definierte Zuordnung der bisherigen Habitatstrings,
   geschützte Built-ins und Transferkonflikte fehlen. Die neue Passierbarkeit
   ist unabhängig davon und ersetzt diesen Umfang nicht. Die aktuelle
   Routensuche bleibt ein Rechenbudget mit erklärter Abschnittsteilung, keine
   Begrenzung der kontinuierlichen Kartenfläche.
3. **Präsentation weiter qualifizieren.** Die vorhandene Wiedergabe auf großen
   Routen und bei 100 % prüfen. Pointerinterpolation ist nicht Bestandteil der
   autoritativen Checkpoints; jede zusätzliche Animation bleibt reine Darstellung.
4. **Gemeinsame Bedienung weiter qualifizieren.** Vorhandene Drag-Platzierung,
   Tastaturalternative, Wegpunkte und Auswahl im selben Scene-/Mapkontext mit
   laufender Reise und verschachtelten Ortsmarkern bedienen.
   Die vorhandene dreiteilige Utilityauswertung mit kanonischen Biomen und
   vorhandener ausdrücklicher Transport-/Passierbarkeitsregel konsistent weiterführen. Mapwechsel
   leert nur transienten Entwurf/Auswertung; Scenewechsel übernimmt keine alte
   Antwort. Reiseansicht allein erzwingt keinen anderen Arbeitskontext.
   Native Abnahme mit Kartenwechsel, langen Routen,100 %, Fehlerantwort,
   Prozessunterbrechung, Fokuswechsel und finalem Interrupt ohne Doppelbuchung.

### Geländeänderungen ohne Quellenkartenkopie (21.10.2026)

Die Reisebasis bindet zusätzlich eine optionale dauerhafte `terrain-environment`-Revision aus `world_record`. Der Atlas erhöht sie atomar bei tatsächlichen Landschaftsänderungen sowie Undo/Redo. Dadurch muss die unveränderte, möglicherweise große Quellenkarte nicht mehr für jeden Pinselauftrag neu geschrieben und in die History kopiert werden. Vorhandene Bestände ohne diesen Datensatz behalten ihre bisherige Reisebasis bis zur ersten Terrainänderung. Die Revision wird bei unabhängigen Kampagnenkopien mit der Kartenzuordnung übernommen und bei Sicherung/Import geprüft. [Gegenproben und Grenzen](https://github.com/ThonkTank/Salt-Marcher/blob/ed51f20e912b8e3a80123adc68f36fd94d4a0be2/docs/reference/atlas-bounded-terrain-history-20261021/README.md).


Die gemeinsame [Formatpolitik](../../project/contract/data-format.md) ersetzt frühere Schema- und Migrationsangaben.
