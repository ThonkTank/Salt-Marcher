# SMR-10: Extension- und Capability-Grenze

Stand: 14. Oktober 2026. Normative Quelle: [Program Capability Requirements, fixierter Stand](https://github.com/ThonkTank/Salt-Marcher/blob/9de85c1a26f526acbc1af332ac5962e185c0aab2/docs/project/requirements/requirements-program-capabilities.md#modular-change-and-third-party-extensions).

## Heutiger ausführbarer Umfang

Die Desktop-App kann ein lokales JSON-Paket bis 1 MiB prüfen und ausdrücklich installieren. Manifest, Paketbytes, Hash, Generation, Revision und die bestätigten Rechte `ownedUnits.read` und `ownedUnits.write` liegen installationweit in `settings`. Installation, Widerruf und Entfernen sind revisionsgeschützte, idempotente SQLite-Transaktionen mit Receipt. Entfernen löscht gespeicherten Code und Rechte, nicht aber kampagneneigene `campaign_capability`-Bytes.

Extensioncode wird heute nicht ausgeführt. Es gibt daher noch keinen ehrlichen Nachweis für neue Inhaltsarten, Runtime-Masken, Generatoren, Importer oder Präsentationen und keinen geschützten Runtime-Sink. Netzwerk- und freie Dateirechte existieren nicht und werden nicht stillschweigend durch die beiden heutigen Rechte ersetzt. SMR-AC-16 bleibt offen.

## Aktuelle Daten- und Fehlerregeln

- Jeder Schreib- und Outcome-Auftrag besitzt eine exakte bekannte Struktur. IDs, Revisionen, Vorschauticket, Pakethash und Rechte werden vor Receiptzugriff oder Mutation geprüft.
- Ein beschädigter Installationseintrag erscheint als isoliertes Listenproblem. Ein vollständiges Installationsbackup darf ihn nicht als sichere Kopie veröffentlichen.
- Ein Campaignexport enthält keine installationweiten Pakete oder Grants. Er validiert die Campaigndaten unabhängig, entfernt Installationseinstellungen und bleibt deshalb auch bei einem beschädigten Extensioneintrag möglich.
- Opaque `campaign_capability`-Bytes, Codecname, Version und Referenzhülle bleiben bei Widerruf, Entfernen, fehlender Installation, Campaignexport/-import und späterer Neuinstallation erhalten. Erst ein zukünftiger passender Codec darf sie wieder interpretieren.
- Unbekannte oder beschädigte Capabilitybytes werden nie durch Kerncode umgeschrieben. Checksumme und lesbare Referenzhülle sind Teil der Campaign-Backup- und Importgrenze.

## Nächster Runtime-Schnitt

Der erste echte Consumer braucht einen kleinen Hostport für genau einen `way-note:1`-Unit-Typ. Vor jedem Read oder Write prüft der Host die aktuell installierte Generation und den aktuellen Grant; eine frühere Zustimmung oder ein geladener Renderer reicht nicht. Der Host validiert die betroffenen Unit-IDs, schreibt nur extensioneigene Bytes atomar und erzeugt keine Kernobjekte außerhalb eines ausdrücklich bestätigten Sink-Commands.

Die erste Laufzeitabnahme muss Installation und Offenlegung, Unit-Anlage, Fresh, Grant-Widerruf, fehlendes/inkompatibles Paket, unabhängige Campaignbearbeitung, vollständigen Campaigntransfer und Wiederherstellung mit derselben Unit umfassen. Fehler oder Entzug sperren nur den Consumer. Die App bleibt bedienbar, die Bytes bleiben exportierbar, und ein später kompatibler Ersatz liest sie wieder. Paket-Renderer benötigen vor Aktivierung zusätzlich eine belastbare Isolationsentscheidung; eine Host-Webview oder Obsidian-Pluginumgebung gilt nicht automatisch als Sandbox.

## Offene Bediengrenze

Der Renderer hält einen noch nicht bestätigten Installationsauftrag derzeit in `localStorage`. Beschädigte Wiederaufnahmemetadaten brauchen einen eigenen fail-closed Ablauf: erst den aktuellen Installationsstand erfolgreich lesen, dann den unveränderten beschädigten Vermerk sichern und ausdrücklich zurücksetzen. Bis dieser Ablauf integriert und getestet ist, ist Crash-Recovery der Installationsoberfläche keine vollständige Extensionabnahme.
