# Produktziele

## Für wen und wozu?

Eine Spielleitung soll eine Kampagne als zusammenhängenden lokalen Arbeitsraum benutzen: Welt und Orte erkunden, Städte und Dungeons bearbeiten, Texte und Encounter vorbereiten und daraus einen Spielabend führen. Gespeicherte Daten müssen nach Neustart und Fehlern zuverlässig wieder auffindbar sein. Ein weiterer isolierter Editor oder ein nur theoretisch beschriebener Fachvertrag erfüllt dieses Ziel noch nicht.

Die vollständige [SaltMarcher-Ablösung](../ROADMAP-SALTMARCHER-REPLACEMENT.md) ist der verbindliche Gesamtumfang. Diese Seite fasst die vorhandenen Ziele zusammen; sie ersetzt weder die Fachanforderungen noch deren Abnahme. Der [vollständige Quellenabgleich](SCOPE.md) macht alle erfassten Zielbereiche, zusätzliche Fachabnahmen und noch offene Quellenkollisionen sichtbar. Die Integrationsgates allein beschreiben nicht den gesamten Funktionsumfang.

## Vier Lieferergebnisse

Die [Roadmap](ROADMAP.md#lieferfolge-des-gesamtprodukts) führt E2E-01 bis E2E-04 mit Ablauf, Reihenfolge und Eingängen. Das folgende Portfolio beschreibt den gesamten Zielumfang, einschließlich der zusätzlichen Fachabnahmen.

## Vollständiges Funktionsportfolio

| Zielbereich | Was zusätzlich zum Integrationsablauf fertig werden muss |
| --- | --- |
| Kampagne und Wissen | Gesamter Datenlebenszyklus; Katalog, Regeln, Referenzgraph, Notizsuche, NPCs/Orte/Fraktionen/Quests/Gerüchte und World Planner |
| Party, Planung und Live-Spiel | Vorbereitung ausdrücklich in eine unabhängige LiveSession überführen, ohne Planner-Rückwirkung; Roster/aktuelle/erwartete Party getrennt; Adventuring Day; manuelle Timeline; reproduzierbare Session-/Reward-Generierung; ständig verfügbare Primary/Split Scenes und mehrere Encounter-/Chase-Masken |
| Kampf und Nachbereitung | Encounter Tables, Initiative/HP/Zustände/Undo, Abschluss, XP/Level, Treasures und Charakterlootledger, Handel, kumulativer Lootausgleich und erklärbare Korrekturhistorie |
| Atlas und Kartenwerkzeuge | Vollständige beauftragte Dungeon-/Wonderdraft-Werkzeugfunktion, Welt-/Hexgestaltung, Assets, Ebenen, Licht, Labels, Detailkarten und Ausgabe; ein durchgehend bearbeitbarer Atlas |
| Erweiterter Dungeon | Kontinuierliche 3D-Räume/Höhen, Paths/Passages, Graph-Entwurf, Key-Batchbearbeitung, Attributvererbung, Inhaltsvorlagen, dynamische Beschreibungen, Geheim-/Trap-Features und Dokument-/Paketausgabe; konkrete Zuordnung noch offen |
| Städte | Volle Funktionsergebnisse von Canvas of Kings, Watabou und Fantasy Town Generator, einschließlich Erzeugung, Bewohnern/Beziehungen/Fraktionen/Tagesabläufen; geschützte Regeneration, Innenräume und Ausgabe |
| Reise und Weltzeit | Hex-/Dungeonreise, Unterbrechungen/Tracks/Perception, eigene Scene-Zeiten, Fantasykalender, einmalige gemeinsame Worldfolgen auch bei Retry/Restart und kausales Undo |
| Unterstützende Systeme | Shops/Restock, regionales Wetter/Klima, lokale Musik/Autoplay und geschichtete Ambience mit Vorrang manueller GM-Entscheidungen |
| Actor Autonomy | Ausdrücklich freigegebene NPC-/Monsterbedürfnisse, Jobs/Reservierungen, begrenzte Konflikte, Erklärbarkeit und atomare zeitgebundene Steps; Partygefahr bleibt beim GM |
| Anzeige, Daten und Erweiterung | Sichere passive Spielerprojektion mit getrenntem Wissen/aktueller Sicht; automatische Speicherung/Recovery; komplette unabhängige Im-/Exporte; installierbare Extensions mit begrenzten widerrufbaren Rechten |
| Gesamtqualifikation | Linux/Windows/macOS, Offline/Privacy, selbständige Installation, Lokalisierung/Tastatur/200 %/Kontrast, vollständige versionierte In-game-Tutorials, Latenz/Skalierung, Cancel-/Fehlerisolation und Originalvergleiche |

Quellen, Lieferphasen und verbleibende Zuordnungslücken stehen in [SCOPE.md](SCOPE.md). Insbesondere ersetzen Dungeondraft-Parität und E2E-01 die zusätzlichen Dungeon-Fachanforderungen nicht. [#44](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/44) führt die konkreten offenen Zuordnungen und Zielregeln.

## Verbindliche Qualitätsziele

- Eine gemeinsame Atlasfläche mit einer Kamera, History und Savegrenze verbindet Hex, Orte, Städte und Dungeons. Navigation erfolgt durch Zoom statt erforderlicher Editorwechsel.
- Karten-, Raum- und Abschnittsidentitäten bleiben stabil. Markdown und geschützte Nutzertexte bleiben wortgetreu; fremde oder veraltete Schreibautorität wird gesperrt.
- Lokale Offline-Nutzung, nachvollziehbare Quellen, portable Daten/Assets, automatische Speicherung ohne manuelle Savepflicht und konfliktgeschützte Persistenz gehören zum Produkt. Sinnvolle Laufzustände und bestätigte Fakten bleiben nach vollständigem Neustart erhalten.
- Für alle Atlasvorbilder gilt [Ergebnisgleichwertigkeit](../ROADMAP-HEX-ATLAS.md#wie-kommen-wir-zum-ziel): dieselben fachlichen Ergebnisse erreichen, bearbeiten und speichern. Eigene Werkzeuge/Gesten sind zulässig; vollständiger Funktionsumfang bleibt erhalten. Gleiche Aufgaben und gezielt geklärte Originalwirkungen ersetzen den 1:1-Bediennachbau; Testzahlen beweisen keine Gleichwertigkeit.
- Physische Bedienung, große Karten/Welten, Tastatur, 200-Prozent-Skalierung, Accessibility und die erforderlichen Betriebssysteme benötigen eigene Nachweise.

## Gegenwärtiger Stand und offene Entscheidungen

Dungeonzeichnung, strukturierte Raum-Keys und zahlreiche Speicher-/Hostfälle sind bereits belegt, jeweils innerhalb ihres dokumentierten Scopes. Atlas-/City-/Campaign-Integration liegt teilweise auf Kandidatenbranches. Vollständige E2E-Freigaben, sämtliche Item-/Encounter-/Live-/Reise-/Displayfunktionen sind daraus nicht ableitbar.

Obsidian ist aktuell Arbeits- und Testhost. Obsidian, Desktop oder Hybrid als endgültige Produktlinie bleibt in [Plattform-ADR](../ROADMAP-SALTMARCHER-PLATFORM-ADR.md) offen und hängt an P01–P04 und den notwendigen OS-/Recovery-/Capability-Beweisen. Plattformwahl, Encounter-/Combat-/Loot-Implementierungsbesitz, Travel/Clock/Calendar und PlayerProjection benötigen ausdrücklich bestätigte Entscheidungen beziehungsweise Owner. Ein Bereichsreview besetzt diese Rollen nicht automatisch.

Der erste Lieferfokus ist E2E-01; der vollständige Umfang einschließlich Planner, World Planner, Actor Autonomy, Erweiterungen und Tutorials bleibt in der SaltMarcher-Roadmap erhalten. Lieferreihenfolge und offene Eingänge: [Roadmap](ROADMAP.md).
