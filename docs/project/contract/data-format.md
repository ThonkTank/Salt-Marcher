# Aktuelles Kampagnendatenformat

Status: Geltender Vertrag; technische Abnahme des Umbaus separat.
Owner: project
Last Reviewed: 2026-10-24 (Struktur und Quellen; Fachabnahme separat)
Source of Truth: Dieses Dokument definiert die Formatpolitik; `src/app/data-format.json` (Version und vollständige kanonische Tabellenliste) definiert die aktuelle Versionsnummer.

## Eine unterstützte Version

Neue Datenbanken werden unmittelbar im aktuellen Schema erzeugt. Der Store
öffnet ausschließlich dieses Schema. Leere neue Datenbanken werden initialisiert;
bestehende fremde oder versionslose Datenbanken sowie ältere und neuere Formate
werden abgelehnt, ohne deren Inhalte zu migrieren oder zurückzusetzen.

Kampagnenvorschau, Import und Backupvalidierung verlangen dieselbe Version.
Import remappt aktuelle Kennungen in einer Arbeitskopie; Quelldatei und Ziel
bleiben bei einer abgewiesenen Übernahme unverändert. Archivformatkennungen und
der Produktdatenordner `CampaignWorkbench` bleiben bestehen.

Build und Update-Metadaten lesen dieselbe Versionsdefinition. Ein neues Profil
benötigt keine Vorgängerversion. Ein Update auf ein inkompatibles vorhandenes
Testprofil bleibt ausdrücklich gesperrt. Testkampagnen werden neu erzeugt;
Archivierung oder Austausch eines Testprofils ist eine bewusste Entwicklungsaktion.

## Erhaltene Integrität

Formatvereinfachung entfernt historische Upgrades, keine Transaktionen,
Prüfsummen, Revisionen, Receipts, History oder Wiederherstellung unbekannter
Schreibausgänge. Fehlende kanonische Tabellen sind Beschädigung. Ableitbare
Indizes und Caches dürfen unabhängig davon neu aufgebaut werden.

## Reproduzierbare Lastdaten

`node tools/create-atlas-mixed-fixture.mjs tests/fixtures/atlas/mixed-world.sqlite.gz`
erzeugt die große Mischwelt aus einem frischen Store. Kleine native Proben legen
eigene Profile an. Archiv-Rundlauf, Undo/Redo und frische Wiederöffnung werden am
aktuellen Format geprüft; alte Formate erhalten Ablehnungstests.
