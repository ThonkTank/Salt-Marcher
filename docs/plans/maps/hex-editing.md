# Zusammenhängendes Hex-Gelände bearbeiten

Laufzeitreise, unabhängige Kampagnenkopien und verbleibende Reiseziele:
[Hexreise](hex-travel.md).

Original: [Hex Feature Requirements](https://github.com/ThonkTank/Salt-Marcher/blob/9de85c1a26f526acbc1af332ac5962e185c0aab2/docs/hex/requirements/requirements-hex.md).

Ab0.125 verschiebt direktes Ziehen die vorhandene Hexkamera. Mausradzoom ändert ausschließlich die Ansichtsgröße (50–300 Prozent), ebenso
Näher/Weiter. Verschiebeschaltflächen, Alt+Pfeile und mittleres Ziehen benötigen
keinen Flush und werden durch ungültige offene Autorenfelder nicht blockiert. Ansicht zurücksetzen zeigt den Ursprung bei 100 Prozent, ohne
Auswahl, offene Hexeingaben, Route oder Karteninhalt zu ändern. Das separate
Bearbeitungsraster liegt unter Karteneinstellungen und Austausch; dessen Wechsel
sichert offene Eingaben und wählt ausdrücklich eine andere Autorenebene. Gelände malen zeichnet mit dem gewählten Gelände,
Radius und Maßstab; ausgelassene Hexes zwischen Pointerpositionen werden verbunden.
Alt oder die mittlere Taste verschiebt auch bei aktivem Pinsel. Die Kartenfläche
unterstützt Pfeiltasten zur Hexauswahl, Alt+Pfeiltasten zum Verschieben und lokale Strg+Z/Strg+Umschalt+Z-Tastaturaktionen.

Ein Strich ändert ausschließlich terrain in denselben AtlasMap-Zellen. Ende des
Strichs bzw. ein notwendiger Flush verwendet die bestehende revisionierte
World-Schreibgrenze und deren Antwortabgleich. Keine zweite Karte oder Zeituhr.
Wege, Flüsse, Höhen, Texte, Fraktionen und Unterbrechungen bleiben erhalten.

Die gebundenen [Maps Canvas Requirements](https://github.com/ThonkTank/Salt-Marcher/blob/9de85c1a26f526acbc1af332ac5962e185c0aab2/docs/maps/requirements/requirements-maps-canvas.md)
verlangen passive Kameraereignisse. Zoom, Resize, Reset und Verschieben beenden
daher einen gegebenenfalls laufenden Pointerkontext ohne Speicherung. Die bereits
bemalten Zellen bleiben als genau ein rücknehmbarer, ungespeicherter Strich
sichtbar. Der Hinweis nennt „Hex speichern“; dessen vorhandener World-Flush
bestätigt die Änderungen. Nach dem Transformationswechsel wirkt ein verspätetes
Move/Up der alten Pointer-ID nicht auf neue Kartenkoordinaten. Der gewöhnliche
Pointerabschluss ohne Kameraunterbrechung speichert weiterhin. Die Änderung ist
auf diese Kameragrenze beschränkt; Escape/Pointercancel- und explizite Flushwege
sind damit nicht neu definiert. Keine Daten-/Schema-/Commandmigration.

`desktop-map-camera-passivity.test.mjs` prüft Panbuttons, Alt+Pfeile, Zoombutton,
Wheel, Resize und Reset mit gültigen/ungültigen Eingaben und offenen Strichen
gegen den echten SQLiteStore. Kein Worldcommand und unveränderte bestätigte
Bytes vor ausdrücklicher Übernahme; anschließend genau ein Strich und seine
exakte Rücknahme/Wiederholung. Der CTM ist dort kontrolliert, keine native
Koordinatenqualifikation. Zusätzlich nativ am Desktop geprüft: Verschieben mit
offener Hexprosa, echter Pointerstrich mit Mausradunterbrechung, sichtbarer
Entwurfshinweis und ausdrückliche Speicherung. Worldrecords/-history/-receipts
und Positionen bleiben bis zur Übernahme bytegleich; unabhängiges Fresh-Öffnen
erhält Gelände und exakte Prosa. Ein normaler Exit ohne Rendererfehler. Das
qualifiziert diesen Nutzerweg, weder alle Host-/Gesturevarianten noch den
[gemeinsamen passiven Canvasanschluss](../../../ROADMAP-E2E01-ATLAS-RUNTIME-PLAN.md#passive-kartenfläche-und-adoptergrenze).
Rücknahme/Wiederholung stellt die exakten vorherigen expliziten Zellen bzw. deren
Abwesenheit wieder her. Eine inzwischen anders geänderte betroffene Zelle sperrt
Rücknahme, statt fremde Inhalte zu überschreiben.

Lokale History gilt bis Kartenwechsel/Neustart: maximal20Striche bzw.20.000berührte
Zellen. Ein Strich ist auf5.000Zellen begrenzt; die Grenze wird angezeigt und
bereits sichtbare Änderungen bleiben im normalen Abschluss. Ein gespeicherter
Strich bleibt nach Neustart erhalten, die lokale Rücknahmehistorie nicht.

Dies liefert direktes Malen/Kamerabedienung, keinen vollständigen Hex-Paritätsnachweis.
Installationseigener editierbarer Biomkatalog und Kopplung mit Kreaturenfiltern
bleiben eigene größere Produktarbeit; native Großwelt-/Touchqualifikation offen.

## Gemeinsame passive Kartenkamera (0.131, 15.10.2026)

Dungeonraster und Hexkarte verwenden `PassiveMapCanvas` für Viewbox, mittleres
Ziehen, Mauszeigerzoom und passive Fehler-/Leerzustände. Die Komponente kennt
weder Hexkoordinaten noch Räume, Reisebefehle, Speicherregeln oder Kartentypen.
Beide Adapter zeichnen ihre Geometrie, Labels, Relationen und Tokens in denselben
SVG-Wurzelknoten, an dem auch ihre sichtbaren Treffer hängen. Sie interpretieren
rohe Szenenpunkte selbst. SVG benötigt unter der bestehenden CSP weder WebGL
noch dynamische Codeauswertung.

Die Hexkamera verschiebt sich jetzt kontinuierlich statt auf ganze Hexes zu
springen; der Adapter leitet nur die sichtbare Nachlade-/Zeichenregion daraus
ab. Rasterwechsel bleibt eine ausdrückliche Autorenentscheidung. Mausrad und
Kameratasten speichern keine offene Hexeingabe. Im Dungeon bleiben Auswahl,
bestätigte Kontur-/Keyänderungen und Layoutwechsel im gewählten Ausschnitt;
Einpassen beziehungsweise Übersicht sind ausdrückliche Navigation. Mittleres
Ziehen legt auch bei aktivem Zeichenwerkzeug keine Geometrie an. Ein unterbrochener Hexpinselzug bleibt wie oben beschrieben ein ungespeicherter
Entwurf; Kameragesten bestätigen ihn nicht. Die gemeinsame Kamera erhält ihre
kontinuierliche Position auch bei Alt+Pfeiltasten.

Ein Fehler während des Zeichnens erhält die letzte vollständige Szene, sperrt
ihre Treffer und zeigt einen lokalen Hinweis mit „Karte erneut zeichnen“.
Navigation und Autorenfakten bleiben erhalten. Die Wiederholung baut die
aktuelle Szene neu auf, ohne zweite Pointerhandler oder einen anderen
Kampagnenstand. Eine leere Szene benötigt keine erfundenen Hexes oder Räume.

`tests/desktop-passive-map-canvas.test.mjs` prüft Kamera, Szenen-/Leerzustände und
lokale Wiederholung; die bestehende Reise-DOMprüfung prüft offene Ziel-/Hexdaten
bei Zoom und Reset. Physische Treffer-/Dragabnahme erfolgt zusätzlich am
Desktop. Ein vollständig nahtloser Atlas aller Karten, alle weiteren Canvas-
Adopter sowie die große Sichtregion-/Performanceabnahme bleiben offen. Diese
Lieferung behauptet keine vollständige Wonderdraft-/Dungeonqualifikation.
