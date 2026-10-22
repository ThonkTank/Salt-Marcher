# Autorenwelt mit Buchten, Inseln und Wald – 22.10.2026

Geprüfter Quellstand: `07a0b67488e410789cceb7b48cc0b85cf4b2778e`.
Normale Atlasoberfläche aus dem Repository; keine separate Kartenansicht.
[result.json](result.json) bindet elf Builddateien, beide Prozessstarts,
kanonische Bestände und acht Zwischenbilder. Die spätere Versionsanhebung auf
0.186.0 ändert diesen Lauf nicht rückwirkend in eine Paketqualifikation.

## Ablauf und Ergebnis

Leere Kampagne mit Meereshöhe null; die Geometrie entsteht durch echte
Bediengesten: Kontinente erhöhen/absenken/aufrauen, in den westlichen Kontinent
zoomen, Hexgitter ausblenden, Buchten ausschneiden, vier Inseln und einen schmalen
Gebirgszug erhöhen, Wald mit seitlichen Ausläufern malen und lokal freihalten.
Danach ein unabhängiges politisches Gebiet benennen, auf 400 m zoomen, eine
Baufläche freihalten, drei Straßen und sechs Gebäude erzeugen. Einen Schankraum
benennen, normal schließen und in einem neuen Prozess wieder öffnen.

Der vollständige Lauf speicherte sechs Raumgruppen mit 95 Räumen, drei Straßen,
drei Bewuchsflächen und das Königreich Aster. Keine Stadtdokumente entstanden.
Die kanonischen Bestände waren nach Neustart gleich. Beide Prozesse schlossen
mit Code 0, verschwanden und meldeten keine Rendererfehler. Die Bilder wurden
auf allen acht Stufen visuell betrachtet. Die Karte ist **nicht gestalterisch
abgenommen**, und dieser kleine Autorenbestand ersetzt keine Vollweltlast.

Ein [erster Lauf](failed-first/failure.json) scheiterte am kleinen Freihalten-Zug:
kein Revisionsfortschritt, erhaltener Entwurf und roter Speicherstatus im
[Fehlerbild](failed-first/failure.png). Der zweite Lauf nach ergänzter
Fehlerdiagnostik bestand. Es gab keine Produktkorrektur dazwischen. Ein isolierter
kanonischer 100-m-Rechteckzug auf einer Datenbankkopie bestand ebenfalls.
**Sporadischer Fehler offen; Wiederholung gilt nicht als Behebung.** Der erste
Lauf wurde im Fehlerpfad beendet und ist kein normal abgeschlossener Native-Pass.
Das Autorenwerkzeug speichert künftig bei Fehlern auch den tatsächlichen
UI-Status mit Langtext, damit eine Revisionsassertion die Ursache nicht verdeckt.

## Visueller Vergleich

Referenz: [offizielle Sword-Coast-Karte von Wizards of the Coast, Mike Schley](https://media.wizards.com/2015/images/dnd/resources/Sword-Coast-Map_HighRes.jpg).
Die vollständige Referenz wurde heruntergeladen und betrachtet. Sie wird nicht
als Produktasset oder Kopie im Repository verteilt.

| Beobachtung | Eigenes Ergebnis | Offener Unterschied zur Referenz |
| --- | --- | --- |
| Kontinente/Küsten | Buchten und Inseln sind im [Kontinentbild](03-continental-relief.png) sichtbar | Große Kontur folgt weiterhin breiten runden Pinselzügen; Inseln kreisförmig; unterschiedliche Detailgrößen und Küstenzeichnung fehlen |
| Gebirge | Schmaler Höhenzug mit Stärke 6.500 m/s gemalt | Trotz hoher Form fast unsichtbar; keine lesbare Gebirgskette oder gestalterische Reliefhierarchie |
| Wald | [Flächen und Ausläufer](04-continental-forest.png) erkennbar | Einzelne überlappende Striche mit unterschiedlichem Ton; Kronenmuster auf Kontinentmaßstab zu grob, Übergänge unnatürlich |
| Königreich | [Name und unabhängige Grenze](05-kingdom.png) sichtbar | Flächenkomposition und Beschriftung noch schwach; keine überzeugende Hierarchie zu Naturmerkmalen |
| Siedlung | [Freie Geometrie](06-settlement.png) im Wald, keine rechteckige Stadtfläche | Häuser wirken verstreut; Eingänge/Zuwege und Straßen bilden kein zusammenhängendes Ortsbild |
| Innenraum | [Möbel, Wände, Türen und Raumname](07-building-room.png) lesbar | Kleine Schrift, wenig Materialcharakter; D&D-Raster und Geschosswechsel in diesem Lauf nicht geprüft |

Auch UI-Probleme bleiben: Die Kategorie „Stadt“ und Einordnungsfelder sind trotz
unabhängiger Geometrie sichtbar; die Welt wirkt mit dem anfänglichen groben
Hexgitter technisch. Nach Neustart zeigt die Maßbox wieder Hexinformationen.
Diese Beobachtungen sind keine neuen Nutzerwünsche, sondern Lücken zum bereits
beschriebenen gemeinsamen Atlas.

## Reproduzieren und aufräumen

In einer isolierten Arbeitskopie des obigen Quellstands, Node 22, Linux-GPU:

```sh
npm ci
npm run build:desktop
cp /pfad/zu/build-variant.mjs .build/build-world-authoring-coast-study.mjs
node .build/build-world-authoring-coast-study.mjs
QA_EVIDENCE_DIR=.build/world-authoring-coast-repeat python3 tools/ui-session.py timeout --signal=TERM 600s node .build/world-authoring-coast-study.mjs
```

[build-variant.mjs](build-variant.mjs) ergänzt den bestehenden
`tools/test-desktop-world-authoring.mjs` zur definierten Küstenkomposition.
Die Erweiterung ist ein eingefrorener Versuch, kein zusätzlicher Produktpfad.
Zufällige Gelände-/Bewuchssamen und zeitbasierte Sculptgesten bedeuten, dass
Bilder nicht pixelidentisch sein müssen. Die Originalprofile bleiben lokal
unter den in den JSON-Dateien angegebenen Cachepfaden erhalten. Es wurde kein
Nutzerprofil bearbeitet oder gelöscht. Der nächste Zyklus muss Reaktionszeit,
Relieflesbarkeit, natürliche Waldflächen und den sporadischen Schreibfehler
weiter untersuchen; kein sauberer Gesamtaudit wird angerechnet.
