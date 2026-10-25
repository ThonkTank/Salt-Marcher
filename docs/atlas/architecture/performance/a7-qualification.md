# A7: Gesamtprodukt qualifizieren – Arbeitspakete

Status: Planned; alle Pakete offen.
Owner: atlas
Last Reviewed: 2026-10-25 (Zerlegung; keine Umsetzung)
Source of Truth: Paketumfang für A7; Ziele und gemeinsame Ausführungsregeln stehen in der [Roadmap](../performance-roadmap.md).

**Start:** A6 abgeschlossen. **Reihenfolge:** A7.01–A7.06 → A7.21–A7.23 → A7.07–A7.20.
Native Prüfungen laufen seriell auf Testkopien. Jedes Ablaufpaket liefert genau
seinen Fachnachweis; keine pauschale Produktfreigabe aus einem großen grünen Test.
Kleine, eindeutig auf den neuen Renderanschluss begrenzte Fehler gehören zum
jeweiligen Paket. Größere Befunde werden vor Reparatur in eigene Unterpakete
zerlegt; der zugehörige Nachweis bleibt bis zur Wiederprüfung offen.

Für jedes Paket gelten Zuständigkeit, Eingaben, Aufwand und Übergabe aus dem
[gemeinsamen Paketvertrag](handbook.md#gemeinsamer-paketvertrag). Fachkompetenz:
vollständige GM-Bedienabläufe, native Electron-Tests und fachliche Soll/Ist-
Bewertung; A7.09/A7.10 Renderexport, A7.12 öffentliche Datenprojektion,
A7.18/A7.19 Git-/Candidate-/Releaseverfahren. Eingaben sind A6-Ergebnis und die
in A7.01 zugeordneten Fachquellen und echten Testinhalte. Schnittstellen sind
Export/Spielerprojektion, Archiv und qualifizierter Auslieferungsstand; R7 und
die Abschlussphase erhalten die vollständigen Belege und offenen Grenzen.

### A7.01 — Fachumfang auf tatsächliche Prüfabläufe abbilden

<!-- atlas-dependencies {"requires":["A6.10","R6.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A6.10 bestanden.
- **Auftrag und Ergebnis:** Jede Gruppe im Funktionsumfang des gemeinsamen Atlasplans gegen den vorhandenen Capability-Katalog, passende Fachquelle und tatsächlichen Testinhalt abgleichen. Fehlende renderbedingte Abdeckung den folgenden Paketen zuordnen; eine größere fehlende Prüffamilie vorab in eigene Unterpakete teilen.
- **Prüfung / fertig:** Keine Gruppe fällt durch Weglassen aus der Abnahme. Bereits zuvor fehlende Produktfunktionen getrennt offen halten; nicht als Regression oder umgesetzt ausgeben. Keine zweite Testlink-Datenbank anlegen. Keine vollständige `acceptance.json` als Hintergrund laden.

### A7.02 — Landschaft, Gewässer und Trassen nativ prüfen

<!-- atlas-dependencies {"requires":["A7.01","R6.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A7.01.
- **Auftrag und Ergebnis:** In einer Testregion Land formen/glätten/färben, Eigenschaft und Hexfüllung ändern, zurücksetzen, Wasser setzen/entfernen sowie Straße/Fluss anlegen und korrigieren. Sichtbare Wirkung, Auswahl und Undo/Redo prüfen; A5-Latenzbelege ergänzen keine fehlende Fachfunktion.
- **Prüfung / fertig:** Geometrie-/Materialzustand und sichtbare Referenz stimmen nach den Gesten. Einstiege: `tools/test-desktop-landscape-tools.mjs`, `tools/test-desktop-terrain-routes.mjs`; Tests vor Nutzung nach Inhalt abgleichen. Belege bei 100 %/200 % und geneigter Ansicht.

### A7.03 — Bewuchs und Einzelkorrekturen nativ prüfen

<!-- atlas-dependencies {"requires":["A7.02","R6.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A7.02.
- **Auftrag und Ergebnis:** Bewuchs malen/umgrenzen, Baumreihe, Freihalten, Ausdünnen/Verdichten und Einzelbaum/-felsen samt Korrektur prüfen. Wechsel zwischen Flächen- und Einzelzeichnung, Wasserunterdrückung und Geländeänderung einschließen.
- **Prüfung / fertig:** Dünne Säume, Löcher, einzelne Instanzen, Auswahl unter Kronen und Undo/Redo erhalten. Keine neue Zufallsverteilung beim Zoom. Einstieg: `tools/test-desktop-atlas-multiscale.mjs`; maßgebliche Fachquelle `docs/atlas/requirements/vegetation.md`.

### A7.04 — Kartografie, Assets und Navigation nativ prüfen

<!-- atlas-dependencies {"requires":["A7.03","R6.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A7.03.
- **Auftrag und Ergebnis:** Region und Hierarchie, Grenzen, gebundene/freie Namen, Referenzbild, Symbol, freie Texte und vorhandene Streuung bearbeiten. Suche, Rücksprung, mehrdeutige Auswahl, Griffe, Maße/Einheiten und Größenvergleich im selben Ablauf verwenden.
- **Prüfung / fertig:** Anker, Alpha, Schriftlesbarkeit und Auswahl bleiben über Maßstäbe und 200 % korrekt; Exportgleichheit wird gesondert in A7.11 geprüft. Einstiege: `tools/test-desktop-atlas-cartography.mjs`, `tools/test-desktop-atlas-measurements.mjs`.

### A7.05 — Stadt und Gebäude nativ prüfen

<!-- atlas-dependencies {"requires":["A7.04","R6.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A7.04.
- **Auftrag und Ergebnis:** Vorhandenen Stadtpfad mit Viertel-/Straßen-/Platz-/Haus- und Befestigungsbearbeitung prüfen, Bebauungsvorschlag und Dichte-/Größen-/Nutzungsänderung einschließen. Gebäudeinspektor und Personen-/Fraktionsbezug müssen nach Auswahl weiter verwendbar sein.
- **Prüfung / fertig:** Gebäudegrundriss, Dach, Höhe und Auswahl stimmen; Stadt-SVG/JSON und gespeicherter Fachinhalt bleiben unverändert interpretierbar. Einstieg: `tools/atlas-main-city-probe.mjs`, `tools/test-desktop-atlas-objects-main.mjs`; offene City-Abnahmen nicht aus Renderbereitschaft ableiten.

### A7.06 — Raumformen und Geometriebearbeitung nativ prüfen

<!-- atlas-dependencies {"requires":["A7.05","R6.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A7.05.
- **Auftrag und Ergebnis:** Rechteck, freies Polygon und Höhle anlegen; Löcher/Radieren, vorhandenes Generieren, Skalieren und Teilen in getrennten kleinen Fällen prüfen. Bestehende Grundplanprobe erweitern, wo diese konkreten Fälle fehlen.
- **Prüfung / fertig:** Form, Löcher, Abmessungen, Treffer und Undo/Redo stimmen vor/nach Speicherung. Einstieg: `tools/test-desktop-dungeon-groundplan.mjs`; vorhandene Rechteck-/Resizefälle allein decken freie Geometrie und Höhlen nicht ab.

### A7.21 — Geschosse, Raumgruppen und Keys nativ prüfen

<!-- atlas-dependencies {"requires":["A7.06","R6.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A7.06; vor A7.07.
- **Auftrag und Ergebnis:** Zwei Geschosse mit gemeinsamer Raumgruppe bearbeiten, wechseln und räumlich korrekt auswählen; Raum-Key öffnen, Text/Link ändern und zur Karte zurückkehren. Native Probe bei 100 %/200 % und Neigung ergänzen.
- **Prüfung / fertig:** Geschosshöhen, Gruppenbezug, Verdeckung, Keybindung und gespeicherte Texte/Links stimmen. Einstieg: `tools/test-desktop-dungeon-authoring.mjs`; Archivgeschosse sind kein Ersatz für diese Bedienfolge.

### A7.22 — Wände, Türen, Portale und Treppen nativ prüfen

<!-- atlas-dependencies {"requires":["A7.21","R6.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A7.21; vor A7.07.
- **Auftrag und Ergebnis:** Je eine Wand, Tür, Portal und Treppe platzieren, auswählen und ändern; Anschluss an Raum/Geschoss und sichtbare Vorschau prüfen. Fehlende Fälle als kleine neue native Probe im bestehenden Werkzeugtest ergänzen.
- **Prüfung / fertig:** Lage, Orientierung, Höhenbezug, Treffer und Undo/Redo stimmen; Portal-/Treppenbezug bleibt im Fachmodell erhalten. Vorhandene Türprüfung allein genügt nicht für Portal und Treppe.

### A7.23 — Einrichtung, Licht, Text und Bibliotheksobjekte nativ prüfen

<!-- atlas-dependencies {"requires":["A7.22","R6.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A7.22; vor A7.07.
- **Auftrag und Ergebnis:** Einrichtungs- und Bibliotheksobjekt, Licht und freien Innenraumtext platzieren, verschieben, auswählen und löschen; saubere Alpha-/Zeichenreihenfolge bei Überlagerung prüfen. Je Familie einen definierten Referenzfall ergänzen, keine allgemeine Bibliotheksneuentwicklung.
- **Prüfung / fertig:** Attribute, Orientierung, Text, sichtbare Wirkung und Undo/Redo stimmen auf dem neuen Renderer. Inhalte bleiben nach Geschosswechsel und Neustart vorhanden.

### A7.07 — Räumliche Zusatzwerkzeuge und Reise prüfen

<!-- atlas-dependencies {"requires":["A7.23","R6.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A7.23.
- **Auftrag und Ergebnis:** Bereits vorhandene Volumen, Graph-/Passagenbezüge, Schnitte/Dächer, Triggerflächen und Binder-/Raumsuche auf dem neuen Renderer prüfen. Anschließend Reisevorschau, Partymarker und Eingang über Welt → Ort → Raum → zurück verwenden.
- **Prüfung / fertig:** Gleiche Zielkennungen und Fachwirkung wie vor dem Umbau; keine implizite Änderung der Weltzeit durch bloße Navigation. Einstiege: `tools/test-desktop-travel-target.mjs`, `tools/test-desktop-travel-checkpoints.mjs`; Fachumfang `docs/dungeon/requirements/smr04-spatial-coverage.md`.

### A7.08 — Speicherung, Neustart und Archivtransfer prüfen

<!-- atlas-dependencies {"requires":["A7.07","R6.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A7.07.
- **Auftrag und Ergebnis:** Die bearbeitete Mischwelt normal schließen, frisch öffnen, speichern und über vorhandenen Archivpfad in eine frische Testkampagne übernehmen. Vollständige Inhalte gegen das Fixture-/Änderungsmanifest prüfen, nicht nur Objektzahlen oder sichtbare Karte.
- **Prüfung / fertig:** Texte, Links, Positionen, Höhen, Trassen, Vegetation, Räume und History-/Recoveryverhalten entsprechend ihren bestehenden Verträgen erhalten. `CampaignWorkbench` und Archivkennungen unverändert. Einstiege: `tools/test-desktop-live-archive.mjs`, `tests/desktop-archive-transfer.test.mjs`, `tools/atlas-reference-fixture.mjs`.

### A7.09 — Eingefrorene Ausgabeszene an den Renderer anschließen

<!-- atlas-dependencies {"requires":["A7.08","R6.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A7.08.
- **Auftrag und Ergebnis:** Exportverbraucher an denselben gewählten Darstellungsstand anschließen; Quellenrevision, Kamera, Ausschnitt, Geschoss, Maßstab und Stil einfrieren. Keine Live-Entwürfe nach Beginn in den Ausgabeauftrag übernehmen.
- **Prüfung / fertig:** Editieren/Quellenwechsel während Ausgabe verändert den Snapshot nicht; fehlende Quellen erzeugen keinen vermeintlich fertigen Export. Einstiege: `src/app/atlas-output.ts`, `src/app/atlas-terrain-export.ts`, `tests/atlas-terrain-export.test.mjs`.

### A7.10 — Gekachelte Bildausgabe anschließen

<!-- atlas-dependencies {"requires":["A7.09","R6.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A7.09.
- **Auftrag und Ergebnis:** Rendererziel und Kameraausschnitt für vorhandene Exportkacheln verbinden; globale Labelplatzierung und Horizontdarstellung erhalten. Vorhandene Grenzen von 1024 × 1024 Pixeln je GPU-Zwischenbild und bis 8192 Pixeln Ausgabe nicht vergrößern.
- **Prüfung / fertig:** Bilder mit Schrift und Transparenz über horizontalen/vertikalen Kachelgrenzen haben keine Nähte, doppelten Labels oder abgeschnittenen Inhalte. Abbruch gibt Zwischenressourcen frei. Bestehende Materialberechnung wiederverwenden, keine zweite Exportästhetik.

### A7.11 — Bildausgabe nativ vergleichen und Weiterarbeit prüfen

<!-- atlas-dependencies {"requires":["A7.10","R6.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A7.10.
- **Auftrag und Ergebnis:** Region mit Straße, Gewässer, Namen, Gebäuden und geneigtem Terrain als kleine und gekachelte große Ausgabe erstellen; Editor und Bild bei entsprechender Kamera vergleichen. Nach Erfolg und Abbruch zurück zu Werkzeugen, Menüs und Auswahl.
- **Prüfung / fertig:** Auflösung, Inhalt, Schärfe, Kachelgrenzen und wieder benutzbarer Atlas nachgewiesen. Einstiege: `tools/test-desktop-region-export.mjs`, `tools/test-desktop-atlas-cleanup.mjs`; ein nicht leeres PNG allein genügt nicht.

### A7.12 — Öffentliche Darstellung und Datengrenze anschließen

<!-- atlas-dependencies {"requires":["A7.11","R6.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A7.11.
- **Auftrag und Ergebnis:** Spielerkarte und öffentliche Ausgabe auf den gewählten Renderer führen, ausschließlich aus freigegebener Projektion. Terrain-/Waldmasken und Ressourcen dürfen keine geheimen Kanäle aus der GM-Szene beziehen.
- **Prüfung / fertig:** Datenpayloads und Ressourcen auf GM-Inhalte prüfen; bloß unsichtbare Geheimgeometrie ist ein Fehler. Einstiege: `src/app/player-atlas.ts`, `src/app/player-terrain.ts`, `tests/desktop-player-render-bounds.test.mjs`.

### A7.13 — Spielerfenster und Freigabeänderungen nativ prüfen

<!-- atlas-dependencies {"requires":["A7.12","R6.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A7.12.
- **Auftrag und Ergebnis:** Spielerfenster öffnen, Kartenausschnitt offenlegen, Freigabe zurücknehmen, Szene wechseln und Fenster neu öffnen. Öffentliche Ausgabe für dieselbe Freigabe vergleichen.
- **Prüfung / fertig:** Keine privaten Texte/Objekte/Materialdaten, keine veralteten freigegebenen Inhalte nach Widerruf; Kamera und sichtbare Darstellung korrekt. Einstiege: `tools/test-desktop-player-scene-privacy.mjs`, `tools/test-desktop-player-map-reveal.mjs`.

### A7.14 — Schließen während einer Terrainanfrage erneut prüfen

<!-- atlas-dependencies {"requires":["A7.13","R6.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A7.13 und der in A1 gesicherte Fehlerbeleg.
- **Auftrag und Ergebnis:** Die frühe Reparatur bzw. den Schutzbeleg aus A1.12 auf dem endgültigen Renderer erneut prüfen. Erwarteten Hostabbruch, ausstehende Aufgaben und verspätete Antworten unter normalem Schließen testen; eine Regression gezielt korrigieren. Nicht pauschal alle Fehler verschlucken.
- **Prüfung / fertig:** Normal schließen während Material-/Geometrienachladung endet ohne unhandled rejection und ohne Restprozess. Ein injizierter echter Ladefehler bleibt sichtbar. Native 200%-Pinselprobe mit demselben Abschluss wiederholen; vorherige Fehlmessung nicht nachträglich umetikettieren.

### A7.15 — GPU-, Größen- und Kontextwechsel nativ prüfen

<!-- atlas-dependencies {"requires":["A7.14","R6.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A7.14.
- **Auftrag und Ergebnis:** A3-Lifecycle unter realem nativen Renderer prüfen: Resize, 100 %/200 %, GPU-Verlust, Kampagnenwechsel, laufende Vorschau und offene Ausgabe. Erwartete Abbrüche und anschließende Wiederverwendung explizit testen.
- **Prüfung / fertig:** Keine alten Treffer/Frames, keine doppelten Schreibaufträge, Ressourcen wieder freigegeben und Atlas anschließend bedienbar. Fehlende native Unterstützung einer erzwungenen GPU-Probe offen ausweisen; synthetischer Test ersetzt sie nicht.

### A7.16 — Standard umstellen und ersetzten Code entfernen

<!-- atlas-dependencies {"requires":["A7.02","A7.03","A7.04","A7.05","A7.06","A7.21","A7.22","A7.23","A7.07","A7.08","A7.09","A7.10","A7.11","A7.12","A7.13","A7.14","A7.15","R6.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A7.02–A7.15 vollständig bestanden.
- **Auftrag und Ergebnis:** Gewählten Pfad zum einzigen produktiven Standard machen. Nur tatsächlich ersetzte Besitzer, Imports und produktiv ungenutzte Abhängigkeiten entfernen; bei fortbestehendem deck.gl-Pfad deck.gl behalten. Vergleichsbelege sichern, obsolete Prototypenschalter und Testannahmen entfernen oder anpassen.
- **Prüfung / fertig:** Build und betroffene Tests bestehen ohne alten Produktpfad. Architektureinstieg beschreibt den tatsächlichen Datenfluss; Testlinks bei Umbenennungen/Entfernung im Capability-Katalog nachführen. Native Start-/Bearbeitungs-/Export-/Neustartprobe auf dem bereinigten Build erfolgreich.

### A7.17 — Finale Leistungs- und Ressourcenqualifikation ausführen

<!-- atlas-dependencies {"requires":["A7.16","R6.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A7.16.
- **Auftrag und Ergebnis:** Auf demselben finalen Build A4-Matrix, A5-Pinselserien, A6-Kalt-/Nachladereihen und A4-Langstrecke ausführen. Checkpoints erlauben Fortsetzen fehlender Fälle, nicht Mischen verschiedener Buildrevisionen. Tests auf dem Gerät seriell durchführen.
- **Prüfung / fertig:** Alle ursprünglichen Ziele und Rohbelege vorhanden; keine fehlgeschlagenen Serien durch Durchschnittswerte verdeckt. Ergebnis nennt Laptop, GPU, Speicher und Messgrenzen. Ein Lauf auf dem vorhandenen Rechner ist keine zusätzliche 16-GiB-Zielgeräte- oder Eigentümerabnahme.

### A7.18 — Exakten Integrationskandidaten qualifizieren

<!-- atlas-dependencies {"requires":["A7.17","R6.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A7.17 und vollständige fachliche Belege auf dem zu liefernden Stand.
- **Auftrag und Ergebnis:** Eigenen fertigen Stand auf aktuellem `origin/main` gemäß Lieferregeln als linearen Kandidaten bereitstellen; fremde Änderungen erhalten. Node 22 verwenden. Reale Candidate-CI muss `npm run check:repo`, `npm run check`, `npm run check:desktop`, `npm test`, `npm run build` und `npm run build:desktop` auf exakt dieser SHA bestehen.
- **Prüfung / fertig:** Tatsächlicher `Candidate · exact-SHA aggregate` verlinkt und grün; keine lokale Ersatzbehauptung. Ändert Konfliktlösung Produktcode oder Buildinputs, betroffene native/funktionale Belege vor Freigabe erneuern. Ein PR wird am Task angehängt.

### A7.19 — Integrationsstand und Lieferpflicht prüfen

<!-- atlas-dependencies {"requires":["A7.18","R6.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A7.18 bestanden.
- **Auftrag und Ergebnis:** Kandidaten nach geltenden Regeln integrieren; Main-SHA und zugehörige Checks verifizieren. Seit letztem stabilen Workbench-Release tatsächlich gemergte PRs zählen und bestehende Releasearbeit prüfen. Bei Schwelle 10 oder manuellem Releaseauftrag den bestehenden Releaseprozess übernehmen; er ist ein eigener Lieferauftrag, kein nebenbei behaupteter Abschluss dieses Pakets.
- **Prüfung / fertig:** Integrierte SHA, CI-Beleg, Basistag, PR-Zahl und gegebenenfalls konkreter Releaseauftrag/Blocker dokumentiert. Keine Tags, Pakete oder Installation aus CI-Grün ableiten. Releasepflicht bleibt offen, bis der separate vorgeschriebene Prozess wirklich abgeschlossen ist.

### A7.20 — Abnahmestände und offene Grenzen abschließend abgleichen

<!-- atlas-dependencies {"requires":["A7.19","R6.03"],"alternativeRequires":[],"activationRequires":[],"returnGates":[]} -->

- **Voraussetzung:** A7.19; ausgelöste Lieferpflichten erfüllt oder explizit als ausstehend geführt.
- **Auftrag und Ergebnis:** Jeden Punkt der Roadmap und des in A7.01 gebundenen Fachumfangs gegen aktuelle Belege prüfen. Capability-Katalog, gezielte Abnahmeeinträge und Roadmapstatus angleichen; technische Umsetzung, native Prüfung, Installation/Release und Nutzerabnahme getrennt berichten.
- **Prüfung / fertig:** A7 nur bei vollständigem eigenem Gate abgeschlossen. Fehlende Zielgeräte-/Nutzerabnahme und ausstehende Veröffentlichung werden ausdrücklich offen ausgewiesen; keine bereits fehlende Produktfunktion gilt durch den Rendererwechsel als erledigt. Alle neu gefundenen erforderlichen Reparaturen sind erledigt und erneut geprüft oder verhindern den jeweiligen Abschluss.
