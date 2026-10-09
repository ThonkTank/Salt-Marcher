# SMR-00-ADR-01 – Zielplattform und Migrationspfad

Status: vorgeschlagen; Team- und Cloud-Review ausstehend  
Stand: 9. Oktober 2026

## Entscheidungskontext

Das Produkt in diesem Repository ersetzt SaltMarcher vollständig. Verbindlich
sind die bestätigten UX-, Funktions-, Daten-, Offline-, Sicherheits-,
Barrierefreiheits- und Qualitätsanforderungen. Der aktuelle Obsidian-Host ist
eine wertvolle Implementierungs- und Beweisbasis, aber nach direkter
Nutzerentscheidung keine zwingende Zielplattform.

Die Entscheidung muss insbesondere diese vorhandenen Werte erhalten:

- die qualifizierten Dungeon-, Hex-/Atlas- und Stadtpfade einschließlich
  stabiler IDs, Kartenformate, History und Original-/Hostbelege;
- Katalog-, Encounter-, Campaign-, Party-, Scene-, Reise-, Kalender-, Wetter-,
  Musik-, Shop-, Autonomie- und Datenlebenszyklusverträge aus SaltMarcher;
- lokale Offline-Nutzung, atomare und wiederherstellbare Writes, portable
  Assets, zweites Display, lange abbrechbare Jobs und kontrollierte
  Erweiterungsfähigkeiten;
- genau eine fortzuführende Produktlinie statt dauerhaft paralleler Hosts.

## Bewertete Optionen

| Option | Stärken | Harte Risiken | Urteil |
| --- | --- | --- | --- |
| Obsidian als dauerhafter einziger Host | beste unmittelbare Wiederverwendung der Kartenarbeit; Markdown-/Vault-UX vorhanden | fremder Prozess-, Fenster-, Update- und Erweiterungshost; atomare Mehraggregat-Writes, Recovery, Audio, zweites Display und Fail-Closed-Sicherheitsgrenzen nur indirekt kontrollierbar | nicht als Ziel empfohlen |
| direkte Standalone-Neuübernahme aus SaltMarcher | bewährte Desktop-, Prozess-, SQLite-, Audio-, Fenster- und Packagingmuster | hohe Gefahr, die umfangreiche und bereits qualifizierte Karten-/Atlasarbeit neu zu bauen oder zwei Produktlinien zu erzeugen | nicht als Big-Bang empfohlen |
| hostneutraler Kern plus Desktop-Zielshell; Obsidian als befristeter Adapter | erhält Karten- und UX-Arbeit, erlaubt schrittweise Migration und kontrollierte Sicherheits-/Daten-/Fenstergrenzen | vorübergehend mehr Adapter- und Vertragspflege; verlangt harte Exit-Gates | bevorzugte Richtung |
| Web/PWA als Primärhost | einfache Bereitstellung | lokale Medien, große Offlinebestände, Dateirecovery, zweites Display und Hintergrundjobs benötigen erneut native Hilfen | nicht empfohlen |

## Vorgeschlagene Entscheidung

Das Team verfolgt einen schrittweise entkoppelten Hybrid-Migrationspfad mit
genau einem finalen Produkt:

1. Domäne, Anwendungskommandos, Projektionen und UI-Zustände werden
   hostneutral. Sie kennen weder Obsidian noch Electron, Vault, SQLite oder
   privilegierte Browser-/Node-APIs.
2. Explizite Ports kapseln Kampagnen-/Transaktionsspeicher, Assets,
   Markdownprojektion, Fenster-/Spielerprojektion, Audio, Uhr/Kalender,
   Hintergrundjobs und Extension-Fähigkeiten.
3. Eine eigenständige Desktop-Shell ist die vorgeschlagene Zielruntime. Die
   bereits in SaltMarcher belegten Electron-Muster dürfen dafür selektiv als
   technische Referenz dienen; der alte Code wird nicht als Ganzes übernommen.
4. Der bestehende Obsidian-Host bleibt ein befristeter Adapter für die bereits
   qualifizierten Karten-, Dungeon-, Atlas-, Stadt- und Katalogabläufe. Er ist
   kein zweites Endprodukt.
5. Die Umstellung erfolgt erst, wenn die bestehenden Produktbelege in der
   Zielshell mindestens gleichwertig bestehen. Originale Nutzerdateien und
   stabile IDs bleiben geschützt.

Diese Richtung ist noch nicht ratifiziert. Sie wird erst verbindlich, wenn die
unten genannten Beweise vorliegen und die sechs lokalen/Geräte-Stränge sowie
die zuständigen Cloud-Reviewer ihre Bereichsrisiken geprüft haben.

Eine erste statische Zielrepo-Inventur auf `b7e06f0` stützt die Richtung:
68 von 78 ausgewerteten TypeScript-Dateien importieren Obsidian nicht direkt.
Die direkte Hostgrenze konzentriert sich auf zehn Dateien in Einstieg,
Vaultspeicher und UI. `FileStore`, `AssetCatalogStore`, `BinarySource` und
`ObjectTagStorage` sind bereits vorhandene Ports. Die Hauptarbeit liegt deshalb
in der kontrollierten Entkopplung der rund 9.100 Zeilen Host-/UI-Adapter, nicht
in einer Neuerstellung der Karten-, Geometrie-, Session-, History- oder
Generatorlogik.

## Architekturgrenzen des Prototyps

- Domain-/Application-Pakete importieren keine Hostmodule.
- Hostadapter liefern unveränderliche, validierte DTOs und besitzen alle
  privilegierten Datei-, Datenbank-, Fenster-, Audio- und Prozesszugriffe.
- Die vorhandenen Ports werden um Workspace, Notification, Icon,
  Markdownrendering, Linknavigation, Dateiauswahl, Binärassets,
  Katalog-View-Host, passive Projektion und Audio ergänzt.
- Bestehende V4-Kartenformate und stabile Identitäten ändern sich in der
  Beweisphase nicht.
- Neue CE-/SMR-Fachlogik bleibt hostneutral. Neue Obsidian-Kommandos,
  `activeDocument`-/Fensterkopplung oder Vault-Sonderfälle benötigen einen
  begründeten Übergangsadapter und dürfen das ADR nicht vorwegnehmen.
- Die spätere Desktop-Shell verwendet getrennte, minimal befähigte
  Renderer-/Spielerprojektionen. Private GM-Daten dürfen einen passiven
  Spielerkanal nicht erreichen.

## Beweisphase vor Ratifikation

### ADR-P01 – repräsentative Karte

Eine vorhandene, große V4-Karte wird über einen hostneutralen Port in einem
Desktop-Renderer geladen, geändert, rückgängig gemacht, gespeichert und nach
Prozessneustart erneut geöffnet. IDs, Geometrie und History bleiben semantisch
identisch; die vorhandenen Performancebudgets werden mindestens gehalten. Der
bestehende imperative Karteneditor darf dazu unverändert als gekapselter
Rendererbaustein eingebettet werden; ein React-Neubau ist kein Beweisziel.
Ein zusätzlicher Grenztest belegt, dass der Renderer weder Node-/Dateisystem-
noch Datenbankzugriff besitzt.

### ADR-P02 – atomarer Kampagnenwrite

Eine bestätigte Campaign-Mutation wird atomar persistiert und nach hartem
Prozessabbruch exakt fortgesetzt. Ein unbestätigter Write darf weder als
gespeichert erscheinen noch Teilfolgen hinterlassen. Backup und Recovery sind
sichtbar prüfbar.

### ADR-P03 – passives zweites Fenster

Eine fokussierte Scene wird als ausdrücklich party-sichere Projektion in ein
zweites Fenster übertragen. Der Kanal ist read-only; private Notizen,
Mechanikdetails und nicht freigegebene Assets erreichen ihn technisch nicht.

### ADR-P04 – geschlossener Datenroundtrip

Current-Format-Kampagne, Karten, Dokumente und Assets werden als geschlossene
Einheit exportiert, in einer frischen Umgebung importiert und nach Neustart
semantisch identisch gelesen. Unbekannte zukünftige Felder bleiben erhalten.

## Ratifikationskriterien

- Hex/Atlas-, Stadt- und Dungeon-Gerätekollegen bestätigen die Wiederverwendung
  ihrer Formate, Belege, Performancegrenzen und offenen Gates.
- Die drei lokalen Integrationsstränge bestätigen Produktumfang,
  Plugin-Bestandsreuse und Migrationsfolge.
- Der abgelöste GM-Cloud-Strang liefert einen unabhängigen Architektur- und
  Technikreview; weitere Cloud-Kollegen prüfen ihre bestehenden Spezialgebiete.
- Pro Gerät läuft höchstens eine grafische Host-/Originalinstanz.
- Die ersten vertikalen Abläufe bestehen Tastatur, 200 %, Screenreader/axe und
  die bestätigten kleinen Fenstergrößen.
- Linux, Windows und macOS besitzen einen reproduzierbaren Build-/Smoke-Pfad,
  bevor Obsidian als Produktadapter entfernt wird.
- Kein bestehender Fach-, Host-, Original-, Daten- oder Cleanup-Gate wird durch
  den Architekturentscheid stillschweigend geschlossen.

## Migrationsfolge nach Ratifikation

1. Hostabhängige Karten-, Katalog- und Encounter-Zustände hinter Ports lösen;
   Contract-Tests für alten Obsidian- und neuen lokalen Adapter aufbauen.
2. Desktop-Shell und lokale Daten-/Asset-/Fenstergrenzen im Zielrepository
   etablieren; keine zweite Produktroadmap eröffnen.
3. Karten/Atlas und Katalog als erste vertikale Produktpfade gleichwertig
   qualifizieren.
4. Campaign, World Planner, Party und Scene migrieren; anschließend Encounter,
   Loot, Session Planner und Reise.
5. Kalender/Zeit vor Shops, Wetter, Musikautomatik und Autonomie stabilisieren.
6. Obsidian-Adapter erst entfernen, wenn alle davon getragenen Abnahmen in der
   Zielshell bestanden sind und der Datenroundtrip belegt ist.

## Offene Reviewfragen

- Welcher Teil der aktuellen Obsidian-Dokumentstruktur bleibt kanonische
  nutzerlesbare Wahrheit, welcher wird Projektion aus transaktionalen Daten?
- Welche bestehenden V4-/Markdown-Formate sind bereits durch echten
  Nutzereinsatz eingefroren?
- Welche Kartenperformancebelege müssen auf jedem Betriebssystem wiederholt
  werden?
- Welche Cloud-Stränge besitzen über den GM-Review hinaus konkrete
  Sicherheits-, A11y-, Packaging- oder Datenreviewzuständigkeiten?
