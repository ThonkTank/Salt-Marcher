# Roadmap: Dungeondraft-Verhalten für Grundrisse und Objekte angleichen

Status: Verbindlicher Zielumfang; historische Umsetzungsbelege sind keine aktuelle Abnahme.
Owner: dungeon
Last Reviewed: 2026-10-24 (Struktur und Quellen; Fachabnahme separat)
Source of Truth: Dieses Dokument besitzt das benannte Thema; Code belegt den Iststand, das Abnahmeregister den Prüfstand.

Diese Roadmap folgt auf [Räume und Objekte mit Raum-Keys verbinden](../../atlas/contract/spatial-runtime.md#keys-features-templates-und-geschützter-graphentwurf). Deren Phasen sicherten zunächst den funktionierenden Ablauf. Dieser Fachplan hält den Vergleichsumfang von **Building Tool** und **Object Tool** des installierten Dungeondraft 1.2.0.1 „Opulent Kirin“ fest. Bedienwirkung und Kartenwirkung sollen gleichwertig sein; eine andere Oberfläche und einzelne andere Pixel sind zulässig.

Für die weitere Umsetzung gelten die gemeinsamen [Ergebnisgleichwertigkeit und Lieferprioritäten](../../atlas/requirements/atlas.md#wie-kommen-wir-zum-ziel). Eigene Gesten, Werkzeuge und Darstellung dürfen dieselben fachlichen Ergebnisse erreichen. Pixelwerte und Originaleingaben sind Diagnose- und Referenzdaten, keine Identitätsvorgabe.

Der verbindliche Unterfallkatalog steht in `acceptance.json`. Die Phasen decken `DD-011` bis `DD-015`, `DD-026` und die für dessen Bibliothek nötigen Tags und Sets aus `DD-047` ab. Farbwahl, Assetpakete und Auswahl werden nur für Abläufe dieser beiden Werkzeuge einbezogen. Die vollständige Parität anderer Werkzeuge bleibt offen. Raum-Key und Feature-Verknüpfung haben kein Dungeondraft-Vorbild; sie werden als Projektablauf gegen die bestehenden Anforderungen geprüft.

Die [Folge-Roadmap für die übrigen Dungeondraft-Abläufe](tools.md) enthält die weiteren Werkzeuganforderungen.

## Funktionsprüfung

Originalwirkung und den passenden Unterfall in `acceptance.json` vergleichen. Eingabefolge, Optionen, Vorschau, Undo/Redo, gespeicherte Wirkung und frische Neuöffnung auf isolierten Testdaten belegen. Nur bestätigte Abweichungen angleichen; fehlende Original-, Host- oder physische Nachweise bleiben offen. Produktive Karten, Kennungen und Nutzertexte schützen.

## Phase 1 – Grundformen und Zeichengesten

**Unterfälle:** `DD-011.01` bis `.10` sowie `.13` und `.14`. `DD-011.15` wird vollständig in Phase 3 geprüft; das Speichern und frische Wiederöffnen aller hier gezeichneten Formen bleibt Teil dieses Phasentors.

Rechteck, Ellipse, Polygon und ein schmaler Polygongang müssen als bearbeitbare Formen erreichbar sein. Vorschau, Punkt-Rücknahme, Kurven, Ausschneiden/Radieren, Abbruch und Snap sind mit eigener Bedienung zu prüfen. Die historisch verglichenen Rücktaste-/Shift-/Alt-Gesten bleiben Referenzbelege, keine Pflicht zum identischen Nachbau.

**Phasentor:** Jede Form und fachliche Bearbeitungswirkung ist belegt; Abbruch erzeugt keinen Teilstand, ein abgeschlossener Schritt ist rücknehmbar und nach frischem Öffnen erhalten. Räume und bestehende Durchgänge bleiben bei geänderten Konturen konsistent.

## Phase 2 – Konturpunkte bearbeiten

**Unterfälle:** `DD-012` bis `DD-014`.

Punktbearbeitung aktivieren, Eck- und Ellipsenpunkte ziehen, Punkte an Kanten einfügen und mit Delete beziehungsweise Rücktaste entfernen. Mindestpunktzahl, Trefferzonen, fortlaufende Vorschau und die Folgen für Boden, Wand und gebundene Öffnungen werden am Original verglichen.

**Phasentor:** Einfügen, Ziehen und Entfernen liefern die belegte Konturwirkung; Undo/Redo und Neuöffnung erhalten Geometrie, Portalbindung und Raumzuordnung.

## Phase 3 – Boden und Gebäudewand gestalten

**Unterfälle:** `DD-011.11`, `.12`, `.15`, `.16` bis `.22` sowie `DD-015`.

Boden- und Wandgalerie, Stil ohne Wand, Färbung und Farbwähler, Bevel Corners und Stilwechsel vor und nach dem Zeichnen werden mit denselben Testkonturen geprüft. Paketwände müssen Punktänderungen folgen. Farbwahl wird nur für diese Werkzeugoptionen einbezogen.

**Phasentor:** Stil, Farbe, Kontur und Wandverbindung zeigen die belegte Wirkung und bleiben nach Bearbeitung, Undo/Redo, Speichern und Neuöffnung erhalten. `DD-011.15` umfasst danach alle Building-Optionen einschließlich der bereits in Phase 1 geprüften Formen.

**Wear und Building:** Der Originalschalter „Disable Building Wear“ ist als binärer gespeicherter Modus mit Boden, eingebauten/Paketwänden und Vorschau geprüft. Zeichnen, Undo/Redo, Save/Frischöffnung und unveränderte V2-Zahlenwerte behalten ihre direkten Belege. Der [abschließende 17-Fälle-Nachweis](/home/aaron/.cache/dungeon-native-qa/parity-phase3-review2-20261008/phase3-independent-review.md) vom 08.10.2026 auf `7afb942` / Build `aced507f…` schließt `DD-011.15`, `DD-015.04`, `DD-015.05` und die übrigen 14 Phase-3-Unterfälle. Die abschließenden Fach- und Aufräumreviews stehen in `acceptance.json.strictParity`; die [frühere Chronik](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/blob/0554bc04cf99da2f77ed197826b4239c8b1d046e/acceptance.json) bleibt im Gitstand nachlesbar. Daraus folgt keine weitergehende physische oder Gesamtparitätsabnahme.

## Phase 4 – Objektbibliothek, Suche, Tags und Sets

**Unterfälle:** `DD-026.01` bis `.08`, `.17`, `.30` und `DD-047`.

All, Used, Tags, Suche einschließlich Fuzzy/Exact und ihrer Löschaktionen, Bildkachelwahl sowie Custom Set werden mit identischen Testassets verglichen. Die nötige Tag- und Setverwaltung umfasst Anlage, Zuordnung, Override, Save, Close, Abbruch und frischen Start. Der allgemeine Paketmanager gehört nicht zu dieser Phase; die verwendeten Paketassets müssen in der Objektbibliothek richtig erscheinen.

**Phasentor:** Suche und Filter machen die benötigten Assets gezielt auffindbar; Tag- und Setänderungen haben die belegte Geltung und Persistenz. Unbestätigte Originalregeln bleiben ausdrücklich offen.

## Phase 5 – Objektvorschau, Platzierung und Eigenschaften

`DD-026.17` bleibt Objektbibliothek-Regression; die getrennten Kontextabnahmen von `DD-028.19` stehen im Abnahmeregister.

**Unterfälle:** `DD-026.09` bis `.21` sowie `.28` und `.29`; objektbezogene Farbwahl aus `DD-028`.

Ebene und Over/Under, Drehung, einheitliche Skalierung, Schatten, Lichtblockade, geeignete Custom Color, Cursorvorschau, Escape und wiederholte Platzierung werden mit demselben Asset geprüft. Werkzeugvorgaben und bereits gesetzte Objekte bleiben getrennt.

**Phasentor:** Vorschau und gesetztes Objekt stimmen in den geprüften Eigenschaften überein; jeder Klick erzeugt genau eine Instanz und einen Undo-Schritt. Reihenfolge, Farbe, Lichtwirkung und sämtliche gespeicherten Werte bestehen die Neuöffnung.

## Phase 6 – Objektgesten und nötige Auswahl

**Unterfälle:** `DD-026.22` bis `.27`; aus `DD-030` die für ausgewählte Objekte benötigten Klick-, Bewegungs-, Dreh-, Skalierungs-, Spiegel- und Undo-Abläufe.

Die historisch vermessenen Mausrad-/Modifier-/Spiegelgesten dokumentieren Drehung, Maßstab, Varianten und Spiegelung. Für neue Arbeit werden diese Wirkungen über die gemeinsamen eigenen Aktionen erreicht. Gesetzte Objekte bleiben auswählbar, verschiebbar und transformierbar. Die vollständigen Filter-, Gruppen- und Fremdobjektabläufe des Select Tools bleiben eine eigene Abnahme.

**Phasentor:** Jede eigene Aktion verändert nur die beabsichtigte Eigenschaft und bewegt die Kamera nicht unbeabsichtigt. Auswahl, Raumzuordnung, Undo/Redo und frische Neuöffnung stimmen für die geprüften Objektfolgen.

## Phase 7 – Gemeinsamer Ablauf

Auf einer isolierten Kopie einen Raum zeichnen und bearbeiten, mehrere Objekte auswählen und setzen, eines zwischen Räumen verschieben, ein Feature mit seinem wortgleichen Key-Abschnitt verbinden und den Abschnitt über die Karte öffnen. Danach Undo/Redo, Speichern und einen frischen Obsidian-Prozess prüfen. Die zuvor übersprungene physische Maus-/Touchpad-Probe und eine große kombinierte Testkarte erhalten eigene Ergebnisse; ohne diese Belege werden sie nicht als abgeschlossen markiert.

**Phasentor:** Alle Pflicht-Unterfälle dieser Roadmap besitzen direkte Original- und Endstandsbelege. Der bestehende Raum–Objekt–Key-Ablauf, die Spielansicht, IDs, Links und geschützte Texte bestehen die Regression. Offene Fälle außerhalb dieser Roadmap werden nicht als erledigt ausgewiesen.
