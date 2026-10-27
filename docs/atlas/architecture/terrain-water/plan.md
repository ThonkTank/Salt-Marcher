# Terrain und Wasser: Umsetzungsplan

Status: M1/M2 unabhängig akzeptiert, M3 offen. K1–K4, K3/E-R3 und P-Produktabschnitte A–D samt gezielten Korrekturen und lokalen Builds übernommen. E/F-Anschluss, integriertes frühes P/E-Hardwaregate und E/Q offen.
Owner: Hauptagent
Last Reviewed: 2026-10-27
Source of Truth: Meilensteine, Pakete, Abhängigkeiten, Zuteilung und Terminplanung dieser Etappe.

[Ziele und Messvertrag](../../requirements/terrain-relief.md#ziele-und-abnahme-dieser-etappe) · [Preflight](../../verification/terrain-water-preflight.md)

## Ziele und unveränderte Grenzen

Nur Terrain-/Meeresspiegelbearbeitung und Darstellung: direkte Grundpinsel,
Rauhen/Glätten, sinnvolle Berg-/Hügel-/Schluchtenpinsel, Mausnavigation plus
optionales WASD und kontinuierlicher Welt–Raum-Zoom. Keine Seen, kein separater
Vorschau-Bestätigungsschritt; übrige Atlasfunktionen zurückstellen und erhalten.
Die verbindlichen Ziele TW-G1–G6 und Messbedingungen stehen ausschließlich in
der verlinkten Fachanforderung. M1/M2 bleiben akzeptiert; Quellenbindungen,
Speicher-/Renderergrenzen und fremde Arbeit bleiben geschützt.

Für die technische Wahl gilt die [Nutzerklarstellung vom 26.10.2026](../../requirements/terrain-relief.md#aktueller-lieferfokus-terrain-und-wasser):
Interne Raster-/Verfahrens-/Budgetvorgaben sind revidierbare technische
Entscheidungen des Hauptagenten. Sie begründen keine neue Nutzerfreigabe.
Bewertung und Nachplanung dienen der Produktnutzbarkeit; kein weiterer
Untersuchungszyklus allein zur Verteidigung einer überholten Versuchsannahme.

## Nächster integrierter Produktnachweis

**Nachweisart: früher repräsentativer Bediencheck auf der Zielhardware.**
Im nativen Atlas kontinuierlich malen, die tatsächliche Terrainänderung während
der Bewegung sehen, speichern und mit einer Folgegeste weitermalen. Ein gebundener
Quell-/Runtimestand, tatsächliche Bilder/Draws und unverlorene angenommene Eingabe
mit kanonischem Speicherbeleg entscheiden. Sicherer Speicherschutz, funktionsfähiger
Ablauf und verlässliche Beobachtung sind Voraussetzung. Keine Ausweichpose oder
Minidosis, die bekannte Kamera-/Eingabefehler verdeckt. Dieser Check behauptet
**weder p95 noch vollständige Leistungs- oder Lieferfreigabe**.

Die vollständige [30er-P/E-Qualifikation](pakete/TW06-P.md#frühes-repräsentatives-hardwaregate)
bleibt mit unveränderten Kriterien anschließend Pflicht. Ihr gesamter F-Messaufbau
ist keine pauschale Voraussetzung des Bedienchecks. Kameraeffekt allein zählt
nicht als Geländeänderung; eine statistisch qualifizierte Erstpixelzeit wird aus
dem frühen Check nicht abgeleitet. Vorhandene Implementierung und Prüfmittel
verwenden, keine neue Harness-/Reviewserie allein für diese Trennung.

**Ansatzentscheidung nach abgeschlossener Phasenuntersuchung, Rootentscheid 10:56 UTC:**
Der Timerabsturz ist behoben; fortlaufendes Malen bleibt nativ negativ. Der Client
hält eine schon vor Down laufende Vorbereitung bis zum erst nach Up empfangenen
Cancel-ACK. Kein aktiver Replay startet während der Geste. 47 Geländetreffer kosten
177,5 ms von 344,8 ms Eingabe, erklären aber nicht den ganzen Zustellrest. Beobachtet
ist ein t0-Read, kein t0-Replay während der Geste. Die Diagnose ist beendet;
[E-Diagnose und gebundene Belege](pakete/TW06-P.md#e--fortschritt-bei-fortlaufender-eingabe-und-kameragrenze)
bleiben erhalten. Kein weiterer Messzyklus oder Gesamtrewrite ist begründet.

**Freigegebene zusammenhängende Korrektur E-H:** Wiederverwendung nur unmittelbar
aufeinanderfolgender identischer Pixelabfragen im selben synchronen Height-Handler; vorhandenen
Prepare-Abbruch vor weitere Startarbeit ziehen; wirkungslosen t0-Previewzyklus
bei normalen zeitbasierten Pinseln auslassen; exakt passenden kanonischen
Initialseed innerhalb derselben Rebuild-Ausführung wiederverwenden. Alle
angenommenen Samples und Zeiten, Feature-Einpunktsemantik, tatsächlicher
Cancel-ACK, Quellbindung und Speicherbestätigung bleiben erhalten. Keine neue
Inputqueue, Framehaltung, Workerinstanz oder globale Cacheebene.

Technische/architektonische Planübernahme und unabhängiger Ablagereview sind
bestätigt. **Root gibt E-H1 um 10:56 UTC als EIN kohärentes Bündel frei und setzt
13:00 UTC ausdrücklich als neue gemeinsame Entscheidungsgrenze.** Die bisherige
11:00-Grenze endet mit dieser Ansatzentscheidung. Begründung: Diagnose beendet,
konkreter begrenzter Eingriff, vorhandene Prüfanschlüsse und bereits bewährter
sicherer nativer Lauf. Keine automatische Verlängerung und keine Erfolgsgarantie.
Die t0-Ausnahme gilt nur bei belegter Vertretung des gesamten vorher angenommenen
Zustands im eingefrorenen bestätigten Screen; ein leeres Journal allein genügt
nicht. Fehlende Bindung oder Pending bedeutet normalen Refresh.

**Früher Kontrollentscheid 11:07 UTC:** Erstes Dreidateienbündel eingefroren.
Der feste lokale 300-ms-Klassenfall erreicht einen bestätigten Draftdraw, nicht
zwei; kein nativer Geschwindigkeitsbeleg. Keine weitere Produktkorrektur oder
Wiederholung dieses Falls autorisiert. Sechs enge Fälle grün, Typ-/Randfall-/
Enddosisprüfungen noch offen. Der Produktowner ergänzt nur diese bisher fehlenden
Mindestprüfungen bis 11:20, parallel zur gezielten Nachprüfung des eingefrorenen
Diffs. Danach entscheidet Root über den bereits geplanten sicheren nativen
Einzellauf; keine neue Mess-/Optimierungsserie und keine Lockerung der Kriterien.
Ein direkter Reviewbefund an der neuen t0-Regel wird um 11:08 eng geschlossen:
`priorStateDrawn` muss zusätzlich `alpha === 1` und `endFrame` verlangen. Nur diese
beiden Prädikate samt Guardregression sind als Produktdelta autorisiert, keine
weitere Performancekorrektur oder Timingwiederholung. Die Grenze 13:00 bleibt;
es wird nicht bis zum geplanten Kontrolltermin gewartet.

| Unterpaket | Owner / Ergebnis | Schätzung / geplantes Fenster UTC | Abhängigkeit |
| --- | --- | --- | --- |
| E-H1 | Bisheriger Produktowner, drei Produktdateien und gezielte bestehende Tests; Typprüfung und Freeze | 60–80 min / 10:56–12:16 | Rootentscheid 10:56 nach Planübernahme |
| E-H2 | Bisheriger Nativeowner, serielle Builds und Quell-/Runtimebindung | 3–5 min / 12:16–12:21 | sicherer prüfbarer E-H1-Freeze und Rootstart |
| E-H3 | Derselbe Nativeowner, genau ein unveränderter geschützter Bediencheck samt Belegsicherung | 6–13 min / 12:21–12:34 | gebundene Builds, frische Ressourcenreserve |
| E-HR | Offener unabhängiger Reviewer, gezielte Nachprüfung des Fixes und berührter Invarianten | 10–15 min / 12:16–12:31 | E-H1-Freeze; parallel E-H2/H3, unabhängige Lieferbefunde halten den frühen Check nicht auf |
| Entscheidung / Puffer | Root, Belege prüfen und gesamten verbleibenden Weg bewerten | bis 13:00 | lokales und natives Ergebnis, offene Nachprüfung |

Timeline: 10:56–12:16 `[E-H1]` → 12:16–12:34 `[Build → Bediencheck]`,
parallel 12:16–12:31 `[Nachprüfung]` → bis 13:00 `[Entscheidung/Puffer]`.
Frühere Fertigstellung erlaubt abhängigen Start. Geschätzter Gesamtweg 85–115 min;
vertretbare gemeinsame Grenze **13:00 UTC**, einschließlich Umsetzung, Tests,
Review, Wartezeit und Auswertung. **11:41 UTC** erste Kontrolle anhand tatsächlichen
Klassenfortschritts und verbliebenen Aufwands. Kein Erfolg allein aus Testgrün.

Der Klassenfall nutzt echten Einpunktstart mit laufendem Prepare und feste 300 ms;
kontrollierte Drawanschlüsse sind lokale Funktionsbelege, keine GPU-/Sichtbelege.
Der native Check behält Pose, Pfad, Dosis und Eingabedauer sowie zwei verschiedene
Draftbilder vor Up, Speichern und unmittelbare Folgegeste bei. Fehlender Fortschritt
oder widerlegte Identitätsannahmen werden sofort eskaliert. Bei negativem Ergebnis
keine weitere angrenzende Kleinfixserie oder automatische Wiederholung. Die
bisherigen E-/P-Versuche und Laufzeiten bleiben Teil der Ansatzentscheidung.
Frischer Reviewchat `01a17cce-aa23-7570-82bf-d72e4e265e36` bleibt zuständig.

Nach einem positiven Bediencheck bleiben vollständige F-Korrektur/30er-
Qualifikation, S3–S6, der enge S8-Terminalbefund und übrige E/F-Lieferpflichten
sowie die nachfolgenden Meilensteine offen. Der F-Adapterfreeze 07:52 hat sieben
bekannte Messfehler; FieldGate ist unabhängig akzeptiert. Die vollständige
Messinfrastruktur ist keine pauschale Voraussetzung dieses frühen Checks.

## Ansatzentscheidung nach TW06-Neubewertung

Review `01a178d9-c991-7de0-8fb3-9003e6c77bf9` am gebundenen Stand
`.build/terrain-water-handoff/tw06-review-1793028780353/manifest.json`:
**Grundlagenkorrektur nötig; Ansatzwechsel nicht belegt.** Dies war die Grundlage für K1–K4; die spätere E/U-Hardwareprobe beendet den
komplexen VS-Ansatz. Die aktuelle Workerentscheidung steht in der
[begrenzten Nachplanung](#begrenzte-nachplanung-nach-negativem-e-gate). R1 (versetzte Verfeinerungsbänder) und R2
(Draw-/Fehlerlebenszyklus) sind belegte Vertragsverletzungen. R3
(Ressourcenvoraussetzungen), R4 (Ecken/Materialränder) und R5 (Beleggrenzen)
verlangen gezielte Klärung. Befunde, Verträge und Belege stehen in [TW06](pakete/TW06.md).

Der Hauptchat erkennt die Befunde mit ihren jeweiligen Beweisgrenzen an.
Die frühere Fortsetzungsschätzung ist verworfen: Sie setzte keine neuen
Produktfehler voraus. Weitere Fixes oder mehr Testzeit ersetzen die
Grundlagenentscheidung nicht. [TW06-D](pakete/TW06-D.md) reproduzierte R1. Sein universeller 32-facher
Budgetausschluss wurde unabhängig widerlegt: physisches Indexsharing ist
möglich und die reale Quellenfamilie unklar. Die Ein-Kachel-Rechnung trägt.
[TW06-D2](pakete/TW06-D2.md) und unabhängige Gegenprüfung begründen den
uniformen Atlas-Tilepfad: lokale Mehrfachauflösung durch dyadische Kacheln,
strikte Source-/Cache-/Streamprüfung und tatsächliche gemeinsame Dreiecke.
Der alte innere Feinbandzwang entfällt als technische Versuchsannahme.
Indexsharing/Streaming sind derzeit keine Voraussetzung. K1–K4 korrigieren
Quellen, Geometrie, Besitzer und Ränder; danach entscheidet der frühe echte
Bild-/Ressourcenlauf über vollständige Qualifikation. Keine weitere abstrakte
Quellenrunde vor K1. D2 bestätigt weder universelle Budgets noch G4/G5.

## Meilensteine und vollständige Lieferfolge

| Meilenstein | Pakete und Ergebnis | Gate |
| --- | --- | --- |
| M1, akzeptiert | TW01 Grundpinsel/Ausgangsmessung; TW02 Mauskamera/WASD/Meer; akzeptierte Korrekturen | G1/G2, gemeinsamer Nachweis später in M4 |
| M2, akzeptiert | TW03 Berge/Formkern; TW04 Hügel; TW05 Schluchten; akzeptierte Bergkorrektur | G3, unabhängiges M2-Nachreview |
| M3, offen | D/D2 abgeschlossen; K1–K4 lokal; E/U negativ, C01 positiv → P-A parallel zu K3/E-R3 → Vertrags-/Fixnachprüfung → P-Durchstich/frühes Gate → E/Q; TW07 Leistung | G4/G5 und unabhängiges M3-Review |
| M4, offen | TW08 gemeinsamer nativer Ablauf und Paket; M4-V-Lieferreview; TW09 CI/Integration/Releasepflicht; M4-R | G6, anschließend project-closure und getrennte Nutzerabnahme |

Die abgeschlossenen Aufträge/Belege stehen in [TW01](pakete/TW01.md),
[TW02](pakete/TW02.md), [TW03](pakete/TW03.md), [TW04](pakete/TW04.md) und
[TW05](pakete/TW05.md). Eine Planung ist keine Abnahme.

## Aktuelle Arbeitspakete und Abhängigkeiten

| Paket | Ergebnis und Zuständigkeit | Vorgänger / Freigabe | Aufwand und Prüfende |
| --- | --- | --- | --- |
| D/D2, abgeschlossen | Quellenrichtung und bedingte CPU-Machbarkeit unabhängig geklärt | Ergebnis/Beweisgrenzen in D/D2 | Keine weitere Untersuchung als Voraussetzung für K1 |
| [K1 Quellen](pakete/TW06-K1.md), abgeschlossen | Ein Implementierer gpt-6-sol/high; uniforme Rohquellen/Rastergates, Cacheinvalidierung | Akzeptierte konkrete Planprüfung und Review-Übernahme | 16:54–17:08 UTC einschließlich gezielter Tests/Builds; lokaler Handoff akzeptiert |
| [K2 Geometrie](pakete/TW06-K2.md), abgeschlossen | Ein Implementierer gpt-6.1-sol/high; reale Dreiecke/Präzision/Vorabbedarf | K1 gezielt geprüft; abgesicherte Quellenfamilie | 17:10–17:46 UTC einschließlich gezielter Tests/Builds; lokaler Handoff akzeptiert |
| [K3 Besitzer](pakete/TW06-K3.md), lokaler Handoff; Nachkorrektur unabhängig akzeptiert | Ein Implementierer gpt-6-sol/high; atomarer Draw-/Fehler-/Ressourcenpfad | K2 Partition/Drawzuordnung/Bedarf | Vorbereitung ab 17:27, Umsetzung ab 17:47, korrigierter Handoff 18:38 UTC übernommen; 71 min Kalender einschließlich Vorbereitung/Checks |
| [K4 Ränder](pakete/TW06-K4.md) | Ein Implementierer gpt-6.1-sol/high; Nachbarn/Normalen/Material/Draft | K2 Partition und K3 Slot-/Ownervertrag übernommen | Abgeschlossen: 100/100 gezielte Tests, neun analytische/gepackte Randfälle, Typprüfungen/Builds; 79 min Kalender ab Vorbereitung |
| K3-Nachkorrektur, lokal und unabhängig akzeptiert21:53 | Bisheriger K3-Implementierer, gpt-6-sol/high; vollständiger aktueller Screenframe autorisiert Übernahme | Stabiler Screenkern unabhängig von P-A-Payload; nach Planübernahme parallel zu lesendem P-A, seriell vor P-Produktcode | 1–2 h aktiv plus gezielte Checks; erster Rahmen 3 h Kalender, Zwischenstand nach 1 h; [Auftrag](pakete/TW06-K3.md#gezielte-k3-nachkorrektur-aus-e-echter-screenframe) |
| [P-A Autorenbandanschluss](pakete/TW06-P-A.md), abgeschlossen21:53:48; P-B übernommen | Bisheriger P-Implementierer gpt-6.1-sol/high; konkrete begrenzte Autorenbanddaten und feste Sättigungs-/Folggestenfolge | Gezielte Nachplanung/Übernahme; ausschließlich lesend/isoliert, parallel K3 möglich | 30–60 min aktiv, erster Rahmen60 min, Zwischenstand30 min; Ergebnis oder Rootentscheid |
| [P-B Checkpoint](pakete/TW06-P-B.md), als Entscheidungsbeleg akzeptiert22:37 | Bisheriger P-Implementierer gpt-6.1-sol/high; ein isolierter echter Queue-/Store-/Workerbeleg | Gezielte Planprüfungen und Review-Übernahme; unabhängig von E-R3 | 20–35min aktiv, maximal35min Kalender bis Ergebnis/Entscheid, Zwischenstand15min |
| [P Worker/VS/Draft](pakete/TW06-P.md), konkrete Produktzerlegung A–F | Bisheriger K4-Implementierer gpt-6.1-sol/high; hi/lo-Höhen/Gradienten, echter Worker-Draft, Lebensdauer und repräsentativer Durchstich | P-B/Vertrags-/Etatübernahme und tatsächliche E-R3-Fixnachprüfung; K3 lokal akzeptiert | A90min; B60min; C/D parallel jeweils3h; E2,5–3,5h aktiv laut aktueller Nachplanung; F45–90min. Gemeinsamer Entscheidrahmen ausschließlich im aktuellen Produktnachweisabschnitt.9–14h Kalender nur Gesamthypothese;Kontrolle00:42 nach akzeptiertem A/B-Fix; C/D abgeschlossen03:09; aktuelle E/F-Zerlegung und gemeinsame Grenze im Produktnachweisabschnitt |
| [E Hardware](pakete/TW06-E.md) | Ein Implementierer gpt-6.1-sol/high; C01 abgeschlossen; früher P-Hardwarelauf nach bestätigtem neuen Daten-/Drawpfad | Produktions-E erst nach Shaderentscheidung, K3-Nachkorrektur und gezieltem Nachreview | Früher P-Lauf 0,5–1 h exklusive Gerätezeit; vollständiges E erst danach neu bewerten |
| [Q Qualifikation](pakete/TW06-Q.md) | Ein Implementierer gpt-6-sol/high; vollständige G4-/Ressourcenmatrix | Positives E, gebundener Kandidat | 2–3 h aktiv + 2–4 h Maschinenzeit, nach E neu kalibrieren |
| [TW07](pakete/TW07.md) | Pinsel-/Navigationsleistung, ein Implementierer | TW06 vollständig belegt; dann neuen Aufwand festlegen | Bisheriger 3-h-Richtwert unbestätigt; Maschinenzeit zuerst diagnostizieren |
| M3-R | Unabhängiges Meilensteinreview | TW06 und TW07 abgeschlossen | Prüfung und Korrektur/Nachprüfung vor M4 reservieren; Dauer nach Paketbefunden |
| [TW08](pakete/TW08.md) | Gesamtablauf und Linuxpaket, ein Implementierer | Akzeptiertes M3-Review | Bisher 3 h aktiv, vor Start erneuern; Paketlaufzeit separat |
| M4-V | Unabhängige Lieferfreigabe | TW08 | Review vor externer Integration |
| [TW09](pakete/TW09.md) | Exakte Candidate-CI, lineare Integration, fälliger Release | Akzeptiertes M4-V | Bisher 2 h aktiv; CI/Releasezeit separat, vor Start erneuern |
| M4-R / Abschluss | Tatsächliche Lieferung prüfen, Übernahme/Lernerfahrungen, Nutzerabnahme getrennt | TW09 | Prüfung vor Abschluss; keine Abnahme aus Planung |

K1–K4 sind ausführbare, abgegrenzte Aufträge. Gemeinsame Feld-/Surfacebesitzer
erfordern serielle Implementierung/Integration; keine parallelen Produktedits.
K1–K4 wurden in dieser Reihenfolge lokal geprüft. Der durch E zusätzlich
belegte K3-Drawblocker folgt der gezielten Nachkorrektur weiter unten.
Keine gleichzeitigen Änderungen derselben Dateien
oder doppelte Diagnose aktiver Bereiche. Maximal drei Unteragenten plus Hauptchat;
E hat ab 18:41 UTC vorhandene Harness-/Sitzungs-/Belegwege gesichtet. Der ab
18:59 UTC isoliert erstellte historische Ohne-Worker-Build ist vorbereitet;
der Hauptchat hat alle 89 Laufzeitdateien gegen ihre Bindung geprüft.
Ausführung und RSS sind offen; [E](pakete/TW06-E.md) enthält Herkunft und
Buildkorrektur. Der erste nach K4 gestartete E-Produktionslauf ist negativ.
Die begrenzte Compilerdiagnose ist beendet. Der frische Architekturentscheid
begründet P; weitere Ausführung wartet auf dessen Planübernahme.
Prüfungen dürfen mit getrennten Aufträgen parallel lesen. Nach jedem Paket
übernimmt der Hauptchat gezielte Belege; kein neuer formaler Review-Chat pro
Routinepaket. Grundlagenzweifel sofort reviewed, M3-Review nach TW07 verbindlich.
Technik-/Budgetänderungen entscheidet der Hauptchat begründet innerhalb des
Produktziels; sie benötigen keine erneute Nutzerfreigabe.

Verbindliche Auftragsergänzung vom 26.10.: Vor jedem Paketstart, Review und
jeder Nachplanung den maßgeblichen Skill aktuell lesen; nach Kontextkomprimierung
den Phasenskill und die unmittelbar benötigten Skills erneut lesen. Relevante
Änderungen an Implementierer weitergeben, abgeschlossene Phasen nicht neu starten.
Nach höchstens drei erfolglosen hypothesengeleiteten Korrekturen desselben Problems
weitere Fixes bis zum begründeten Hauptchatentscheid stoppen. Widerlegte Grundlagen
eskalieren sofort. Zeitüberschreitungen brauchen eine begründete Fortsetzung oder
Nachplanung; optionale Befunde blockieren nicht. Review-Chats für erforderliche
gezielte Nachprüfungen offen halten. Beim Abschluss Ergebnisbelege, offene Blocker
und Fortsetzungsentscheidung prüfen; Produktumfang und Abnahmekriterien erhalten.

## Begrenzte Nachplanung nach negativem E-Gate

Echte E-Produktionsprobe und U10 sind negativ; die lokale VS-Spezialisierung
ist beendet. C01 wurde genau einmal ausgeführt und unabhängig gebunden
bestätigt: leichtes VS + unveränderter voller FS kompilieren/linken mit intaktem
Kontext und gültiger externer Wache. Die Materialhälfte bleibt zunächst bestehen.
C01 belegt weder neues Gesamtprogramm noch Bild-/Drawkosten; [E](pakete/TW06-E.md)
besitzt die eingefrorenen Handoffs und Grenzen. Keine weiteren Compilerkontrollen.

Die P-Vorbereitung20:26–21:02:40 UTC hat Vertrag und Fallzahlen geliefert;
Root und Review prüften21Quellen/11Belege/5Referenzeingaben. Gezieltes
Vertragsreview verlangt Korrekturen: tatsächlicher lokaler Autorenbandanschluss,
zusätzlicher CPU-only Escape-Anfang, Priorität neuer kumulativer Gesten,
Pointerdown-Autorisierung und vollständig gezählte Restore-/Transportdaten.
Die 12-B-Rechenserie ist nach drei negativen Vorlagen beendet.

[P-A](pakete/TW06-P-A.md) ist nach26min48s abgeschlossen und gezielt geprüft:
12.693 Groundvergleiche und Bandbytes der festen Folge positiv; kein globaler
Payload-/Etatpass. Die Vollgleichheit der Preview für Smooth/Level war eine
unnötige Erweiterung gegenüber der vorhandenen begrenzten Groundnäherung.
Ihre 49-Band-/Legacy-Payloads und 46,9-MB-/1,486-GB-Zahlen sind verworfen,
als historische Ergebnisse weiterhin gebunden.

P-B ist22:37 unabhängig als Entscheidungsgrundlage akzeptiert; kein weiterer
isolierter Beleg. Der bestehende P wird in [A–F](pakete/TW06-P.md#produktabschnitte-nach-übernommenem-p-b)
produktiv zerlegt: A atomarer Autorenbesitzer/Read/Checkpoint (90min), B echter
Payload-/Präzisionsvertrag (60min), danach C unterbrechbarer Worker und D
Darstellung/Picker parallel (je3h), E Raster-/Lebenszyklusanschluss (2h), F
gebundener Handoff samt vollständigem unabhängigen Programmpaar (90min).
P-Owner gpt-6.1-sol/high besitzt A/B/C/E/F; bisheriger K3-Owner gpt-6-sol/high D.
Getrennte Schreibbereiche und konkrete Schnittstellen stehen einmal im P-Auftrag.
Zwei unabhängige gezielte Planchecks und tatsächliche Review-Übernahme abgeschlossen; A22:49–23:30:30 lokal übernommen (58Tests); gezielte Nachprüfung akzeptiert. B23:34–00:13:38 gebunden übergeben; Nachprüfung R1–R4 verlangt den oben begrenzten A/B-Fix.
Vor jedem Folgeabschnitt begründete Ergebnis-/Zeitentscheidung, keine pauschale
Freigabe der neuen9–14h-Kalenderhypothese. Aktuelle gemeinsame Entscheidung siehe Produktnachweis oben.
Bedingt danach [P](pakete/TW06-P.md): 56-B-Basis/24-B-absolutes Draftfeld,
CPU-Double-Vorbereitung und hi/lo-Paare mit konkretem numerischem Nachweis.
Kanonisch±50e6 ist keine universelle Draftgrenze: mit belegtem P≤32-Suffix
lautet die konservative Anschlussgrenze±116e6. Präzisions-/Gradientenrechnung
und gesamte Besitzer-/Restore-/Transportzählung müssen darauf neu gebunden
werden. Alte824.353.788B-Grundrechnung und896/64/512-MiB-Vorschläge sind kein
vollständiger neuer Etatpass. Kein neuer Clamp, keine Detailabsenkung und
keine vierte12-B-Arithmetikvorlage. K2-Topologie und Material bleiben; affine
Gradientenschattierung braucht eigene neue Bildbelege.

[K3](pakete/TW06-K3.md) ist nach tatsächlichen Korrekturen und gezielter
Nachprüfung lokal akzeptiert: echter Model-Dispatch, aktueller Screenbeleg,
Fristziel, Kontextverlust und Besitzerfreigabe. Keine native oder öffentliche
P-Screen-API-Abnahme. [E-R3](pakete/TW06-E.md) ist nach44/44 Logiktests und gezielter
unabhängiger A/B/C-Nachprüfung lokal akzeptiert. Der neue Runtime-/GLSL-
Erwartungsinput bleibt vor dem späteren Hardwaregate anzuschließen. Root besitzt Plan/TW06/P. Produktbuilds werden seriell koordiniert; native Läufe bleiben bis F und lokalem Nachreview gesperrt.

```text
26.10.20:26  P begonnen; Vertrag/P-A/P-B und K3/E-R3 abgeschlossen
26.10.22:45  gezielte Produktplanung + zwei Planchecks + Review-Übernahme
26.10.22:49  A Autorenkern                     abgeschlossen23:30:30; unabhängig lokal akzeptiert
26.10.23:34  B Vertrag/Zählung                 beendet27.10.00:13:38
27.10.00:20  A/B-Fix                           abgeschlossen00:29:59; unabhängig akzeptiert
27.10.00:45  C Worker + D Darstellung          abgeschlossen/übernommen03:09
27.10.03:20  E/F-Nachplanung                   Planchecks und Reviewübernahme abgeschlossen
27.10.03:31  E1 vertikaler Höhenanschluss      positiv04:06, Rootübernahme04:09
27.10.03:34  D enger Resume-/Screenanschluss  abgeschlossen/übernommen03:44; Voraussetzung E2
27.10.04:28  E-Zwischenentscheidung            vorgezogen; E1 übernommen, E2/E3 fortsetzen
27.10.04:09  E2 Fenster/Lebensdauer            lokal positiv04:28; E-Nachreview offen
27.10.04:28  E3 Quellen/Picking/Prüfung        Anschluss noch offen, aktuelle Ziele unten
27.10.04:52  E3 enger Recoverynachplan         Planchecks/Übernahme04:55 abgeschlossen
27.10.04:55  E3 Recovery im selben Paket      lokal positiv05:19; Folge50 noch offen
27.10.05:20  vorgezogene05:25-Kontrolle        Folge50-Endzustand ergänzt
27.10.05:33  Stop nach drittem Folge50-Versuch  Teilstandfreeze + unabhängiger Entscheid
27.10.05:43  zwei einzeln genehmigte Diagnosen abgeschlossen; Fixturegrundlage unvollständig
27.10.06:04  enger Fixture-Nachplan             Planchecks/Übernahme abgeschlossen
27.10.06:13  vorhandene Fixture korrigieren     ███ 30–40min bis gebundenem Delta
27.10.06:17 vollständiger E-Quellreview          abgeschlossen; sechs konkrete Lieferblocker
27.10.06:28 begrenzte Umordnung früher Hardwareentscheid  Planchecks/Übernahme vor Start
27.10.06:34 lesbares Fixture-Delta fertig       seit06:35 unabhängiger Abgleich5–10min
anschließend separat genehmigter Einzellauf     ▌5–8min samt Bindung,20s-Wait unverändert
27.10.07:08  interne07:00-Kontrolle erfolgt       begrenzter Fortschritt; Review/Testgrenze und enger F-Restplan
27.10.06:51 S1/S2 Teilstand bis07:07              29grün/Vollfallrot; enges Review vor Fortsetzung
27.10.06:32 F/Harness-Vorbereitung               abgeschlossen06:51; Startpflichtlücken offen
27.10.07:23 F-Adapter + FieldGate parallel; FieldGate übernommen, Adapterfreeze07:52
27.10.08:28 Lagekontrolle: S7 erster Progress positiv, Finalreview offen
            S8 vor Gate zwingend                Planprüfung, noch kein Produktstart
            F sieben Quellbefunde               enger Korrekturplan in Prüfung
            Bediencheck nach S7/S8 + sicherem vorhandenem Harness
            vollständiger Messadapter/30er-Lauf danach, kein p95 aus Frühcheck
            aktualisierter Restpfad offen       10:00 nicht automatisch verlängert
darin enthalten: frühes30er-P/E-Gate             30–50min+15–20min Ergebnisreview, unvalidiert
nach Gate   S3–S6, abschließendes E/F             verbleibender Aufwand dann konkretisieren
27.10.10:00  gemeinsame Entscheidung; oberer Aufwandsrand nicht vorab freigegeben
nach P-Pass  restliches E → Q → TW07 → M3-R → weitere Lieferfolge
```

Die frühere3–5-h-P-Hypothese bleibt überholt. P-B ist eine begrenzte
Entscheidungsvorlage, keine automatische Verlängerung oder vollständige
Umsetzungsfreigabe. P-Start26.10.20:26 UTC bleibt; die vorgezogene Vierstundenkontrolle
und begrenzte Fortsetzung stehen im aktuellen Produktnachweisabschnitt oben.
Frühere Hauptkontrolle siehe TW06; keine zugesagte Gesamtfertigzeit.

M1/M2 und K1 bleiben akzeptierte Grundlagen. K2-Topologie bleibt, neue gepackte
Höhen-/Buffer-/Raygleichheit neu prüfen. K4-Höhen-/Materialfälle bleiben verwertbar,
alte Normalenwerte beweisen die neue Schattierung nicht. K3-Teilfälle bleiben,
Screenframe und neue Deltalebensdauer offen. Alle negativen Belege bleiben
unverändert. Neue Produktstände erhalten eigene Quellen-/Runtimebindung.
Vollständiges E/Q/G5 und Lieferung bleiben erforderlich; keine pauschale
Wiederholung unberührter Tests oder Umetikettierung alter Laufzeiten.

## Terminplan und Kontrollen

Der ursprüngliche TW06-Paketstart bleibt 26.10.2026 01:26 UTC. Die letzte
Lagekontrolle, aktuelle Entscheidung und nächste Kontrollgrenze stehen im
aktuellen Produktnachweisabschnitt; TW06 verweist darauf. Agentenwechsel, Untersuchung und Review setzen diese Laufzeit nicht
zurück. Spätestens alle vier Stunden Kalenderzeit einschließlich Tests/Warten
prüft der Hauptchat Fortschritt, Ursachen, Tragfähigkeit und Rest; überfällige
Prüfung beim Wiederanlauf. Fachliche Grundlagenzweifel lösen reviewed sofort aus.

Historische lokale K-Übernahmen: K1 16:54–17:08 UTC (14 min), K2
17:10–17:46 UTC (36 min), K3 ab Vorbereitung 17:27 bis Übernahme 18:38 UTC
(71 min), K4 ab Vorbereitung 17:59 bis Abschluss 19:18 UTC (79 min),
übernommen 19:21 UTC. Diese Zeitbelege sind keine aktuelle E-Freigabe.
Die einzige aktuelle Timeline und die Folgeentscheidungen stehen in der
[begrenzten Nachplanung](#begrenzte-nachplanung-nach-negativem-e-gate).
E-Vorbereitung ab 18:41 UTC und ursprüngliche TW06-Zeit zählen unverändert;
Tests und Warten gehören zur Kalenderkontrolle. Nach spätestens 2 h je Paket
belegter Zwischenstand, spätestens 4 h Hauptkontrolle; kürzere konkrete
Paketgrenzen haben Vorrang. Für TW07 und spätere Lieferung bleiben Maschinen-
und Reviewzeiten unbestimmt, bis die Eingangsgrößen gemessen sind. Keine
Addition der Aufwandshypothesen zu einer vorgetäuschten Fertigstellungsuhrzeit.

M1-A1 bleibt offen in TW07: Die 120er-Ausgangsmessung brauchte 76,53 Minuten
zwischen erstem/letztem Down, im Mittel 38,44–38,78 s Abstand. Die Aufteilung in
Setup/Commit/Undo/Quellenbereitschaft/Belegermittlung fehlt. Unverändert wären
2.100 Versuche etwa 23 h Maschinenzeit; das ist eine Risikoprojektion, keine
Messung der übrigen Skalen. Vor der großen Leistungs-Matrix neu bestimmen.

## Gemeinsame Prüf- und Lieferregeln

Private native Sitzung auf dem Zielgerät ohne Entsperren des Hosts;
keine Änderung globaler Sperreinstellungen oder realer Kampagnendaten.
Instrumentierte PointerEvents, Chromium-/Playwright-Eingaben, OS-/Compositor-
Eingaben, Paketprüfung und Nutzerabnahme getrennt benennen. Fehlproben bleiben
Fehlproben. Bestehende passende Testbelege nicht pauschal wiederholen.
Capability-Verknüpfungen nach tatsächlichem Inhalt pflegen; kein vollständiges
`--geprueft` aus Teilabdeckung. Die sechs exakten Candidate-Checks und die
Releasepflicht aus AGENTS.md bleiben vor Lieferung verbindlich. Keine
Automation starten oder pausierte Automationen wieder aufnehmen.

Der frühere detaillierte Plan-/Paketverlauf ist vor der Verdichtung im lokalen
Git-Snapshot `5a4accef3ab673fdab9082c308731fdc281e7c8c`
(`refs/codex/snapshots/tw06-pre-replan-1793029444`) gesichert. HEAD, Index,
fremde Änderungen und alle bisherigen Belegverzeichnisse bleiben erhalten.
