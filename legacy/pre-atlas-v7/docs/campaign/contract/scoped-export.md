# Kampagnenexport und isolierte lokale Erweiterungen

Status: Geltender Fachvertrag; offene Erweiterungen sind als Ziele beschrieben.
Owner: campaign
Last Reviewed: 2026-10-24 (Struktur und Quellen; Fachabnahme separat)
Source of Truth: Dieses Dokument besitzt das benannte Thema; Code belegt den Iststand, das Abnahmeregister den Prüfstand.

Stand: 14.10.2026. Ergänzt den
[Campaign-/Datenvertrag](archive.md)
und den [vollständigen Produktumfang](../../project/requirements/scope.md).

## Fachliche Grenze

Program Capabilities, Revision `9de85c1a26f526acbc1af332ac5962e185c0aab2`,
„Modular Change And Third-Party Extensions“ (L754–772), verlangen explizite
Installation/Rechte, isolierten Ausfall und erhaltene Capabilitydaten. Eine
beschädigte oder fehlende Erweiterung darf unabhängige Kampagnenabläufe nicht
verhindern. Die Datei wurde gegen den Quellenregisterhash
`714051ef2b72a5aa0a791c0b3bf8c6fffaa7e381f3b72d86222190089a1cfd2e` geprüft.

Installation, ausführbare Paketbytes, Grants und Installationsreceipts sind
lokale Hostentscheidungen. `campaign_capability` ist Kampagneninhalt und bleibt
auch bei fehlendem Provider im Export erhalten. Import übernimmt keine lokalen
Rechte oder Aktivierung. Ein vollständiges Datenbankbackup umfasst dagegen
auch die lokalen Hostrecords und benötigt deren vollständige Integritätsprüfung.

## Befund und aktueller Code

`CampaignStore.campaignSnapshot` benutzte zunächst `backup`, das die gesamte
Datenbank validiert. Erst danach wurden fremde Kampagnen und lokale Settings
entfernt. Drei Gegenproben scheiterten dadurch: gesunder Kampagnenexport bei
beschädigter Installation, beschädigtem Installreceipt oder beschädigter anderer
Kampagne. Die für den Export ausgeschlossenen Daten blockierten den Kernablauf.

Der Snapshotweg kopiert jetzt zunächst in einen eigenen unveröffentlichten
Kandidaten, prüft den ursprünglichen Lifecyclefence, beschränkt ihn mit
`pruneCampaignSnapshot` und prüft anschließend die vollständigen verbleibenden
Daten. Erst nach geschlossenem SQLitehandle, Dateisynchronisierung und erneutem
Quellfence wird er atomar veröffentlicht; anschließend wird das Verzeichnis
synchronisiert. Kandidat und Sidecars werden bei Fehlern entfernt. Die Quelle
wird weder korrigiert noch gelöscht. `backup` behält seine vollständige Prüfung
und die globale Erasuregrenze.

`tests/campaign/desktop-campaign-export-isolation.test.mjs` prüft sechs SQLitefälle:
beide defekten lokalen Extensionrecordarten, unabhängigen Export neben einer
beschädigten anderen Kampagne, beschädigten ausgewählten Inhalt, Quelllöschung
während der Kopie und beschädigte ausgewählte Capabilitybytes. Gesunde opaque
Bytes bleiben im unabhängigen Import exakt erhalten; lokale Installationen und
Rechte fehlen dort. Zurückweisung vor Veröffentlichung erhält den vorherigen
Snapshot und die Quelle.
Zusammen mit Installations-/DOM- und Campaignintegritäts-/Annahmeprüfungen:
88 gezielte Prüfungen und Desktop-Typecheck bestanden. Das ist kein Nachweis
für einen laufenden Extensionprovider, vollständige Medientransfers, Hard-Crash,
Dateisystem-Durabilität unter Stromverlust oder die erforderlichen Plattformen.

## Erhaltene Referenzmetadaten ohne Provider

Der allgemeine Core-Remapper interpretierte auch `campaign_capability.references_json`:
`token` wurde durch einen Aktivierungstext ersetzt, serialisierter `payload` als
Core-JSON geöffnet und ein begleitender `checksum` neu berechnet. Bei fehlendem
Provider gibt es keine fachliche Autorität für diese Umdeutung. Drei Copyproben
zeigten tatsächlich geänderte Metadaten trotz unveränderter Bodybytes.

`campaign-data.walkCapabilityReferences` verwendet nun für Ermittlung und
Umschreibung ausschließlich die vorhandenen Legacy-Referenzslotnamen. Bekannte
IDs und Listen werden weiterhin auf lokale bzw. gemeinsame Kopieziele gebunden.
Providerzeichenketten und bestehende opaque Payload-/Config-/Medien-/
Quellfelder bleiben opaque: kein Öffnen eingebetteter JSONstrings,
kein Tokenersatz, keine Neuberechnung darin enthaltener Prüfsummen und keine
automatisch eingefügten Core-Historienaliasfelder. Ein weiterer Gegenbefund
zeigte solche Aliasergänzungen in opaque Objekten bei Definitionskonflikten. Der
Core-Remapper für eigene Records bleibt unverändert. Bodybytes/Bodychecksum,
Quellstore und Quellpaket werden nicht geändert.

`desktop-extension-reference-transfer.test.mjs` prüft die drei Gegenbeispiele
sowie opaque Objekt-/Quellmetadaten und einen Definitionskonflikt über Export, unabhängige Annahme und Fresh, einschließlich wirklich vorhandener
kopierter Raumziele und fehlender lokaler Installation. Mit bestehenden
Campaignintegritäts-/Export- und Installations-/DOMproben bestehen 63 gezielte
Prüfungen. Das ist Originalschutz am Legacyadapter, keine Qualifikation seiner
beliebigen Slotsemantik oder eines ausgeführten Providers. Vorhandene Records
werden weder migriert noch zu einem geprüften neuen Unitformat erklärt.

## Ursprüngliche Ursache beim Paketfehler erhalten

`desktop/zip-files.ts.readArchive` ließ nach einem fehlerhaften Manifest weitere
ZIP-Einträge dieselbe Fehlerstelle ersetzen. Ein eigentlicher Metadatenfehler
erschien dadurch als nicht deklarierter Eintrag. Der Reader bewahrt nun die erste
Ursache über Decoder- und Streamcallbacks hinweg; nach Fehler werden keine
weiteren Ausgabestreams eröffnet. Dateigröße und Prüfsumme besitzen eigene
Meldungen, fehlende deklarierte Dateien werden als unvollständiges Archiv erklärt.
Die bestehende Bereinigung und Veröffentlichungssperre bleiben wirksam.

Zwei Gegenproben in `desktop-archive-error.test.mjs` prüfen ursprüngliche
Metadaten-/Prüfsummenfehler vor einem nachfolgenden nicht deklarierten Eintrag sowie
bereinigte eigene Stagingordner. Bestehende Audio- und Campaignpaketprüfungen
prüfen die gemeinsamen Verbraucher. Das qualifiziert die Fehlerursache lokal;
Cancel-/Crash-/Publish-Durabilität und Plattformabnahmen bleiben eigene Ziele.

## Nächste konkrete Lieferungen

1. **Konkrete Unit vor Providerzugriff schließen.** Ein eigener versionierter
   Wegnotizvertrag in `extension-contracts.ts` und `storage/extension-units.ts`
   muss Package-/Codecbindung, Unit-/Campaignidentität, Revision, Bodyhash und
   typisierte Referenzslots gemeinsam binden. Der Ort ist ein benannter lokaler
   Slot; Titel, öffentlicher Text und GM-Notiz bleiben Inhaltsfelder. Im Body
   genannte kanonische IDs verleihen keinen Zugriff. Erst der Core prüft, ob der
   deklarierte Ort zur aktiven Kampagne gehört. Neue Units bekommen einen
   ausdrücklichen Formathinweis; vorhandene `campaign_capability`-Records bleiben
   unverifizierte Legacydaten. Reader, Writer, Backup, Copy und Erasure müssen
   dieselbe konkrete Closure kennen. Copy remappt ausschließlich deklarierte
   Slots und erstellt die neue Gesamtbindung; opaque Bodybytes bleiben exakt.
   Kleinste Abnahme: gültige Wegnotiz, geänderter Header/Slot bei gültigem
   Bodyhash, fremder Ort, fehlender Codec nach Fresh sowie unabhängige Kopie.
   Fehler erhalten die Originalunit und sperren nur deren operativen Zugriff.
2. **Provider und Rechtebroker anschließen.** `storage/extensions.ts` und die
   privilegierte Hostgrenze benötigen vor jedem Unitread/-write die aktuelle
   Package-/Grantgeneration, den Kampagnencontext und eigene Unitowner. Die erste
   Installation allein bietet noch keinen operativen Codec oder ausgeführten
   Provider. Bekannte Referenzslots vor Transfer/Erasure definieren; private und
   öffentliche Invocations trennen. Widerruf/Replace sperren auch verzögerte alte
   Antworten vor einer Wirkung. Fehler deaktivieren nur den betroffenen Provider.
   Kleinste Abnahme: eigene Wegnotiz anlegen, Fresh, Widerruf während laufendem
   Auftrag, fremdes Ziel ablehnen und Originalbytes bei fehlendem Codec bewahren.
3. **Abschluss des Datenwegs prüfen.** Hostexport/-import mit Audio und Playerart,
   Cancel, Fullcopy/Subset und unabhängiger Annahme gegen dieselbe Scope-/Fencegrenze
   prüfen. Unterbrochene eigene temporäre Kopien beim Start bereinigen, ohne fremde
   Dateien zu berühren. Verlust der Antwort vor/nach Publish muss gezielt lesbar
   geklärt werden; keine automatische Wiederholung oder Rechteübernahme. Ein
   Fehler nach Rename, aber vor bestätigtem Verzeichnissync, ist ein ungeklärter
   Ausgabestand; das tatsächliche Ziel muss gelesen werden.
4. **Reale Fehler- und Plattformabnahme.** Schreib-/Rename-/Syncfehler,
   fehlenden Speicherplatz und kontrollierten Prozessabbruch am fertigen Paketweg
   prüfen. Linux-/Windows-/macOS-Dateisysteme und die native Bedienung bleiben
   eigene Nachweise. Ein vorhandener gültiger Export wird vor verifiziertem
   Kandidaten nicht ersetzt; Backuppass und Produktvollständigkeit bleiben getrennt.
