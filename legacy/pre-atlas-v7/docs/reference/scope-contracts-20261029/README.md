# Fachlicher Umfangsabgleich · 29.10.2026

Status: Unvollständiger Zwischenstand; keine CITY-00-/HEX-00-/Produktabnahme.
Owner: project
Last Reviewed: 2026-10-29
Source of Truth: Datierter Untersuchungsbeleg; Fachverträge und Register besitzen Zielumfang und offene Abnahmen.

Untersucht wurden das vorhandene Register mit **65 CO-Stadtfällen**, **24 CTY-
Atlasfällen**, **36 WD-Gruppen/83 Varianten (79 Ausgangsproben und vier spätere Ergänzungen)**, ihre bestehenden gap-/Probeangaben
und die gebundenen Dungeon-/Autonomyquellen. Jeder CO-/WD-Fall erhielt im
**bestehenden** Register eine `scopeContractReview`-Bindung an Anforderung,
Vertrag, konkrete Aufgabenprobe und vorhandene Lieferung. Das ist vollständige
Zuordnung dieser bekannten Kandidaten, keine vollständige Inventur unbekannter
Originalfunktionen. Historische Felder, Quellenbindungen und Abnahmestände bleiben
unverändert. `sources.json` wurde nicht geändert.

## Tatsächlich untersuchte Referenzstände

| Referenz | Bindung und Untersuchung am 29.10. | Aussagegrenze |
| --- | --- | --- |
| Canvas of Kings | Registereinträge der Demo 0.4.06, Steam build 16643264 und der datierten I06–I48-Teilproben gelesen; vorhandene Versions-null-Felder bleiben null. | Kein neuer Originalbedienlauf. Vollversion, geeigneter Träger für Combine, Layergruppen, Workshop und weitere Asset-/Ausgabevarianten unbelegt. Galerie ist kein Funktionsbeleg. |
| Watabou MFCG | Register I03/I14–16/I19/I35 u. a. gelesen; Ausgabemetadatum mfcg 0.11.5 ist nur dort gebunden, UI-Build bleibt unbekannt. | Kein neuer Originallauf. Aus bekannten Datei-/Warpbeobachtungen keine vollständige Variantenwirkung abgeleitet. |
| Fantasy Town Generator, 09.10. | Vorhandene I02–I46-Registerauszüge samt konkreten Grenzen gelesen; Webversion unbekannt. | Historische Rohbelege lokal nicht vorhanden. Das Register ist ein übernommener Beobachtungsbericht, keine erneut gelesene Rohdatei. |
| Fantasy Town Generator, 29.10. | Neue direkte temporäre Siedlung `CITY00 Plan3 QA` über die gebundene [Original-URL](https://www.fantasytowngenerator.com/temporary-settlement). Browseroberfläche; Version/Build nicht angezeigt bzw. nicht festgestellt. | Getrennter datierter Webstand, kein Ersatz für unbekannten 09.10.-Build; kein Account-/Premiumzugang und kein Browser-/Prozessneustart. |
| Wonderdraft | Installierte Dateien `/opt/Wonderdraft/Wonderdraft.x86_64` und `.pck` hashgeprüft: exakt die im Register gebundenen SHA-256 für 1.1.8.2. 19.10.-Bewegungsmessdatei und ihre Bildhashes erneut geprüft. | Kein neuer Originallauf: Die verfügbare Computeroberfläche bietet hier nur Browser, keine native Appsteuerung. Offene grafische Varianten/Module bleiben unbelegt. |
| Dungeon-/Autonomyquellen | Fünf Dateien aus Gitrevision `9de85c1a26f526acbc1af332ac5962e185c0aab2` erneut gelesen und gegen `sources.json` gehasht: Dungeon, Editor, Travel, Travel State und Actor Autonomy. | Normative Primärdateien, keine Originalprogramm-Gesten. Aktueller Code wurde in dieser Fachklärung nicht implementiert oder vollständig vermessen. |

Die lokale Verfügbarkeitsprüfung durchsucht rekursiv die Pfadangaben unter
`acceptance.json.cityPlans` und `wonderdraftParity`, soweit sie absolute
`/home/aaron/`-Dateien mit `city` oder `wonderdraft` im Pfad sind: **1 von 129**
vorhanden. Das ist nur diese historische Pfadmenge. Die separat dokumentierte
19.10.-Bewegungsprobe existiert; daraus wird nicht „alle Rohbelege fehlen“.
Die vorhandene Originalkarte wird nicht überschrieben. Prüfdetails/Dateihashes
stehen in [audit.json](audit.json).

## Neue FTG-Teilprobe: Verhalten und Grenzen

Ausgang: frische temporäre Siedlung, Name `CITY00 Plan3 QA`, Size
`Hamlet (~100 people)`, übrige Defaults. Erzeugtes Ergebnis: **93 Bewohner**,
27 Gebäude (11 lower class homes, 10 middle class homes, 4 farms, 2 house shares).
Das ist eine wirkliche Erzeugungsprobe und keine exakte Einwohnergarantie.
Die Profiltabelle nennt u. a. 60 Farmer, 8 Retired, 7 Unemployed adults,
7 Unemployed others und 4 Stay at home parents. Diese sichtbaren Kategorien
summieren nicht die ganze Totalzahl; keine zusätzlichen Kategorien geraten.

Über Population → Suche `farmer` wurde Latra Sandurion geöffnet: 39-jährige
Human-Farmerin, Appearance/Personality/Goal, Religion, sechs Ability Scores,
Lives in `The Sandurion Residence`, Works at `Farm`, aktuell farming am Montag
09:00. Relations zeigte Vater, Mutter, Geschwister, Adoptivschwester und
Business rival. Einzeländerung: First name `Plan3Latra`, Religion neutral →
good gods, Save Person. Danach änderten sich Profilname und Glaubenssatz;
Aussehen, Persönlichkeit, Ziel sowie Wohn-/Arbeitsreferenzen blieben lesbar.

Relationseditor → 1 - 1 Relations → Add Relation → Suche `Romela` → Friend →
Add → Save Person: Romela ist nun gleichzeitig Bruder und Friend. Der Aufruf
von Romela zeigt Plan3Latra zugleich als Schwester und Friend. Das belegt eine
beidseitig sichtbare Freundschaft neben einer Familienrelation; **nicht** alle
Relationstypen oder deren rohe IDs. Die angezeigte Dropdownliste enthält Friend,
Best Friend, sechs Rivaltypen, Affair partner, Crush und Admirer; nur Friend
wurde ausgeführt. Familien-/Partnergruppen und Friend Groups sind unterschiedliche
Editorbereiche; ihre Änderungsregeln wurden nicht vollständig erprobt.

Browserneuladen → Population → Suche `Plan3Latra`: Name, Religion,
Wohn-/Arbeitsreferenzen, Familienrelationen und neue Freundschaft sind wieder
sichtbar. Es wurde weder ein frischer Browserprozess noch die serverseitige
Datenrepräsentation/ID-Stabilität geprüft. Ein früher gescheiterter exakter
Tablocator und die Suche `a` änderten keine Personendaten; `a` wurde mit
Mindestlänge 3 abgewiesen. Suche `farmer` ist wegen Resultlimit keine vollständige
Personenliste.

Edit map → Regenerate area zeigt: Gebäude/Dekoration und optional Straßen werden
ersetzt, Bewohner gelöscht/neu erzeugt, Aktion nicht rückgängig machbar. Der
Dialog wurde ohne Auswahl/Annahme geschlossen. **Kein beobachteter Regenerations-
oder Schutzlauf.** Der explizite SaltMarcher-Schutz vorhandener Autorenarbeit
ist bereits entschieden und benötigt keine Übernahme des destruktiven Hinweises.

## Rohbelege

| Datei | Aussage |
| --- | --- |
| [ftg-generated-people.txt](ftg-generated-people.txt), [Bild](ftg-generated-people.png) | Geladene reale Bewohner-/Berufstabelle. |
| [ftg-generated-buildings.txt](ftg-generated-buildings.txt), [Bild](ftg-generated-buildings.png) | Tatsächliche Gebäudeverteilung, Summe 27. |
| [Vorherbild](ftg-person-before.png) | Geöffneter Einzelpersoneditor mit ursprünglichem Namen/Religion. |
| [ftg-person-after.txt](ftg-person-after.txt), [Bild](ftg-person-after.png) | Angenommene Namen-/Religionsänderung im Profil. |
| [ftg-relations-controls.txt](ftg-relations-controls.txt) | Tatsächlich sichtbare Relationsoptionen, kein Wirkungsbeleg aller Optionen. |
| [ftg-relation-applied.txt](ftg-relation-applied.txt) | Freundschaft und Familienkanten nach Save Person. |
| [ftg-relation-reciprocal.txt](ftg-relation-reciprocal.txt), [Bild](ftg-relation-reciprocal.png) | Gegenprofil Romela zeigt bestehende Familie plus Friend Plan3Latra. |
| [ftg-person-reloaded.txt](ftg-person-reloaded.txt) | Profil nach Browserreload. |
| [ftg-relations-reloaded.txt](ftg-relations-reloaded.txt), [Bild](ftg-relations-reloaded.png) | Familienkanten/Friend nach Browserreload. |
| [ftg-regeneration-warning.txt](ftg-regeneration-warning.txt), [Bild](ftg-regeneration-warning.png) | Unausgeführter Regenerationsdialog und seine Warnung. |

## Gebündelter Entscheidungs- und Zugangsbedarf

**CITY-D01 · Nicht zugänglicher Originalumfang.** Belegt sind die CoK-Demo,
FTG-Temporärzugang und Teilwirkungen von Watabou; der volle versprochene Umfang
kann daraus nicht abschließend inventarisiert werden. Alternative A: den
vollen Auftrag erhalten und autorisierten Voll-/Premiumzugang bzw. direkte
vollständige Originalbelege bereitstellen (**Empfehlung**). Alternative B:
nur ausdrücklich ausgewählte, benannte unerreichbare Wirkungen aus dem Auftrag
nehmen. A erhält Daten-/Bedienumfang, lässt Dauer und zusätzliche Felder bis
zur Beobachtung offen; B wäre eine sichtbare Umfangsänderung mit weniger
Adaptern/Feldern und eigener Bestätigung, kein stiller Dokumentationsabschluss.
Es wurde kein Kauf, Account oder Lizenzwechsel ausgeführt. Ein unbekannter
Regler wird nicht automatisch zum Produktentscheid erklärt: zunächst fehlt
seine Wirkungsprobe. CITY-00 bleibt bis dahin unvollständig.

**CITY-D02 · Ruhetagoverride außerhalb der beobachteten Zeit.** Die übernommene
I42-Probe belegt Arbeits-/Heimaktivität bei gleichem Montag 11:00 und Rückkehr
mit None; sie entscheidet weder Lebensdauer noch spätere Tage. Alternative A:
ausdrücklicher Override für genau das gewählte Campaigndatum, dessen Rücknahme
den gespeicherten Plan wieder wirksam macht (**Empfehlung**). Alternative B:
dauerhafte/regelmäßig wiederkehrende Planüberschreibung bis Widerruf. A benötigt
einen datierten Override samt sichtbarem Geltungsdatum, B eine Regel samt
Priorität/Ende und breiteren Kalender-/Catch-upprüfungen. Keine Variante wurde
hier beschlossen. Vor CITY-07 erst weitere zugängliche Originalwirkung prüfen;
bleibt diese unbelegt, ist diese fachliche Zielwahl erforderlich.

Weitere originale Daten-/Export-/Relations-/Darstellungswirkungen sind in den
bestehenden gap-Feldern und konkreten Szenarien benannt; sie sind **keine**
verborgene dritte Freigabe. Für Dungeon/Autonomy wurde bei der Quellenprüfung
kein neuer fachlicher Quellenkonflikt festgestellt. Küste, begrenzter Fluss und
Complete-Laufdatentransfer bleiben bereits entschieden. Implementierung,
Nativequalifikation und Ownerabnahme sämtlicher Tabellen bleiben offen.

## Einmaliger Review von Plan 3

Der Zwischenstand ist als nachvollziehbare fachliche Konkretisierung akzeptiert;
Plan 3 bleibt unvollständig. Die bekannten 65 Stadtfälle und 83 Wonderdraftfälle
sind an Ergebnisse, Prüfaufgaben und Lieferungen gebunden. Die neuen Stadt-,
Dungeon- und Autonomyverträge unterscheiden normative Zielwirkungen von tatsächlich
beobachteten Originalwirkungen. Die FTG-Textbelege stützen die dokumentierte
Einzeländerung, Gegenrichtung der Freundschaft und Wiederanzeige nach Reload;
ein Browserneustart oder ausgeführte Regeneration wird ausdrücklich nicht behauptet.

Der Review hat ergänzend den gesamten bisherigen Inhalt von `acceptance.json`
strukturell gegen HEAD verglichen: kein historischer Wert und keine vorhandene
Liste wurde geändert. Hinzu kamen ausschließlich die neuen Felder
`scopeContractReview`, `scopeReview` und `additionalOriginalProbes`.
`sources.json` ist unverändert. Die bereits erfolgreichen Repository-, Link-,
JSON-, Quellen- und Diffprüfungen wurden wiederverwendet. Es wurde kein kleiner
fachlicher Korrekturbedarf gefunden; diese Ergänzung dokumentiert nur das Urteil.

Offen bleiben die unbekannten Originalfunktionen, die in den bestehenden
gap-Feldern benannten nicht ausgeführten Wirkungsproben und CITY-D01/D02.
Die Entscheidungsvorlagen ersetzen diese fehlenden Originalproben nicht;
insbesondere wäre ihre Beantwortung allein noch keine vollständige Inventur.
Die Zuordnung aller bekannten Kandidaten erfüllt das vollständige
Abschlusskriterium von Plan 3 daher nicht. Keine neue Funktions-, Native- oder
Ownerabnahme. Der einmalige Review ist beendet; keine weitere Reviewrunde oder
Planung für Punkt 4 wurde eröffnet.
