# Monsterkatalog

Status: Verbindlicher Zielumfang; historische Umsetzungsbelege sind keine aktuelle Abnahme.
Owner: catalog
Last Reviewed: 2026-10-24 (Struktur und Quellen; Fachabnahme separat)
Source of Truth: Dieses Dokument besitzt das benannte Thema; Code belegt den Iststand, das Abnahmeregister den Prüfstand.

## Monsterkatalog

### Vorhandene Basis

Der geprüfte Katalogkern enthält 334 SRD-5.1-Kreaturen mit Manifestbindung,
unabhängigem Artefakthash, kombinierten Filtern, Sortierung, Paging, Detailzugriff
und tiefer Immutabilität. Der derzeitige Obsidianadapter stellt ihn über einen
Lazy Loader und eine eigene Katalogansicht bereit. Die aktuelle Fachabnahme und
ihre Grenzen stehen in `acceptance.json.saltMarcherCatalogEncounter`.

### Verbindliche Entscheidungen

1. Katalog ist eine persistente GM-Arbeitsfläche: Query, Auswahl, Paging und
   Scrollposition bleiben bei Fokuswechsel erhalten. Ein Modal allein genügt
   diesem Nutzerweg nicht. Der alte Obsidian-ItemView/View-Type ist keine Ziel-API.
2. Quelle/Manifest/Inhaltshash/Lizenz und stabile Definition-IDs bleiben
   verbindlich. Geprüfte gebündelte Daten werden im Installationcatalog des
   gewählten Stores indexiert; readonly Provider liefern paginierte immutable
   DTOs. Keine komplette Statblockmaterialisierung bei Produktstart.
3. Renderer/Controls lesen weder Dateien noch SQLite. Parser/Queryalgorithmen
   dürfen nach Prüfung übernommen werden. Fehler sind identifiziert und
   wiederholbar; kein stiller Source- oder Regelversionswechsel.
4. Notice/Attribution ist im Produkt und Export direkt erreichbar und benennt
   alle gebundenen Quellen/Lizenzen, Normalisierung und Kopie. Das neue
   eigenständige Paket liefert diese Inhalte distributionssicher mit.
5. D&D 2014 bleibt einziges Coreprofil; keine 2024-/Multisystemarchitektur.

Die frühere main.js-/Base64-/DecompressionStream-/Drei-Plugin-Dateien-
Entscheidung wird ersetzt. Ihre Lauf-/Buildbelege im Abnahmeregister sind historische
Obsidianbefunde, kein Zielpackaginglimit. Neue Bundleartefakte erhalten
Manifest-/Hash-/Offline-/Installationsprüfung an der neuen Zielshell.

### Oberfläche und Zustandsbesitz

`CreatureCatalogView` besitzt pro geöffneter Ansicht:

- akzeptierte Query und noch nicht veröffentlichte Texteingabe,
- ausgewählte Kreaturen-ID,
- Seite, Sortierspalte und Richtung,
- Ergebnis- und Detailprojektion,
- Scrollposition von Ergebnisliste und Detailbereich,
- 200-ms-Debounce-Timer, Query-Generation und einen `AbortController`.

Die erste schmale Umsetzung verwendet drei Bereiche:

1. Eine kompakte Filterleiste mit Namenssuche, CR min/max, Typ, Größe,
   Habitat, Alignment, AC min/max, HP min/max sowie Freitextfeldern für
   Bewegung, Sinne, Verwundbarkeit, Resistenz, Immunität und
   Zustandsimmunität. Quelle ist sichtbar `SRD 5.1`; sie ist kein sinnloser
   Einzelauswahlfilter.
2. Eine semantische Ergebnistabelle mit sortierbaren Spalten Name, HG, RK, TP
   und XP. Typ, Größe und Quelle bleiben sichtbar. Tabellenfuß enthält Anzahl,
   Seite, Zurück/Weiter und eindeutigen Lade-/Leer-/Fehlerstatus.
3. Ein read-only Statblock-Inspector mit Name, Metazeile, RK/TP/Bewegung,
   Attributen, Rettungswürfen, Fertigkeiten, Sinnen, Sprachen,
   Verwundbarkeiten/Resistenzen/Immunitäten, Eigenschaften, Aktionen und
   legendären Aktionen. Er verändert weder Karte noch Encounter.

Alle aktiven Filter erscheinen als einzeln entfernbare Chips; `Zurücksetzen`
leert nur Filter und springt auf Seite eins. Sortierung bleibt erhalten. Ein
Nameklick, Doppelklick oder Enter auf einer ausgewählten Zeile öffnet Details.

### Tastatur und Barrierefreiheit

- Suchfeld und Filter besitzen sichtbare Bezeichnung oder `aria-label`.
- Tabellenkopf-Buttons veröffentlichen `aria-sort`.
- Ergebniszeilen sind per Tab erreichbar; Pfeil hoch/runter verschiebt die
  Auswahl, Enter öffnet Details.
- Status verwendet `role=status`, Fehler `role=alert`; Detailüberschriften
  behalten eine nachvollziehbare Hierarchie.
- Escape leert eine geöffnete Detailauswahl, aber nicht die Filter.
- Fokus wird bei einer Aktualisierung nicht versetzt. Eine weiterhin vorhandene
  Auswahl bleibt nach Query-/Sortieränderung über ihre stabile ID erhalten.

### Fokussierte Prüfungen

- Quellenhash, Manifest und Attribution prüfen; vor Öffnen keine vollständige
  Statblockmaterialisierung. Beschädigte Daten zeigen einen konkreten Fehler;
  nach Behebung lädt derselbe Retry den gültigen Katalog.
- Paralleles Öffnen erzeugt eine sichtbare Katalogansicht. Debounce, verspätete
  Queries, Schnittmengenfilter, Paging, Auswahl, Fokus, Scroll, Enter/Escape,
  `aria-sort`, Status und Lizenzzugang erfüllen den gemeinsamen Providervertrag.
- Normales Schließen und frischer Prozess erhalten bestätigten Ansichtszustand;
  bewusstes Schließen der Ansicht und neue Anlage beginnen mit gültigen Defaults.
  Filter, Tabelle, Inspector und Lizenz bleiben auch in schmalen Ansichten erreichbar.
- Den tatsächlichen Zielhost prüfen. Alte Obsidian-, Gzip-/Base64- und main.js-
  Belege übertragen weder ihren PASS noch ihre Packaginglimits auf den neuen Kern.

### Offene Abnahme

CE-AC-01, CE-AC-02 und CE-AC-14 benötigen weiterhin den vollständigen
Produktlifecycle und die fehlenden physischen, Screenreader- und Plattformproben.
CE-AC-03 bis CE-AC-13 sind durch den Monsterkatalog nicht geliefert.

## Monster-Hostprüfung

**Datierter Befund vom 09.10.2026:** Der automatisierte H01-Scope auf
`aa6d92d6cb1d8c8e06a0a61233ad837d25e40c05` ist geprüft. Drei getrennte echte
Obsidianprozesse belegten Öffnen über die Befehlspalette, genau eine sichtbare
Ansicht bei überlappender Öffnung, Filter/Chips/Sortierung/Paging/Details,
Tastatur-/Fokus-/Scrollzustand, frische Wiederaufnahme und gültige Defaults nach
bewusster neuer Anlage. Die Größen 900×650 und 1150×700 waren ohne horizontalen
Hauptüberlauf bedienbar; normale Prozessenden sind gebunden.

Der beschädigte-Payload-Fall injizierte einmal ungültige Gzip-Bytes vor dem alten
Produktdecoder. Ein sichtbarer Fehler und Retry in derselben Ansicht bestanden
nach Rücknahme der Injektion. Das ist ein kontrollierter Hostfehlerfall, kein
Nachweis eines manipulierten Releasebundles. Die dabei gefundenen Timer- und
Restoredefaultfehler wurden behoben und regressionsgeprüft.

Exakter Build, Receipts und Grenzen stehen ausschließlich unter
`acceptance.json.saltMarcherCatalogEncounter.ce01H01`. Der
[historische Ablauf und die alten Buildpakete](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/blob/68eab342b656b56b2d03e5e7228ecf56d37373b5/ROADMAP-SALTMARCHER-CATALOG-ENCOUNTER-PLAN.md)
bleiben im Gitstand verfügbar. Physische Tastatur/Maus, Screenreader und weitere
Plattformen wurden nicht geprüft; H01 schließt weder volle CE-01-Fachfreigabe
noch Encounterfunktion oder den neuen Zielhost ab.
