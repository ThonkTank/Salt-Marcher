# Darstellung, Suche und Spieleranzeige

Status: Current; offene Ziele sind als solche beschrieben.
Owner: project
Last Reviewed: 2026-10-24 (Struktur und Quellen; Fachabnahme separat)
Source of Truth: Dieses Dokument besitzt das benannte Thema; Code belegt den Iststand, das Abnahmeregister den Prüfstand.

## Darstellung, Suche und Spieleranzeige

Kamera, Werkzeugauswahl und Objektauswahl führen die Atlasdetails getrennt vom Layoutzustand. `AtlasWorkspaceLayout` ordnet bestehende Controls einer festen Befehlsleiste, der linken Symbolleiste, ihrer unabhängig klappbaren Einstellungsleiste und dem optionalen rechten Kontext zu; fachliche Ereignisse und Speichergrenzen bleiben bei ihren bisherigen Eigentümern. Größenänderungen der Kartenfläche erhalten Mittelpunkt und Meter pro CSS-Pixel ohne Ansichtsverlauf. Die Spielleitungssteuerung bleibt außerhalb des Editors. Das Atlas-Menü stellt den vorhandenen `workspace-navigation`-Knoten bereit; dessen ursprüngliche Handler prüfen offene Eingaben und wechseln innerhalb derselben Kampagne. Beim Verlassen des Editors wird der Knoten zurückgestellt. Kampagnenwechsel und Arbeitsbereichswechsel bleiben verschiedene Aktionen. Zoom ändert
Darstellung und Abfragetiefe, keine Autorenwerte und keinen Pflichtmodus.
Der [Darstellungs-, Auswahl- und Ausgabevertrag](../../atlas/architecture/rendering.md)
besitzt Zeichenwege, Quellen-/Framebindung, Raster-/Autorenebene, Budgets,
Fehlerwiederaufnahme und die Trennung von GM-Ausgabe und öffentlicher Freigabe.

Native DOM-Controls tragen Text, Suche, Menüs/Dialoge und Inspector. Der Canvas
hat eine passende zugängliche Objektliste mit denselben Aktionen; Tastatur,
Fokusrückgabe, 200 %, Kontrast und nicht allein farbliche Signale werden mit
jedem Feature gebaut. Lokalisierbare UIlabels und Autorenwortlaut sind getrennt.
Tutorials sind versionierte Capabilityinhalte mit Skip/Dismiss, keine gekoppelte
Geschäftslogik. Such-/Referenzgraphindizes sind rebuildbare Projektionen aller notizfähigen Records. Gewöhnliche Textänderungen aktualisieren den Volltextindex in derselben DBtransaktion; die nächste Suche sieht den neuen Text. Abgeleitete Reference-/Viewcaches werden revisioniert invalidiert. Ein ausgefallener Index darf rebuildbar sein, aber keine stale Ergebnisse als aktuell ausgeben. Volltextindex/SQLpaging zuerst;
keine eigene Suchserverplattform. Mehrdeutige Begriffstreffer bleiben wählbar. Nützlicher Campaignview-/Masken-/Kamerazustand wird gesondert checkpointed und wieder aufgenommen; Hover, Pointercapture und offene Popups sind flüchtig und gehören nicht in Autorenhistory.

Passive Anzeige erhält im privilegierten Prozess erzeugte Allowlist-DTOs und
ausschließlich freigegebene Assetbytes. Kein CSSverstecken von GMtexten im
gleichen Datenmodell. Liveanzeige folgt fokussierter Scene und Knowledgeunion
der dortigen Charaktere, trennt Wissen von aktueller Perception und enthält
keine Mechanik/GMprosa. Statischer Spielerexport verwendet ein ausdrücklich
gewähltes Veröffentlichungsprofil und ist kein Live-Knowledgesnapshot.
Leakprüfung umfasst DTO, IPC, Assets, DOM, Fehler, Protokolle und Neustart.

### Kippbare Geländeansicht

[Gemeinsame Daten, Draufsicht und Geländeprojektion](../../atlas/architecture/rendering.md#geometrie-material-und-auswahl)
benennen Besitzer und Grenzen. Die [Relief-Roadmap](../../atlas/requirements/terrain-relief.md)
besitzt Fachlieferungen und R7-Abnahme.

### Atlasoberfläche ändern

Die [Atlas-Zuständigkeiten](../../atlas/architecture/rendering.md#zuständigkeiten-und-datenfluss)
trennen Bereichsladen, Autorenaktionen, Zeichnung, Reisen und Ausgabe sowie
Pinsel, Trassen und Landschaftsinspector. `CampaignAtlasWorkbench` und
`LandscapeWorkbench` verbinden diese Besitzer mit der vorhandenen Oberfläche;
die externen Einstiegsmethoden und die kanonische Speichergrenze bleiben erhalten.

| Änderung | Zuständiger Einstieg |
| --- | --- |
| Bereiche, Gruppen und Werkzeugrouten | [atlas-tool-catalog.ts](../../../src/app/atlas/atlas-tool-catalog.ts) ordnet vorhandene Controls und Operationswerte zu. Die globale Auswahl verwendet im Dungeon das bestehende Zeichen-Auswahlwerkzeug, damit Raum- und Pfadgriffe erreichbar bleiben. Nicht verfügbare Werkzeuge und leere Gruppen bleiben ausgeblendet. |
| Leisten, umgehängte Controls, Kontextpanel | [AtlasWorkspaceLayout](../../../src/app/atlas/atlas-workspace-layout.ts); Originalcontrols mit ihren Handlern verschieben, nicht kopieren. |
| Breiten, Anordnung, responsive Darstellung | [atlas-workspace.css](../../../src/app/atlas/atlas-workspace.css); [app.css](../../../src/app/workspace/app.css) importiert sie nach den Atlas-Fachregeln. Der [Desktopbuild](../../../tools/build-desktop.mjs) bündelt den lokalen CSS-Einstieg. |
| Werkzeug-/Navigationswechsel und offene Eingaben | [CampaignAtlasWorkbench](../../../src/app/atlas/campaign-atlas-ui.ts): `new AtlasWorkspaceLayout` verbindet `prepare`/`tool`/`navigation` mit Flush und `setFamily`. Layout ruft diese Fachgrenze auf; Operationswerte ändern sich erst nach erfolgreicher Entwurfsprüfung. |
| Kartenfläche nach Paneländerung | [AtlasCanvas.resizeViewport](../../../src/app/atlas/atlas-canvas.ts) erhält Weltmittelpunkt und Meter pro CSS-Pixel ohne Historyeintrag. |

Prüfweg: [Gruppen- und Werkzeugregressionen (historisch)](https://github.com/ThonkTank/Salt-Marcher/blob/05e8f2f97fc729dba8b6fef3830c566cdc47adad/tests/atlas/desktop-atlas-tool-hierarchy.test.mjs) für Vollständigkeit, Gruppen-/Werkzeugspeicher, abgelehnte und überlappende Wechsel; [Kameraregressionen (historisch)](https://github.com/ThonkTank/Salt-Marcher/blob/05e8f2f97fc729dba8b6fef3830c566cdc47adad/tests/atlas/desktop-atlas-canvas.test.mjs) für Größenwechsel;
[Layoutprobe](../../../tools/test-desktop-atlas-layout.mjs) für den nativen Editorablauf
mit synthetischem Profil, Close und frischem Öffnen. Letztere nach
`npm run desktop:runtime` und `npm run build:desktop` mit
`node tools/test-desktop-atlas-layout.mjs` starten. Ein Lauf belegt seine
geprüften Fälle; Bedienqualität und Produktabnahme bleiben gesondert.

## Erweiterungen, externe Anbindungen und Auslieferung

Interne Fachmodule sind normale versionierte Komponenten. Neue Content-/Masken-
oder Generatorarten registrieren explizite Typen und Applicationactions; kein
universeller Metaeditor. Drittanbieter laufen in einem eigenen sandboxed Electron-Renderer mit deaktiviertem NodeIntegration, isolierter Session, ohne GMassets und ohne direkten Datei-/Netz-/IPCzugang. Navigation, neue Fenster und direkte Resource-/Netzanfragen werden gesperrt; Zugriff erfolgt ausschließlich über den geprüften Broker. Ein gewöhnlicher Nodeworker/Subprozess ist **keine** Schutzgrenze für untrusted Erweiterungscode. Kein `eval` im GM- oder privilegierten Prozess. Ein versioniertes Manifest deklariert angeforderte
Campaign-, Datei-, Netz- und Präsentationsrechte. Default-Deny; Zustimmung und
Widerruf werden an **jedem privilegierten Sink** geprüft, auch bei bereits
laufendem Job. Prozesslimits/Timeout und Disable isolieren Fehler.
Install/Remove/Update kann Campaigns nicht unlesbar machen.

Unbekannte Capabilitypayloads bleiben opaque und hashgebunden. Core versteht
ihr versioniertes Besitz-/Identitäts-/Referenzenvelope, nicht ihre Semantik.
Alle campaignlokalen Identitäten und Verweise gehören in die vom Core verstandenen Slots; der opaque semantische Body referenziert diese Slots und darf keine versteckten kanonischen Campaign-IDs besitzen. Damit sind Copy, Transfer, Restore, Trash und Erasure ohne laufenden Provider möglich. Fehlt eine vollständige Remapclosure, wird unabhängiger Complete-Import
blockiert; disclosed Salvage ist eine andere ausdrückliche Aktion. Unbekannte
**Core**schemafelder werden nicht durch einen losen JSONparser weggeschrieben.
Rechte/Context-/Erasuretokens sind lokale Autorität und werden beim Import
nicht als ausführbare Sourceberechtigung übernommen.

Core funktioniert offline; keine versteckte Telemetrie und kein implizites
Nachladen. Bestehende Markdownlinks behalten Wortlaut und einen expliziten Source-Namespace-/IDresolver; externe Dateibearbeitung wird als geprüfter Importvergleich übernommen, nicht als stiller Dualwrite. Explizite Netzwerkimporte/Downloads laufen über den privilegierten
Dienst mit Quell-/Lizenzbeleg, begrenztem Staging, Cancellation und Validierung.
Untrusted SVG, Pakete und Medien werden mit begrenzten isolierten Parsern
verarbeitet. Customsymbols erfüllen den bestätigten Ein-Pfad-Vertrag; das
frühere pauschale „kein SVGimport“ gilt nicht für diesen expliziten Featureumfang.

Electron verwendet getrennte GM-/Spielerrenderer mit Sandbox,
ContextIsolation, ausgeschaltetem NodeIntegration, enger Preload-API,
Sender-/Payloadprüfung und einer CSP ohne beliebige Remoteausführung.
[Offizielle Sicherheitsgrundlage](https://www.electronjs.org/docs/latest/tutorial/security).
Kein ungefilterter Shell-, Datei-, DB- oder beliebiger IPCport.
Linux/Windows/macOS erhalten reproduzierbare selbständige Pakete und Smoke-
Nachweise. Updates prüfen Herkunft, sichern/migrieren eine Kopie der Daten und
aktivieren die neue Version erst nach Prüfung; Rollback verwendet einen
kompatiblen gesicherten Store, keinen rückwärts beschriebenen neuen Schemafund.
Packagingbibliothek und OSspezifische Signierung werden beim ersten lieferbaren
Shellpaket konkret festgelegt; OSnachweise dürfen nicht ans Ende verschoben werden.

## Übergang und Lieferung

1. **Work – Daten und erster Nutzerweg:** Bekannte aktuelle Nutzerformate und
   Verlinkungen inventarisieren; Originale sichern und rein lesende Adapter
   bauen. Neuer kleiner Kern/Store/Shell im selben Produktrepository. Ein
   expliziter Import erzeugt einen geprüften unabhängigen Zielstand; kein
   Dualwrite und keine automatische Überschreibung von Vaultdateien.
   Ort/Raum finden → Geometrie/Key ändern → Undo → automatische Speicherung →
   frischer Prozess ist der erste vollständige Pfad.
2. **Work – Fähigkeitsweise anschließen:** Atlas Work 2/3/4, manuelle World-
   und Planung, Katalog/Party/Scenes, dann die tatsächlich abhängigen Runtime-
   consumer. Reine geeignete Algorithmen/Artefakte selektiv übernehmen; zustands-
   und dateigebundene Editor-/History-/Repositoryteile ersetzen. Die
   [Gesamtroadmap](../delivery/roadmap.md) führt alle SMR-Folgen, keine neue Parallelroadmap.
3. **Efficient:** Gemessene Engpässe in lokalem Commit, Query, Render, Worker-
   Scheduling und wiederholter Bedienung gezielt verbessern. Unbelegte
   Spezialindizes, GPUeffekte und allgemeine Frameworks kommen nicht vorher.
4. **Beautiful / Cutover:** Lesbarkeit und Karten-/Ausgabegestaltung verfeinern;
   frühere Nutzbarkeit/A11y bleibt Pflicht. Den alten Host erst ablösen, wenn
   seine tatsächlich benötigten Nutzerabläufe, Daten und Formatbindungen im
   Zielprodukt qualifiziert sind. Keine Pflicht, seine internen APIs oder
   Testarchitektur mitzunehmen. Übergangsdauer richtet sich nach belegter
   Fähigkeit; es entstehen keine zwei fortzuführenden Produkte.

## Vollständigkeitsprüfung und spätere Details

| Bedarf | Technische Entscheidung / zuständige Detailquelle |
| --- | --- |
| TN-01–06 | Typisierte IDs, Ownership/Lifecycle, Definition vs. historische Fakten, geschlossene Erasure/Transfer; Campaignfachplan |
| TN-07–14 | Atomare Commands, getrennte Scenezeiten, kausale Checkpoints und GM-Overrides; Scene/Campaign-/CE-Fachpläne |
| TN-15–19 | Ein Writer, SQLitecommit/Receipt, Backup, Payloadisolation, vollständiger Transfer; P02/P04 |
| TN-20–23 | Records/Chunks, sichtbare Abfragen, Priorität/Cancel und getrennte Lastprofile; Runtimeplan/P01/C01 |
| TN-24–26 | Gemeinsame räumliche Fakten, Allowlistanzeige, versioniertes Wetter und portable Medien; SMR-04/08/10 |
| TN-27–30 | Versionierte interne Module, isolierte Extensions, retained Envelopes, Sinkrechte und OSbuilds; P03/P04/SMR-10/11 |
| TN-31–32 | Lokalisierbare native Controls, Objektliste, Fokus und A11y je vertikalem Pfad; Feature-/GM-Abnahmen |
| TN-33–38 | D&D-2014-Goldens, explizite Initialize/XP-Hinweise, umfassende Notizsuche, genaue Tabellengewichte und Tutorialversionen; CE/Scene/SMR-11 |

Konkrete SQLspalten, Payloadcodecversionen, Chunkkanten, Navheuristik, Wetter-
parameter, Rendereroptimierung und Signierungswerkzeuge werden beim jeweiligen
ersten Nutzerweg entschieden und gemessen. Besitz, Einheit, atomare Wirkung,
Identität, Rechte und Remapsemantik sind bereits hier entschieden; diese
Details sind keine Ausrede für einen offenen Grundvertrag.

Am 11.10.2026 erfolgten nach dem Entwurf eine erneute vollständige Quellen-/
Fachplanprüfung und Gegenproben über Atlasbearbeitung, House-/Room-Lifecycle,
Split-Reise-Weltfolgen, Party-/Combat-/Shopabschluss, Definitionlöschung,
Transfer/Erasure, unavailable Extensions und Anzeigeprivacy. Konkrete Orakel und
Grenzen stehen im [Prototypplan](../verification/architecture-experiments.md).
Unbekannte Original-Unteroptionen und reale OS-/Power-Loss-/RP-L-Produktbeweise
bleiben dort benannte Liefernachweise, keine behaupteten Ergebnisse dieser
Planungsarbeit. Frühere Architektur-/Codemessungen sind im Gitstand
`116c16af48b6a073216685c8d8e2cc74fada82c3:ARCHITECTURE.md` historisch verfügbar;
sie besitzen keinen eigenständigen normativen Vorrang.

## Signierte Linux-Updates (19.10.2026)

Der [Updatepfad](../delivery/github-updates.md) verwendet den bestehenden
Linux-Ordnerbuild, unveränderliche Versionsordner und einen atomaren `current`-Link.
Main besitzt den GitHub-Zugriff; der gebündelte Helfer besitzt Installation,
Profilsicherung und Recovery unter Kernel-Sperren. Ed25519 bindet Produktlinie,
Releaseversion, Commit, Plattform, Archiv und Dateiverzeichnis. Datenmigrationen
werden vor Aktivierung mit dem neuen Store auf einer vollständigen Profilkopie
geprüft. Der neue Prozess bleibt bis zur dauerhaften Erststartfreigabe unsichtbar;
nach dieser Freigabe gibt es kein automatisches Datenrollback. Der bisherige
Kampagnenarchivvertrag und der Datenordner CampaignWorkbench bleiben bestehen.


## Styles einer Oberfläche ändern

[app.css](../../../src/app/workspace/app.css) ist ausschließlich der explizite
CSS-Einstieg. [base.css](../../../src/app/shared/base.css) besitzt Schrift und
Farben, [controls.css](../../../src/app/shared/controls.css) gemeinsam verwendete
Controls. Shell und Navigation liegen in
[workspace.css](../../../src/app/workspace/workspace.css). Fachregeln stehen bei
ihren Oberflächen: etwa [Katalog](../../../src/app/catalog/catalog.css),
[NSCs](../../../src/app/campaign/npc.css), [Kampf](../../../src/app/runtime/combat.css),
[Musik](../../../src/app/runtime/music.css) und [Reise](../../../src/app/runtime/world.css).
Die übrigen Besitzer sind in der Importliste sichtbar. Gruppen von Selektoren
verschiedener Besitzer stehen getrennt in deren Dateien; gemeinsam benutzte
Controls bleiben in `shared/controls.css`.

Neue Fachregeln werden beim vorhandenen Element einschließlich seiner Zustände
und Breitenbedingungen gepflegt. Keine Nachtragsdatei für globale Overrides.
Die normalen Browserregeln für Spezifität, Bedingungen und Quellreihenfolge
bleiben wirksam; die Aufteilung führt keine Cascade Layers ein. Bestehende
Key-, Markdown- und Atlas-Workspace-Regeln behalten ihre abschließende
Importposition. `player.css` und das separat geladene Preset-Stylesheet behalten
ihre eigenen Einstiege.

[desktop-styles.mjs](../../../tools/desktop-styles.mjs) bündelt mit esbuild alle
lokalen Imports in die weiterhin ausgelieferte `ui/app.css`. Der
[Buildtest](../../../tests/shared/desktop-styles.test.mjs) prüft die vollständige
lokale Ausgabe. Die [Reise-DOM-Probe (historisch)](https://github.com/ThonkTank/Salt-Marcher/blob/05e8f2f97fc729dba8b6fef3830c566cdc47adad/tests/runtime/desktop-travel-target-dom.test.mjs)
konsumiert dieselbe Zusammensetzung und schützt weiterhin vor Atlas-Hideregeln
auf der Live-Reisekarte.

Bei einer Kaskadenänderung vor dem Umbau die bisher ausgelieferte `ui/app.css`
außerhalb des Desktop-Buildordners sichern. Nach dem Build vergleicht
`npm run verify:local -- python3 tools/ui-session.py node tools/test-desktop-style-ownership.mjs --baseline-css PFAD`
diese Datei im echten Electronfenster mit der neuen Ausgabe. Die
[Vergleichsprobe](../../../tools/test-desktop-style-ownership.mjs) verwendet
synthetische Kampagnendaten und prüft berechnete Styles sowie Geometrie der
vorhandenen Oberflächen bei breitem und schmalem Fenster sowie 200 Prozent Zoom;
sie speichert Vorher-/Nachher-Aufnahmen und verlangt normales Prozessende.
Das ist eine begrenzte Layoutregression, keine vollständige Produkt- oder
menschliche Bedienabnahme. Fachliche Abläufe behalten ihre eigenen nativen Proben.
