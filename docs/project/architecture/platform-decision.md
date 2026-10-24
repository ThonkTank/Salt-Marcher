# SMR-00-ADR-01 – Zielplattform und Übergang

Status: Current; offene Ziele sind als solche beschrieben.
Owner: project
Last Reviewed: 2026-10-24 (Struktur und Quellen; Fachabnahme separat)
Source of Truth: Dieses Dokument besitzt das benannte Thema; Code belegt den Iststand, das Abnahmeregister den Prüfstand.

Status: **technische Richtung entschieden am 11.10.2026; Implementation und
Produktqualifikation offen.** [ARCHITECTURE](overview.md) besitzt die
Gesamtgrundlage; hier stehen Auswahl und Cutover.

## Entscheidungskontext

Vollständiger offlinefähiger SaltMarcher-Umfang plus durchgehend bearbeitbarer
Atlas, kontrollierte Speicherung/Recovery, portable Medien, zweite Anzeige,
abbrechbare Jobs und widerrufbare Extensions. Das Endprodukt muss nach
Nutzerentscheidung kein Obsidian-Plugin sein. Bestehender Code hat keinen
Bestandsschutz. Nutzerinhalte, Identitäten, bestätigte Wirkungen, externe
Formatbindungen und Attribution werden geschützt.

## Bewertete Optionen

Bewertung relativ zum **gesamten** bekannten Auftrag, nicht nur zum ersten
Karteneditor. Aufwand und Risiko sind Planungsurteile, keine gemessenen Projektzeiten.

| Option | Gesamtaufwand / Verständlichkeit | Bedienbarkeit / Integrität | Leistung / Änderbarkeit | Urteil |
| --- | --- | --- | --- | --- |
| Obsidian dauerhaft, bestehende Editoren erweitern | zunächst wenig Shellarbeit; zunehmend Sonderadapter für Fenster, Audio, DB und Extensions | Vaulttexte direkt erreichbar; privilegierter Fremdhost und Mehrdateiwrites erschweren klare Schutz-/Recoverygrenze | zusätzliche Kopplung/Whole-Document-Zustände; Hostkontrolle begrenzt | Nicht gewählt. Ein scheinbar billiger Start verschiebt bekannte Kernprobleme. |
| Bestehenden Plugineditor vollständig entkoppeln und in Electron übernehmen | viel Adapter-/Lifecyclearbeit; bestehende interne Modelle bestimmen weiterhin den Kern | bekannte Bedienung nutzbar, aber unabhängige Sources/History/Filejournale bleiben zu bereinigen | Hostimportfreiheit allein beweist keine brauchbare Speicher-/Querystruktur | Nicht als Architektur gewählt. Einzelne geprüfte Algorithmen/Controls dürfen übernommen werden. |
| Kleiner neuer TypeScript-Kern + SQLite + Electron; selektive Wiederverwendung | initial neue Schreib-/Projektionsgrenze; nur eine Sprache und ein lokaler Store, kein verteiltes Fachcommit | gemeinsame atomare Outcomes, Rechte/Anzeige/OS kontrollierbar; bekannte Nutzerabläufe fähigkeitsweise anschließen | Records/Chunks und Worker können die bekannten Profile bedienen; reine Fachmodule austauschbar | **Gewählt: geringste absehbare Gesamtkopplung bei vollständigem Pflichtumfang.** |
| SaltMarcher als Ganzes übernehmen | viele Desktopfeatures verfügbar; fremde Atlas-/Daten-/UXarchitektur müsste trotzdem ersetzt werden | alter Workflow darf neuere Atlas-/Hausentscheidungen nicht überstimmen | große Altlast statt begründeter Einzelreuse | Nicht gewählt. Daten/Golddaten/UXbelege sind Referenzen. |
| Tauri/Rust oder vollständig native Oberfläche | kleine Shell möglich; zweite Sprache und anderes UI-/Worker-/Bindingsystem zusätzlich zu TS/Pixi | kann alle Kernpflichten erfüllen, aber kein belegter Vorteil für diesen Auftrag | geringerer Shellverbrauch denkbar; zusätzliche Portierungs-/Toolchainkosten | Derzeit nicht gewählt. Neu bewerten nur bei belegtem Electronbudget-/OSproblem. |
| Web/PWA als Primärhost | einfache Bereitstellung, native Hilfen für bekannte Medien-/Datei-/Fenster-/Rechtepflichten nötig | lokale vollständige Betriebs-/Recoverykontrolle weniger direkt | würde bekannte native Grenzen erneut ergänzen | Nicht gewählt; kein zusätzliches Webendprodukt. |

## Entscheidung und Grenzen

Eigenständige Electron-Shell mit kleiner Preload-API, isolierten Renderern,
TypeScript-Fach-/Applicationkern und einem lokalen SQLite-Schreibdienst.
Die UI wird aus den Nutzerwegen entwickelt; es gibt keine Pflicht, vorhandene
imperative Editorobjekte oder ihre Dateischnittstellen zu erhalten.
Geeignete Pixi-/Geometrie-/Regel-/Quellenbausteine werden nach Verhalten,
Abhängigkeiten und Gesamtkosten einzeln geprüft. Obsidian bleibt bis Cutover
die bisherige nutzbare Installation, kein dauerhaft mitzupflegender zweiter Host.

Ein einzelner lokaler GM benötigt keinen verteilten Sync, Backendserver oder
Mehrbenutzerkonfliktalgorithmus. Passive Anzeige bleibt read-only. Die
privilegierte Shell besitzt Datei-/DB-/Fenster-/Audiozugriffe; weder Domäne
noch Canvas noch Drittanbieter erhalten beliebige native APIs.

## Technische Nachweise

Die [P01–P04/C01-Verträge](../verification/architecture-experiments.md) qualifizieren
den gewählten Anschluss. Entscheidung und erwiesene Implementation sind
getrennte Aussagen. Ein fehlender OS-/Power-Loss-/Mediennachweis wird nicht
durch diese Dokumentationsentscheidung als PASS ersetzt.

| Probe | Zweck |
| --- | --- |
| P01 | Erster großer Atlas-/Dungeonedit in der Zielshell; IDs/Prosa, Undo/Autosave/Reopen und sichtbare Queries; keine Pflicht zur Editorreuse |
| P02 | Gemeinsamer lokaler Commit, Status/Crash/Backup/Corruption/Erasure; Record-/Assetclosure und feste Dauerhaftigkeitsgrenze |
| P03 | Passive Sceneprojektion ohne GM-/Mechanik-/Assetleak; getrennte Renderer/Sinkrechte |
| P04 | Geschlossener unabhängiger Campaigntransfer mit Runtime/Trash/Audio/shared Definitions/opaque Payload und vollständigem Remap |
| C01 | Gemeinsame Prozess-/Storegrenze, Crossfeatureablauf und Last-/Fehler-/OS-/A11yqualifikation |

## Migrationsfolge nach Ratifikation

Die technische Richtung benötigt keine erneute allgemeine Architekturfreigabe;
Ratifikation des **Produktcutovers** erfordert belegte Umsetzung:

1. Aktuelle tatsächlich genutzte Formate/Links und Inhalte inventarisieren;
   bytegleiche Originalsicherung und importierbare Goldenfixtures.
2. Neuer Kern/Store/Shell im selben Repository; kleinster Find/Edit/Undo/
   Autosave/Reopen-Weg. Datenübernahme nur ausdrücklich, kein Dualwrite.
3. Atlas-/Katalog-/World-/Plan-/Party-/Scenefähigkeiten anschließen; abhängige
   Reise/Zeit/Loot/Shop/Umwelt-/Autonomiewege nach fachlicher Lieferfolge.
4. Import/Restore/Erase, passive Anzeige und sichere Extensions vollständig
   prüfen. Linux/Windows/macOS früh bauen und am Endbuild direkt installieren.
5. Alten Adapter entfernen, sobald seine erforderlichen Nutzerwirkungen und
   externen Datenbindungen im Ziel qualifiziert sind. Interne Altcodeparität
   ist kein Gate. Vollständiger Scope bleibt Abschlussbedingung.

Der [gemeinsame technische Einstieg](../delivery/roadmap.md#technischer-übergang) führt die konkreten ersten Codeanschlüsse. Die [Atlaspakete](../../atlas/requirements/atlas.md#lieferpakete-und-codeanschlüsse) und übrigen Fachpläne ergänzen ihre jeweiligen Nutzerwirkungen.

Vorhandene `src/features/**`, `src/session.ts`, Atlasrepository und Filejournale
werden hierbei analysiert und bei Bedarf ersetzt, nicht automatisch unter
neuen Namen umwickelt. Sobald eine übernommene Funktion den neuen Kern behindert,
entscheidet der günstigere Gesamtweg zwischen Anpassung und Neuimplementation.

Historische Importzählungen auf `b7e06f0` und alte reine Prototypbefunde
begründen keine Architekturwahl. Ihre datierten Receipts bleiben in
`acceptance.json`, `docs/reference/` und im festen Gitstand
`116c16af48b6a073216685c8d8e2cc74fada82c3` verfügbar.
