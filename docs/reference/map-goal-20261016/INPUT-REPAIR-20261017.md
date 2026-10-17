# Tatsächlicher Tavernenablauf und reparierter Export

Am 17.10.2026 wurde die globale Eingabesperre behoben und der folgende Teil der GM-Aufgabe tatsächlich über die Oberflächen ausgeführt. Dieser Nachweis ersetzt weder den vollständigen Kampagnenvergleich noch Live-/Spielerausgabe- und Nutzerabnahme.

## Eingabesperre

Ein globaler Electron-Bestätigungsdialog einer geöffneten Improved-Initiative-Seite („Remove NPCs and encounter?“) lag über dem Codex-Fenster. Die einzelnen Browser-Tabs zeigten ihn in ihren DOM-/AX-Ansichten nicht. Die vom Nutzer ausdrücklich geforderte native Linux-Diagnose machte ihn sichtbar; fenstergebundenes Escape brach ihn ab. Danach erreichten vertrauenswürdige Pointer-/Klickereignisse beide Werkzeuge und der Kampagneneinstieg funktionierte. Keine NPC-Löschung wurde bestätigt. Vorübergehende passive Eingabediagnostik ist aus dem QA-Build wieder entfernt. Der separat abgewiesene interne Fehlerseiten-Tab wurde nicht automatisiert.

## Tatsächlich ausgeführte Aufgabe

SaltMarcher lief mit kanonischem Renderer, Preload, Desktop-Handlern, SQLite und beiden kanonischen Workern im isolierten Loopback-QA-Host. Browsertransport und native Dateidialoge sind Host-Shims; daraus folgt keine Qualifikation der gepackten Electron-Anwendung. Reguläre CampaignWorkbench-Daten blieben unverändert.

In der vorhandenen synthetischen Kampagne „Gemeinsamer Atlas · Region und Marktviertel · QA“ wurde die Taverne „Zum Silbernen Ast“ über die Atlassuche geöffnet. Zum Schankraum kamen ein Lagerraum und eine offene, benannte Tür mit beiden Raumbindungen hinzu. Rückkehr zum Haus erhielt Hausnotiz, Position/Drehung und Schutz. Nach vollständigem Neustart des eigenen Hosts und Browser-Neuladen waren beide Räume, Tür und Notiz erneut vorhanden. Nach den Korrekturen wurde derselbe Haus-/Innenraum-/Exportablauf wiederholt.

In Dungeon Scrawl wurden ein umschlossener Grundriss, Trennwand, Tür und die beiden Raumnamen tatsächlich gezeichnet und als PNG heruntergeladen. Eine lokale bearbeitbare `.ds`-Datei wurde noch nicht gespeichert und frisch geöffnet: Der native KDE-Speicherdialog wurde abgebrochen. Keine Anmeldung, Vertragsannahme oder Veröffentlichung fand statt.

## Beobachtete Friction und Korrekturen

| Beobachtung | Änderung / Nachprüfung |
| --- | --- |
| SaltMarcher meldete am Haus „0 ausdrücklich angelegte Räume“, obwohl zwei kanonische Räume existierten. | Der Inspektor zählt die Räume im gebundenen Atlas-Innenraum. Sichtbarer Nachtest: „Innenraum angelegt · 2 Räume“. |
| Der Hausinspektor bot nochmals eine leere Innenraumhülle an. | Seine Aktion verwendet denselben kanonischen Öffnen-/Anlegen-Ablauf. Rückkehr, erneutes Öffnen und frische Aktivierung erhalten denselben Scope ohne Duplikat oder erneuten Schreibvorgang. Der zusätzliche Öffnen-Button verschwindet im bereits geöffneten Innenraum. |
| Der erste SaltMarcher-PNG-Export drehte Raumnamen mit dem Haus und überdeckte den Grundriss mit riesiger Hausbeschriftung. Dungeon Scrawl lieferte im gleichen Bildablauf lesbare Namen. | Karte und GM-Export verwenden gemeinsame, außerhalb der gedrehten Geometrie projizierte Raumbeschriftungen. Der Export hält deren visuelle Größe und begrenzt Stadtbeschriftungen; der aktive Innenraum erhält keine Hausbeschriftung darüber. Derselbe PNG-Export wurde erneut ausgeführt und das Ergebnis visuell geprüft. |
| Dungeon Scrawl benötigt ein eigenes Textobjekt je Raum; Verschieben am Textkörper wählt Zeichen aus, am Begrenzungsrahmen funktioniert es. | Tatsächliche Vergleichsbeobachtung. SaltMarcher verwendet die kanonischen Raumnamen automatisch. Keine pauschale Überlegenheit abgeleitet. |
| Die Tür an der gemeinsamen Wand erhielt zunächst nur eine Raumbindung. | Zweite Bindung wurde manuell im Formular gesetzt. Automatisches Erkennen beider Räume und die tatsächliche Reise durch diese Tür bleiben offen. |

## Belege

- [Hausinspektor nach Rückkehr](input-repair-20261017/house-room-count.png)
- [SaltMarcher-Export vorher](input-repair-20261017/saltmarcher-export-before.png)
- [SaltMarcher-Export nachher](input-repair-20261017/saltmarcher-export-after.png)
- [Dungeon-Scrawl-Ausgabe](input-repair-20261017/scrawl-tavern.png)

Die gezielten Controller-/SQLite-Fälle prüfen kanonische Raumzahl, bestehende und neue Innenräume, Rückkehr/frische Aktivierung, horizontale exportierte Namen und Nummern sowie unveränderte öffentliche Landschaftsprojektion. Der vollständige City-Lauf vor der letzten Fixture-Korrektur hatte 55 Erfolge und einen Fehler im neuen Testaufbau: Die zweite Fixture-Stadt war noch nicht im Atlas gebunden. Nach deren expliziter Bindung bestehen die vier relevanten Fälle. Typprüfung und QA-Build werden separat erfasst; die Pflicht-CI qualifiziert ausschließlich ihren exakten veröffentlichten SHA.

## Nächste tatsächliche Schritte

Fokusgruppe anlegen, den vorbereiteten Innenraum im Live-Atlas nutzen, Sicht versus Erinnerung und die Reise durch die Tür prüfen. Separates Spielerfenster ausblenden und eine frische öffentliche Ausgabe auf GM-Leaks prüfen. Bearbeitbare Speicherung/frisches Öffnen im Vergleichswerkzeug und ein geeigneter vollständiger Stadt-/Atlas-/Leitungs-Vergleich bleiben erforderlich. Die beobachtete Beschriftungsüberlagerung nach Rückkehr in die kleine Hausansicht bleibt als weiterer visueller Nachtest erhalten. Der kontinuierliche Goal bleibt pausiert; die ausdrückliche Nutzerabnahme bleibt offen.
