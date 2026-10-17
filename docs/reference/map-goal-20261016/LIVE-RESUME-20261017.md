# Live-Atlas: Fortsetzung am 17.10.2026

Die synthetische Tavernenaufgabe wurde nach vollständigem Neustart des eigenen QA-Hosts fortgesetzt. Mira · Atlas-Probe, ihre Position im Lagerraum, bekannte Raumgeometrie und die vollständige Gruppenzeit **00:00:21** blieben erhalten. Die vorher tatsächlich ausgeführten Wege benötigten 6 s im Schankraum und 15 s durch die offene Tür zum Lagerraum. Die frische öffentliche PNG-Ausgabe vor Offenlegung des Lagers enthielt nur den bekannten Schankraum und Gruppenmarker; keine Hausnotiz oder unbekannten Raumdaten.

## Beobachtet, korrigiert, über dieselbe UI nachgeprüft

| Tatsächliche Friction | Änderung und Nachtest |
| --- | --- |
| Im frisch geöffneten Live-Bereich war „Karte“ deaktiviert. Erst „Reise“, dann „Karte“ öffnete die Karte. | „Karte“ öffnet den vorhandenen Reise-/Atlasbereich direkt. Tatsächlicher Kaltstart-Nachtest: ein Klick öffnet die bekannte Raumgeometrie mit Mira im Lagerraum. Wartende Speicherung respektiert einen neueren Klick auf „Szene“ und Kampagnenwechsel; kein zweiter Canvas entsteht. |
| Nach ungültiger PNG-Größe 128 blieb „Atlas-PNG gespeichert“ auch nach erfolgreichem 2048-Pixel-Export rot. | Statustext und Fehlerzustand werden gemeinsam gesetzt. Derselbe UI-Ablauf liefert nach ungültiger Größe, Korrektur und tatsächlichem Export „Atlas-PNG gespeichert“, `data-error=false`. Vorbereitung und Abbruch räumen den alten Fehler ebenfalls auf; ungeklärte Schreibvorgänge bleiben geschützt. |

## Separate Spieleransicht tatsächlich bedient

Im Spieleranzeige-Dialog wurde für die fokussierte Gruppe Tageslicht eingestellt und „Fokussierter Gruppe folgen und anzeigen“ ausgelöst. Ein zweiter Browser-Tab zeigte die echte passive Spieleroberfläche: helles aktuelles Sichtfeld durch die offene Tür, graue erinnerte Geometrie und Marker. Wechsel zu Dunkelheit entfernte das aktuelle Sichtfeld (`d=""`), während die erinnerte graue Geometrie blieb. Die SVG-Pfade bleiben als Elemente vorhanden; deren bloße Existenz ist deshalb kein Sichtnachweis. „Anzeige ausblenden“ entfernte anschließend alle Kinder der passiven Zeichenfläche; diese war schwarz und als `player-blank` markiert. Der GM-Status bestätigte das Ausblenden.

Der isolierte QA-Host kompiliert dafür den kanonischen Spieler-Preload und Renderer unverändert. Der Browsertransport liest nur den kanonischen `player:frame`-Handler mit eigener Spieler-WebContents-Identität; GM-Kanäle werden dort mit 403 abgewiesen. Polling, Fenstersteuerung und Dateidialoge bleiben Host-Shims. Das ist tatsächliche Zwei-Tab-UI-Evidenz, keine Qualifikation eines nativen Electron-Spielerfensters. Native Bildschirmaufnahmen nach Aktivierung der Desktop-Sperre waren schwarz beziehungsweise zeigten den Sperrbildschirm und werden ausdrücklich nicht als Spielerbelege gezählt. Die Browser-Screenshots wurden während des Ablaufs visuell geprüft.

## Vergleich und verbleibende Arbeit

Dungeon Scrawl hat denselben Zwei-Raum-/Tür-/Beschriftungs-/PNG-Ablauf bereits tatsächlich bestanden. Auch „Datei → Speichern unter“ führte zum nativen Speicherdialog; er wurde sicher abgebrochen. Keine bearbeitbare `.ds`-Speicherung oder frische Wiederöffnung behauptet. Der vollständige Stadt-/Regions-/Live-Gegenlauf bleibt erforderlich. Keine Anmeldung, Vertragsannahme oder Veröffentlichung erfolgte.

Als Nächstes: automatische zweite Raumbindung der Tür und überlagerte Beschriftung nach Hausrückkehr gezielt nachprüfen; anschließend bearbeitbare Vergleichsspeicherung und passenden Stadt-/Atlas-/Leitungsgegenlauf abschließen. Dunkelsicht und das gepackte native Spielerfenster sind separat offen. Der kontinuierliche Goal bleibt pausiert; die ausdrückliche Nutzerabnahme ist nicht erteilt.

## Technische Nachweise

57/57 Reise-/gemeinsame-Atlas-Fälle und 3/3 fokussierte Export-/öffentliche Fälle bestanden mit normalen Prozessenden. Frontend- und Desktop-Typprüfung, Repositoryprüfung, Desktop- und QA-Build bestanden. Main `b02e8d801` ergänzt ausschließlich gemeinsame Kreaturen-Statblock-CSS; ohne Konflikt integriert. Die Pflicht-CI qualifiziert den veröffentlichten Nachfolger separat. Kandidat `c8194665c` ist mit CI `38988804897` (3742 bestanden, 0 Fehler, 1 optional übersprungen) separat archiviert. Vollständiger Kampagnenvergleich und Nutzerabnahme folgen nicht aus diesen Prüfungen.
