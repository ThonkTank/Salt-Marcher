# Produktziele

Status: Verbindlicher Zielumfang; historische Umsetzungsbelege sind keine aktuelle Abnahme.
Owner: project
Last Reviewed: 2026-10-28 (Dokumentrollen und offene Ziele; Fachabnahme separat)
Source of Truth: Dieses Dokument besitzt das benannte Thema; Code belegt den Iststand, das Abnahmeregister den Prüfstand.

## Für wen und wozu?

Eine Spielleitung soll eine Kampagne als zusammenhängenden lokalen Arbeitsraum benutzen: Welt und Orte erkunden, Städte und Dungeons bearbeiten, Texte und Encounter vorbereiten und daraus einen Spielabend führen. Gespeicherte Daten müssen nach Neustart und Fehlern zuverlässig wieder auffindbar sein. Ein weiterer isolierter Editor oder ein nur theoretisch beschriebener Fachvertrag erfüllt dieses Ziel noch nicht.

Anforderungen beschreiben konkrete Fähigkeiten und Nutzungsergebnisse. Dropdowns, Popups, Dialoge und andere Oberflächenformen sind austauschbare Umsetzungsmittel; sie begründen keine eigenständigen Produktanforderungen.

Die vollständige [SaltMarcher-Ablösung](product-scope.md) ist der verbindliche Gesamtumfang. Diese Seite fasst die vorhandenen Ziele zusammen; sie ersetzt weder die Fachanforderungen noch deren Abnahme. Der [vollständige Quellenabgleich](scope.md) macht alle erfassten Zielbereiche, zusätzliche Fachabnahmen und begründete Quellenkonfliktentscheidungen sichtbar. Die Integrationsgates allein beschreiben nicht den gesamten Funktionsumfang.

## Vollständiges Funktionsportfolio

| Zielbereich | Was zusätzlich zum Integrationsablauf fertig werden muss |
| --- | --- |
| Kampagne und Wissen | Gesamter Datenlebenszyklus; Katalog, Regeln, Referenzgraph, Notizsuche, NPCs/Orte/Fraktionen/Quests/Gerüchte und World Planner |
| Party, Planung und Live-Spiel | Vorbereitung ausdrücklich in eine unabhängige LiveSession überführen, ohne Planner-Rückwirkung; Roster/aktuelle/erwartete Party getrennt; Adventuring Day; manuelle Timeline; reproduzierbare Session-/Reward-Generierung; ständig verfügbare Primary/Split Scenes und mehrere Encounter-/Chase-Masken |
| Kampf und Nachbereitung | Encounter Tables, Initiative/HP/Zustände/Undo, Abschluss, XP/Level, Treasures und Charakterlootledger, Handel, kumulativer Lootausgleich und erklärbare Korrekturhistorie sowie eine [filterbare Kampagnenchronik](../../campaign/contract/chronicle.md) mit Kämpfen, Questresultaten, Reisen, besuchten Orten, Belohnungen und Markdown-Ausgabe |
| Atlas und Kartenwerkzeuge | Vollständige beauftragte Dungeon-/Wonderdraft-Werkzeugfunktion, Welt-/Hexgestaltung, Assets, Ebenen, Licht, Labels, Detailkarten und Ausgabe; ein durchgehend bearbeitbarer Atlas |
| Erweiterter Dungeon | Kontinuierliche 3D-Räume/Höhen, Paths/Passages, Graph-Entwurf, Key-Batchbearbeitung, Attributvererbung, Inhaltsvorlagen, dynamische Beschreibungen, Geheim-/Trap-Features und Dokument-/Paketausgabe; [konkrete Atlasaktionen](../../atlas/requirements/atlas-2.md#aktionen-am-ausgewählten-objekt), technische Wertsemantik im [Runtimeplan](../../atlas/contract/spatial-runtime.md), heutiger Teilstand und Restqualifikation bei der [Dungeoncoverage](../../dungeon/requirements/smr04-spatial-coverage.md#stand-und-offene-fähigkeiten) |
| Städte | Volle Funktionsergebnisse von Canvas of Kings, Watabou und Fantasy Town Generator, einschließlich Erzeugung, Bewohnern/Beziehungen/Fraktionen/Tagesabläufen; geschützte Regeneration, Innenräume und Ausgabe |
| Reise und Weltzeit | Hex-/Dungeonreise, Unterbrechungen/Tracks/Perception, eigene Scene-Zeiten, Fantasykalender, einmalige gemeinsame Worldfolgen auch bei Retry/Restart und kausales Undo |
| Unterstützende Systeme | Shops/Restock, regionales Wetter/Klima, lokale Musik/Autoplay und geschichtete Ambience mit Vorrang manueller GM-Entscheidungen |
| Actor Autonomy | Ausdrücklich freigegebene NPC-/Monsterbedürfnisse, Jobs/Reservierungen, begrenzte Konflikte, Erklärbarkeit und atomare zeitgebundene Steps; Partygefahr bleibt beim GM |
| Anzeige, Daten und Erweiterung | Sichere passive Spielerprojektion mit getrenntem Wissen/aktueller Sicht; automatische Speicherung/Recovery; komplette unabhängige Im-/Exporte; installierbare Extensions mit begrenzten widerrufbaren Rechten [Isolation von Kampagnenexport und lokaler Extensioninstallation](../../campaign/contract/scoped-export.md). |
| Gesamtqualifikation | Linux/Windows/macOS, Offline/Privacy, selbständige Installation, Lokalisierung/Tastatur/100 %/Kontrast, vollständige versionierte In-game-Tutorials, Latenz/Skalierung, Cancel-/Fehlerisolation und Originalvergleiche |

Quellen, Lieferphasen und verbleibende Zuordnungslücken stehen in [SCOPE.md](scope.md). Insbesondere ersetzen Dungeondraft-Parität und E2E-01 die zusätzlichen Dungeon-Fachanforderungen nicht. [#44](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/44) führt die konkreten offenen Zuordnungen und Zielregeln.

## Verbindliche Qualitätsziele

- Die Atlasentwicklung folgt [Make it Work → Make it Efficient → Make it Beautiful unter durchgehendem KISS](../../atlas/requirements/atlas.md#wie-kommen-wir-zum-ziel); dort stehen die einzige Gesamtpriorisierung und Werkzeugzuordnung.
- Eine gemeinsame Atlasfläche mit einer Kamera, History und Savegrenze verbindet Hex, Orte, Städte und Dungeons. Navigation erfolgt durch Zoom statt erforderlicher Editorwechsel.
- Karten-, Raum- und Abschnittsidentitäten bleiben stabil. Markdown und geschützte Nutzertexte bleiben wortgetreu; fremde oder veraltete Schreibautorität wird gesperrt.
- Lokale Offline-Nutzung, nachvollziehbare Quellen, portable Daten/Assets, automatische Speicherung ohne manuelle Savepflicht und konfliktgeschützte Persistenz gehören zum Produkt. Sinnvolle Laufzustände und bestätigte Fakten bleiben nach vollständigem Neustart erhalten.
- Für alle Atlasvorbilder gilt [Ergebnisgleichwertigkeit](../../atlas/requirements/atlas.md#wie-kommen-wir-zum-ziel): dieselben fachlichen Ergebnisse erreichen, bearbeiten und speichern. Eigene Werkzeuge/Gesten sind zulässig; vollständiger Funktionsumfang bleibt erhalten. Gleiche Aufgaben und gezielt geklärte Originalwirkungen ersetzen den 1:1-Bediennachbau; Testzahlen beweisen keine Gleichwertigkeit.
- Physische Bedienung, große Karten/Welten, Tastatur, 100 %-Skalierung, Accessibility und die erforderlichen Betriebssysteme benötigen eigene Nachweise.

## Gegenwärtiger Stand und offene Entscheidungen

Den heutigen Host, die implementierten Fähigkeiten und ihre nächsten Lieferanschlüsse besitzt die [Roadmap](../delivery/roadmap.md#vorhandene-umsetzung-und-nächste-anschlüsse). Technische Regeln und Codebesitzer stehen in der [Architektur](../architecture/overview.md); automatisierte und native Belege mit ihren Grenzen in der [Prüfdokumentation](../verification/end-to-end.md). Diese Produktziele erklären keine Gesamtfreigabe.

Fachliche Entscheidungen bleiben unter anderem für die noch nicht inventarisierten Originalfunktionen von Wonderdraft und den Stadtvorbildern offen. Verteilungen für neue Bewohner, Religion, Lebensstandard, Regierung/Wachen und weitere FTG-Felder werden am [CITY-06-Anforderungsbesitzer](scope.md#ftg-lebensdaten-zuordnung) geklärt; vorhandene Stadt-/World-Anschlüsse und ihre Grenzen stehen im [Stadtvertrag](../../city/contract/city.md#lebensdaten-in-der-bestehenden-lieferfolge) und bei den [NPC-Dossiers](../../campaign/contract/npc-dossiers.md). OS-, Zielgeräte- und Ownerabnahmen bleiben getrennte Lieferpflichten.

Der erste Lieferfokus ist E2E-01; der vollständige Umfang einschließlich Planner, World Planner, Actor Autonomy, Erweiterungen und Tutorials bleibt verbindlich. Die [Übergabeübersicht](../delivery/roadmap.md#vorhandene-umsetzung-und-nächste-anschlüsse) trennt vorhandene Umsetzung, begrenzte Prüfbelege und offene Lieferungen. Der [nächste gemeinsame Abschluss](../delivery/roadmap.md#kritischer-pfad-für-e2e-01) verbindet die vorhandenen Atlas-, Speicher- und Importanschlüsse auf demselben Produktstand; eine vollständige E2E- oder Ownerabnahme wird daraus nicht abgeleitet.
