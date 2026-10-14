# Passive Spielerprojektion und große bekannte Karten

Stand: 14.10.2026. Ergänzt den [Player-/Extensionanschluss](../../../ROADMAP-SALTMARCHER-REPLACEMENT.md#smr-10--zweites-display-extensions-und-vollständige-portabilität)
und den [Gesamtumfang](../../SCOPE.md).

## Vertrag und gegenwärtiger Anschluss

Die gepinnten Program Capabilities, Revision
`9de85c1a26f526acbc1af332ac5962e185c0aab2`, L289–302 und L388–406, verlangen
eine passive Anzeige für Karten und NPC-/Ortsart. Sie folgt der fokussierten
Scene, kombiniert dauerhafte Characterkenntnis und aktuelle Wahrnehmung und
bleibt durch GM-Blank/Override kontrollierbar. Erzähltexte, Mechanik und private
Notizen gehören nicht in diesen Anzeigekanal. Der lokale Quellenhash entspricht
`714051ef2b72a5aa0a791c0b3bf8c6fffaa7e381f3b72d86222190089a1cfd2e` im Register.

`storage/player.ts` komponiert die freigegebene Projektion. Der Host und die
getrennte Player-Session bieten eigene Ressourcen-/IPCgrenzen;
`player-display.ts` und `player-render.ts` zeigen das öffentliche Paket.
Bestätigte Hex-/Ortskenntnis behält ihre damaligen Fakten; beschädigte oder
fehlende Erinnerung wird nicht aus neuer GM-Wahrheit rekonstruiert. Bestehende
Host-/native Teilbelege bleiben auf ihren damaligen konkreten Umfang begrenzt.

## Zwei behobene Grenzen

**Große Karten.** Der Renderer übergab sämtliche bekannten Koordinaten als
Argumente an `Math.min`/`Math.max`. 150.000 bekannte Hexe und 160.000 Eckpunkte
aus 2.500 Dungeonpolygonen lösten jeweils `Maximum call stack size exceeded`
aus. Die Grenzberechnung arbeitet jetzt mit vier laufenden Extremwerten und
braucht weder eine geflattete Polygonpunktliste noch zusätzliche Koordinaten-
und Achsenarrays. Position, negative Koordinaten und bisheriges Padding bleiben
erhalten. Weder Wissen noch Geometrie werden abgeschnitten.

Vier Prüfungen in `desktop-player-render-bounds.test.mjs` führen den realen
Renderer mit einem schlanken DOM-Ersatz aus. Dieser behält keine 150.000 Knoten
im Speicher. Das belegt Berechnung und Durchlauf, nicht SVG-/GPUleistung oder
native Latenz. Der eigentliche Pfad-/DOMaufbau und die Projektion wachsen
weiterhin mit dem bekannten Kartenausschnitt.

**Prosa im passiven Paket.** `dungeonDisplay` liefert einen reicheren
Wahrnehmungsstand mit Keybeschreibung und gehörten Hinweisen. Die Spieler-
projektion reichte diesen vollständig weiter; der Renderer erzeugte daraus
Absätze. Zwei Gegenproben bestätigten die Abweichung vom Anzeigekanal.
`projectPlayer` übernimmt jetzt ausdrücklich nur Position, Geschosslabel,
bekannte/sichtbare Geometrie, freigegebene Kartenlabels, Marker und Spuren.
`PlayerFrame.dungeon` schließt `description` und `clues` aus. Der Renderer
ignoriert diese auch in einem älteren Paket. Autorenbytes und interne
Wahrnehmungsprosa bleiben erhalten; die Korrektur benötigt keine Migration.

Zwei Prüfungen in `desktop-player-dungeon-projection.test.mjs` belegen die reale
SQLite-Projektion ohne diese Felder und deren fehlende Darstellung in Linkedom.
Mit Größen-, Knowledge- und GM-Dialogprüfungen bestanden 44 lokale Tests und
der Desktop-Typecheck. Eine vollständige Player-/Privacy-/Plattformabnahme
folgt daraus nicht.

## Integrierte Kampf- und Verfolgungsanzeige

`storage/player.ts` projiziert inzwischen aktive Kampf- und Verfolgungsmasken
vor der Kartenansicht. Der Vertrag und Renderer besitzen dafür explizite
öffentliche Felder; GM-Blank und Bildoverride behalten Vorrang. Combat zeigt
Initiative, aktuellen Zug und öffentliche Gesundheits-/Zustandswerte; private
freie Kampfnotizen bleiben durch `publicCombatConditionText` ausgeschlossen.
Chase zeigt Runde, Seiten, Abstand, Tempo und Erschöpfung. Verborgene NPCs,
GM-Ziel-/Komplikations-/Ergebnisprosa und Teilnehmernotizen gelangen nicht in
dieses Paket. Die neuen Varianten dürfen weder Dungeonprosa wieder einschließen
noch die iterative Grenzberechnung großer Karten durch Argumentlisten ersetzen.

`tests/core/player-chase-projection.test.ts` und
`player-combat-projection.test.ts` prüfen die Storeprojektionen. Der integrierte
Chase-Editor bewahrt weiterhin Masken-/Sceneautorität, Pending-Sperren und
Rundenvorschläge. Eine zusätzliche tatsächliche Store-/DOMprobe in
`desktop-chase-switch.test.mjs` bestätigt die NPC-Sichtbarkeitsänderung ohne
Verlust des Rundenvorschlags; ein Handler der zuvor gewählten Maske bleibt nach
Wechsel wirkungslos. Native Mehrmonitor-/Fokus-/Neustartbedienung dieser beiden
Anzeigevarianten ist dadurch noch nicht qualifiziert.

## Nächste ausführbare Schritte

1. **Bounded Query und Darstellung gemeinsam liefern.** `projectPlayer`,
   `dungeonDisplay`, der Playervertrag und Renderer lesen/zeichnen noch gesamte
   bekannte Ausschnitte. Scene-Position und einen fachlich definierten sichtbaren
   Kameraausschnitt gemeinsam binden; Knowledge außerhalb des Ausschnitts bleibt
   gespeichert. Nur nötige Geometrie/Details holen und große SVGpfade/Knotenmengen
   begrenzen. Abnahme: viele entfernte bekannte Orte, Fokuswechsel und denselben
   Ausschnitt nach Fresh; keine neue GM-Wahrheit in ungesehenen Bereichen.
2. **Öffentliches Paket vollständig prüfen.** Für jede tatsächlich gelieferte
   Hex-/Dungeon-/Bild-/Combat-/Chasevariante eine explizite Feldfreigabe und negative Payload-
   Gegenproben verwenden. Labels müssen ausdrücklich freigegebene Kartenlabels
   sein; Beschreibung, Secrets, private Notiz-/Mechanikfelder und lokale Pfade
   dürfen nicht durch weitere verschachtelte Felder zurückkehren. Bestehende
   Owner-/Session-/Assettests konsumieren; kein zweiter Wahrnehmungsstand.
3. **Native Wirkung messen.** Echte begrenzte Player-Session mit großer Geometrie,
   Scenewechsel, Blank, Bild-/Decoderfehlern und Neustart prüfen. CPU-/RAM-
   Verbrauch und Latenz am realen Host messen; danach physische Monitorwahl,
   DPI, Fullscreen und Linux/Windows/macOS qualifizieren. Der schlanke DOM-
   Ersatz ist kein Nachweis dieser Ergebnisse.
