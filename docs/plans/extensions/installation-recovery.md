# Erweiterungsinstallation: erhaltene Rechte und Wiederaufnahme

Stand: 14.10.2026. Ergänzt [SMR-10](../../../ROADMAP-SALTMARCHER-REPLACEMENT.md#smr-10--zweites-display-extensions-und-vollständige-portabilität) und den [Gesamtumfang](../../SCOPE.md).

## Wiederaufnahme der Installation

Die Program Capabilities L754–773 verlangen ausdrückliche Rechteannahme,
identifizierte Fehler und erhaltene Daten; eine defekte Erweiterung darf die
Campaign nicht blockieren. Gebundene Revision
`9de85c1a26f526acbc1af332ac5962e185c0aab2`, Quellenhash
`714051ef2b72a5aa0a791c0b3bf8c6fffaa7e381f3b72d86222190089a1cfd2e`.
Der folgende Anschluss schließt eine konkrete lokale Wiederaufnahmelücke des
Installers, nicht den noch fehlenden operativen Erweiterungsvertrag.

`extensions-ui.ts` hält den unbekannten Writeausgang als lokalen
`extension-pending-write`-Vermerk. Zuvor gab kaputtes JSON neue Writes frei;
syntaktisch gültiges JSON mit fehlenden Commandfeldern sperrte dagegen alle
Paketaktionen dauerhaft, weil auch der Outcome-Reader es ablehnte. Die bloße
JSON-Syntax lieferte keine verlässliche Wiederaufnahmebasis.

`checkedExtensionCommand` in `extension-contracts.ts` prüft jetzt die geschlossene
Command-/Aktionsstruktur, Installationsticket, Hash, Revision, Paketidentität und
bekannte Rechte. Derselbe Prüfer gilt beim Lesen des lokalen Vermerks sowie vor
Execute und Outcome in `storage/extensions.ts`. Er erteilt keine Rechte:
Ticket-/Bytebindung, exakte Zustimmung, aktuelle Installation und Revision
bleiben im Registrywriter geprüft. Aufträge mit Extrafeldern werden vor einer Receiptantwort abgewiesen,
auch wenn ihre eigentliche Aktion einem früheren Auftrag gleicht.

Gültige unbekannte Commands bleiben für die schreibfreie Outcomeprüfung
gesperrt; es gibt keinen automatischen Retry und keinen Resetbutton für diese
Commands. Ein bestätigter damaliger Receipt ist Ergebnisnachweis des damaligen
Auftrags, keine heutige Grantgeneration. Die Liste liest den aktuellen Stand;
spätere Widerrufe werden durch alte Receipts nicht rückgängig gemacht.

Beschädigte Vermerke sperren Writes und zeigen eine ausdrückliche Reparatur.
Erst nach einem erfolgreichen aktuellen Listenread lässt „Wiederaufnahme
zurücksetzen“ den exakten ursprünglichen String unter einem separaten lokalen
`extension-damaged-write:<uuid>` erhalten und entfernt den defekten aktiven
Vermerk. Der Writer wird dabei nicht aufgerufen; Installationen, Grants,
Receipts und Campaigndaten bleiben gleich. Ein Speicherfehler lässt die Sperre
und den ursprünglichen Vermerk bestehen. Ein inzwischen geänderter Vermerk wird
nicht überschrieben; erneutes Öffnen liest ihn neu. Fehlgeschlagener Speicherread
sperrt ebenfalls und lässt sich nach Wiederverfügbarkeit durch Öffnen erneut
prüfen. Die gesicherten Vermerke gehören zum lokalen GMprofil, nicht in
Campaigntransfer oder Packagecode. Kein stilles Quarantänelöschen beim Reset.

Zehn Fälle in `tests/desktop-extension-recovery.test.mjs` benutzen den echten
Store und die tatsächliche GM-DOMsteuerung: kaputtes JSON, falsche Struktur und
`null`; Originalerhalt/Reset ohne DBwirkung und anschließender Widerruf;
Schreib-/Lesefehler des lokalen Speichers; gültige unbekannte sowie bestätigte
Writes ohne erneuten Execute; defekter Command gegen ein bestehendes Receipt;
fehlende aktuelle Liste und zwischenzeitlich geänderter Vermerk. Die ergänzenden
bestehenden Installations-, DOM- und Referenztransferproben halten Preview-,
Hash-, Zustimmung-, Generations-, Byte-/Copy-/Backupgrenzen getrennt.
Diese lokalen Belege qualifizieren keine native Restart-/Tastaturabnahme und
keinen Extensionbroker, Unitcodec, Renderer oder öffentlichen Datenzugriff.

## Nächste ausführbare Lieferung

**Gespeicherte Wegnotiz vor operativem Zugriff:** Als nächste vertikale Lieferung
zunächst genau eine gespeicherte Wegnotiz mit dem bestehenden
`campaign_capability`-/Campaignownerregister verbinden. `extension-contracts.ts`
definiert den konkreten geschlossenen Unitwert; ein kleiner eigener Codec
prüft Form, Hash und benannte Ortsreferenz beim Read/Write/Backup. Draft und
bestätigte Unit besitzen getrennte Revisionsgrundlagen. Abnahme: Anlegen,
örtliche Bindung lösen/ändern, Fresh, Copy und Byteerhalt ohne verfügbaren
Provider; fehlendes Slotziel bleibt ausdrücklich ungelöst. Erst die geprüfte
gespeicherte Unit liefert den Eingang für den folgenden Broker.
 
Die konkrete Unit benötigt Package-/Codecbindung, Bodyhash und benannte
Referenzslots mit gemeinsamer Integritätsbindung. Vorhandene opaque
`campaign_capability`-Bytes bleiben erhalten; ein Neuverhaschen beweist keine
Legacyqualifikation. Danach den kleinen Broker an tatsächlichen Sender,
Campaigncontext, Packagehash und aktuelle Grantgeneration binden. Widerruf
vor Writerwirkung, A/B/A und fehlender Provider verlangen eigene Nachweise.
GM-/Publicinvocations benötigen getrennte Eingänge und Rechte; öffentliche
Providerresultate bleiben Vorschläge bis zur ausdrücklichen Playerfreigabe.
