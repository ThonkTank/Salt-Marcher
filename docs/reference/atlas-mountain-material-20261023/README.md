# Gebirgsmaterial im gemeinsamen Atlas — 23.10.2026

## Auftrag und Entscheidung

Gebirge dürfen Geländefarbe und Textur modulieren: steinigere Hänge und Schnee
oberhalb einer Höhe. Der Nutzerauftrag ergänzt den bestehenden Atlas; Kamera,
Geometrie, gemalte Farben und feste physische Höhenlinien bleiben unabhängig.

Verglichene technische Ansätze:

1. Gemeinsamen Rasterkern ergänzen: dieselbe Materialregel für Hauptatlas,
   Worker-Vorschau und Export; keine zusätzlichen Terrainabfragen oder Datenart.
   Endgültige Farben hängen weiterhin an der Rasterverfeinerung. Gewählt.
2. Material vollständig im GPU-Shader berechnen: unmittelbare Reaktion auf
   Höhenentwürfe möglich, benötigt aber einen passenden Export-/Fallbackpfad
   und Zugriff auf unveränderte Grundfarben. Für Live-Sculpt weiter zu prüfen.
3. Eine neue Kartenengine oder separate Materialkarten einführen: größere
   Architekturänderung ohne notwendigen Vorteil für diesen Materialschritt.

## Verhalten

- `terrain-relief.ts` berechnet Fels aus physischer Hangneigung und Schnee aus
  physischer Höhe. Standard-Schneegrenze 2500 m; im Menü Darstellung → Reliefstil
  einstellbar. Der Schneeübergang reicht von der Grenze bis 300 m darüber.
- Steile Felswände behalten auch oberhalb der Schneegrenze sichtbaren Stein.
  Zurückhaltende Körnung liegt auf festen Weltkoordinaten und wird unterhalb
  ihrer Abtastgrenze weich ausgeblendet. Beleuchtung und Konturen folgen danach.
- Fels und Schnee sind abschaltbar. Höhenfarben bleiben eine unveränderte
  Analyseansicht. Wasser erhält kein Gebirgsmaterial. Gespeicherte Grundfarben,
  Geländearten und Höhen werden nicht überschrieben.
- Bestehende ausdrücklich gespeicherte Stilprofile ohne die neuen optionalen
  Felder behalten ihre bisherige Darstellung. Der Standardstil verwendet die
  neue Modulation. Keine Datenmigration und kein neues Biom.

## Prüfung

15 gezielte Relief-/Farbkacheltests und 74 betroffene Regressionen bestanden.
Die erste Candidate-CI fand zusätzlich den historischen Pigment-Bildvergleich:
sein ungesetzter Stil aktivierte jetzt das neue Gebirgsmaterial. Die Probe
verwendet deshalb ausdrücklich ihr altes Stilprofil; der vorhandene SHA-256-
Bildreferenzwert bleibt unverändert. Alle drei Pigment-Streamtests bestehen.
Ein vollständiger lokaler Diagnoselauf und eine neue Candidate-CI folgen.
App- und Desktop-Typprüfung, Desktop-Build und Repositoryprüfung bestanden.
Die Reliefprüfungen decken hohe ebene Flächen, Fels unterhalb der Schneegrenze,
steile verschneite Hänge, Wasser, alte Profile, Analyse, negative Kachelränder,
Vorschaugleichheit, Quelleninvalidierung, History und frisches Öffnen ab.

`tools/test-desktop-mountain-material.mjs` verwendet eine eigene Kampagne über
normalen Entwicklungsstart, Materialschalter und Schneegrenze, Undo/Redo,
Draufsicht, Neigung, Zoom, PNG-Ausgabe und einen frischen Prozess. Die erste
Probe schloss beide Prozesse normal und ohne Rendererfehler; ihre Bildschirmbilder
zeigten noch die grobe Übersicht. Die wiederholte Probe wartet ausdrücklich auf
`terrainQuality=detail`: alle sechs Aufnahmen erreichten diese Stufe. Beide
Prozesse (118287, 119276) schlossen normal mit Exit 0 und verschwanden; keine
Rendererfehler. [Rohbefund](result.json), [ohne Material](01-disabled.png),
[Fels/Schnee bei 900 m](02-rock-snow.png), [Schneegrenze 1600 m](03-high-snowline.png),
[geneigte Hauptkamera](04-tilted.png), [Zoom](05-zoom.png),
[Wiederöffnung](06-reopened.png), [PNG-Export](export.png). Bilder wurden visuell
verglichen: die höhere Schneegrenze verkleinert die weißen Gipfelflächen,
Fels bleibt an den Flanken sichtbar. Quellen-SHA und Hashes der geprüften
uncommitteten Desktop-Artefakte stehen im Rohbefund.

## Grenzen und nächster Schritt

Keine vollständige Produktabnahme. Die grobe erste Textur ist weiterhin sichtbar
unscharf; die endgültige Verfeinerung benötigt Zeit. In dieser Probe lagen
zwischen erreichbarer Oberfläche und fertigen Detailtexturen noch 2,8–7,2 s.
Das ist keine Messung der Eingabelatenz und keine Leistungsfreigabe. Ein
zusätzlicher gepaarter CPU-Versuch schwankte unter paralleler Hostlast stark
und erlaubt keinen belastbaren Vergleich der Materialkosten. Die unmittelbare GPU-Sculpt-
Vorschau kennt bisher nur Höhen-/Küstenänderung und einfache Lichtkorrektur:
endgültiger Schnee und Stein folgen mit den aktualisierten Farbtexturen. Eine
Pinselgeste über die Schneegrenze braucht deshalb noch eine eigene Live-Prüfung
und gegebenenfalls einen Materialpfad für Entwürfe.

Die synthetische Landschaft zeigt noch breite Pinselplateaus und grobe Kämme.
Diese Geometrie stammt aus den bestehenden festen Autorengesten; Material allein
macht sie nicht zu einer fertig gestalteten Fantasykarte. Weltleistung auf dem
Pentium 7505/UHD und vollständige Gestaltungsabnahme bleiben offen.
