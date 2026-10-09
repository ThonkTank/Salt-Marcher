# CE-02-I02-P01 – Itemkatalog: Provenienz, Datenvertrag und Umsetzung

Stand: 9. Oktober 2026

Art: Fachplan für Items; keine Item-Implementierung und keine CE-02-Freigabe

## Ziel und Grenze

`Items` wird der erste echte Bereich nach `Monster` in der vorhandenen
siebenfachen Katalog-Shell. Er liefert einen lokalen, nur lesbaren
2014-Referenzkatalog für Ausrüstung und magische Gegenstände. Maßgeblich sind
`ROADMAP-SALTMARCHER-CE02-PLAN.md` und SaltMarchers
`docs/items/requirements/requirements-items-catalog.md` sowie
`docs/items/domain/domain-items.md` am gepinnten SaltMarcher-Commit
`9de85c1a26f526acbc1af332ac5962e185c0aab2`. SaltMarchers
SQLite-/HTTP-Importvertrag beschreibt das beobachtbare Verhalten, erzwingt aber
keine SQLite- oder Laufzeit-Importarchitektur für dieses Plugin. Der Loot-Index
ist keine Item-Detailquelle.

## Gepinnte Quelle und Freigabe vor Datenübernahme

Die normative Inhaltsquelle ist Wizards of the Coast, *System Reference
Document 5.1*, die 2014er Fassung unter
<https://media.wizards.com/2023/downloads/dnd/SRD_CC_v5.1.pdf>. Der am
9. Oktober 2026 abgerufene PDF-Byte-Hash ist
`2504d2a0abb0a4d491a939be4f17910a2dde0312570ab8d208080225ccf0a1f0`
(SHA-256; 3.158.713 Bytes, 403 PDF-Seiten). Seite 1 nennt CC BY 4.0 und den
verlangten Attributionstext. Der sichtbare Inspector und die ausgelieferte
Attributionsdatei führen Dokument, Herausgeber, URL, Lizenzlink, Version und
Bearbeitung der Projektion. Keine 2024-/SRD-5.2-Daten.

Vor dem ersten Datencommit prüft ein eigener Provenienz-/Schema-Review am
exakten Quellenhash, welche SRD-Tabellen und alphabetischen Magic-Item-Einträge
zum Korpus gehören. Er legt eine überprüfbare Inventarliste samt PDF-Seiten und
Eintragszahlen fest. Ein 5e-bits-Datensatz darf als Extraktionshilfe dienen,
aber nicht ungeprüft zur zweiten Wahrheit werden: jede übernommene Tatsache
muss im SRD 5.1 verortbar sein. Nicht belegte oder außerhalb der SRD liegende
Einträge werden abgewiesen. Die 5e-bits-MIT-Lizenz für Repository-Code ersetzt
keine Prüfung der Inhaltslizenz.

## Quellprojektion und Schema

Ein eingechecktes, reviewtes Quelltranskript enthält pro Eintrag den stabilen
Quellenschlüssel, die PDF-Seite(n) und die quellennahen Fakten. Der Schlüssel
verwendet einen fest dokumentierten Namensraum für `equipment` bzw.
`magic-item` und einen stabilen SRD-Eintragsschlüssel. Gleichnamige Einträge
werden nicht allein nach Anzeigenamen zusammengeführt. Tabelleneinträge mit
eigener Beschreibung und alphabetische Detailabschnitte werden anhand derselben
Quellenidentität zu genau einem Datensatz verbunden; Konflikte stoppen den
Generator. Ein abweichender SRD-Quellenstand erfordert neues Manifest und
eigenen Review, keine stillschweigende Aktualisierung.

Der versionierte Item-Datensatz enthält mindestens:

- `id`, `name`, `category`, optionale `subcategory`, `magic` und optionale
  `rarity` sowie `attunement` als explizit belegte Werte;
- optionale `cost` mit Quellwert und normalisierter 2014-Währung für
  numerische Filter/Sortierung, optionales `weight` mit Einheit;
- `properties` und `description` als quelltreue, darstellbare Fakten;
- optionale strukturierte `damage`- bzw. `armor`-Fakten, soweit die Quelle
  sie für genau diesen Gegenstand nennt;
- `source` mit SRD-Version, Dokument-URL und PDF-Seiten.

Fehlende Quellenfelder bleiben `null`/abwesend. Insbesondere werden für magische
Gegenstände keine Preise, Gewichte oder Einstimmungen aus anderen Quellen
erfunden. `attunement` unterscheidet `required`, `not-required` und
`unspecified`; nur explizite Quellenangaben setzen einen der ersten beiden
Werte. Geldwerte werden ohne Rundung als ganzzahlige kleinste Einheit
normalisiert; nicht eindeutig umrechenbare Quellwerte bleiben reine Anzeige
und nehmen am numerischen Kostenfilter nicht teil. Sortierung behandelt fehlende
Werte deterministisch am Ende, unabhängig von der Richtung. Der Inspector
kennzeichnet fehlende Fakten, statt sie mit Nullwerten zu verwechseln.

## Reproduzierbarer Build und Fail-closed-Lader

Ein enger Generator unter `tools/` liest ausschließlich das reviewte
Quelltranskript und ein Manifest mit PDF-URL, PDF-SHA-256, Korpusinventar,
Schema-Version, Lizenz und Attribution. Er benötigt keinen Netzwerkzugriff.
Der Build prüft den PDF-Hash gegen den lokal angegebenen Quellenpfad, validiert
alle Datensätze, Quellseiten, eindeutigen Schlüssel und die vollständige
Inventarliste, serialisiert in fester Ordnung und schreibt ein generiertes
Artefakt samt SHA-256. Wiederholung mit denselben Eingaben muss bytegleich
sein. CI/Build vergleicht generierte Bytes und Manifest mit den eingecheckten
Dateien. Quell-PDF und große Laufprotokolle liegen im QA-Cache, nicht im Vault.

Der Runtime-Lader prüft Schema-Version, Manifest/Artefakt-Hash und Struktur vor
der ersten Veröffentlichung des gesamten Korpus. Die Daten werden erst nach
vollständiger Prüfung als ein unveränderlicher Snapshot sichtbar. Fehler geben
keine Teilmenge oder veraltete Detailantwort als aktuelle Wahrheit aus:

- fehlendes Asset bzw. noch kein vollständiger Import: `unavailable`;
- neuere/andere Schema-Version: `incompatible`;
- Hashabweichung, ungültiger Datensatz, Duplikat oder fehlendes Detail:
  `corrupt`;
- ungültige Filter-/Pagingwerte: `invalid-query`;
- Laufzeit-/Ladefehler: `error` mit isoliertem Retry.

Diese Fehler betreffen nur `items`. `creatures` und die fünf weiterhin
`unavailable`-Provider behalten ihren Zustand. Kein Katalogklick startet
Netzwerk, Import, Vaultwrite, Loot-, Inventory- oder Encounter-Mutation.

## Provider und sichtbares Verhalten

Der Itemprovider implementiert den vorhandenen CE-02-read-only-Vertrag mit
immutable Row-/Detail-DTOs, begrenzter Ergebnispage und `AbortSignal`.
Stabile IDs werden auch in Auswahl und Wiederherstellung genutzt. Query und
Detail verwenden denselben geprüften Snapshot. Generations-/Abortschutz der
Shell verhindert, dass verspätete Itemantworten nach Suche oder Bereichswechsel
einen anderen Bereich überschreiben.

Die Items-Oberfläche nutzt den gemeinsamen 200-ms-Draft-/Enter-Flush-,
Chip-/Reset-, Sortier-, Paging-, Tastatur- und Inspector-Pfad. Filter sind Name,
Kategorie, Unterkategorie, Rarität, Magiestatus, Einstimmung und Kostenbereich;
Sortierung ist Name, Kategorie, Rarität und Kosten, jeweils mit stabiler
ID-Nachordnung. Rarität und Kosten zeigen fehlende Werte offen an; der
Kostenbereich matcht nur tatsächlich bezifferte Kosten. Auswahl zeigt
Beschreibung, Eigenschaften, Kosten, Gewicht, Rarität, Einstimmung,
Schadens-/Rüstungsfakten soweit vorhanden, Quellenstellen und Attribution.
Es gibt explizite Loading-, Empty-, Invalid-, Unavailable-, Incompatible-,
Corrupt- und Error-/Retry-Ansichten, ohne verdeckte Produkt-Placeholder.

Der Itembereich erhält eigenen persistierten Draft/angewandte Suche, Filter,
Sortierung, Page, Auswahl und Ergebnis-/Inspector-Scrollposition. Eine
beschädigte Item-State-Payload normalisiert nur diesen Bereich; ein
inkompatibles künftiges Workspace-Schema bleibt insgesamt fail-closed gemäß
CE-02-I01. Der Wechsel zu Monster und zurück bewahrt den vorherigen
Monsterzustand und den Itemzustand unabhängig.

## Besitz, Läufe und Prüfgates

`CE-02-I02-I01` besitzt neue Itemdaten-, Generator-, Manifest-, Attributions-,
Provider- und Item-View-Dateien unter `src/features/catalog/` und `tools/`,
gezielte Item-Deskriptor-/State-Ergänzungen in der bestehenden Katalog-Shell,
passende Tests und nur nötige Katalog-CSS. Monsterdaten, die fünf anderen
Provider, Encounter-/World-Planner-Owner, Atlas, Dungeon und Vaulttexte bleiben
außerhalb dieses Pakets. Ein verändertes Bundlebudget wird nur anhand gemessener
Buildgröße, Lazy-Load und echtem Hostverhalten entschieden.

Nach diesem Plan folgt ein unabhängiger `CE-02-I02-P01-R01`-Review. Erst nach
bestandenem Planreview folgen getrennt Umsetzung `CE-02-I02-I01`, unabhängiger
Code-/Datenreview und gegebenenfalls Reparatur mit erneuter Prüfung. Die
Umsetzung führt `npm run check`, `npm test`, `npm run build` und gezielte
Generator-/Provider-/DOM-Tests aus. Pflichtfälle sind: Source-Hash und
Attribution; Korpusvollständigkeit und bytegleiche Regeneration; doppelte
Schlüssel und widersprüchliche Feldquellen; fehlende optionale Werte;
deterministische Filter/Sortierung/Paging; Auswahl und Inspector; sämtliche
Fehlerzustände und Retry; Abort-/Stale-Antwort; Bereichs-/Neustartzustand;
kein Netzwerk oder Ownerwrite beim Browsing. Ein realer isolierter
Obsidian-Hostlauf mit frischem Prozess, sichtbarer Itemliste und Detail gehört
zum I02-Review und später zusätzlich zu CE-02-H01.

Eine Itemfreigabe schließt weder die fünf anderen Provider noch CE-02, CE-01-
Physikeingabe, Screenreader oder weitere Plattformen. Diese Gates bleiben
ausdrücklich offen.
