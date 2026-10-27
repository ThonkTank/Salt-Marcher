# TW06-D — Begrenzte Grundlagenentscheidung

Status: Untersuchung und unabhängige Nachprüfung abgeschlossen; Ein-Kachel-Beleg bestätigt, universelle 32-fache Budgetaussage korrigiert. D2-Nachplanung vor Fortsetzung; Produkt-/Bestandstestumsetzung bleibt gesperrt.
Owner: tw06_foundation_decision (gpt-6-sol/high) für Untersuchung und Proben; Hauptagent für Auftrag/Entscheidung.
Last Reviewed: 2026-10-26
Source of Truth: Befund und unabhängige Korrektur des abgeschlossenen D-Auftrags; nächste Untersuchung in TW06-D2.

## Entscheidungsfrage und Grenzen

Kann der bestehende GPU-Feldansatz mit einer konkret beschriebenen gemeinsamen
Topologie, vollständigem Randverfahren und atomarem Besitzer-/Fehlerlebenszyklus
die unveränderten [TW06-Verträge](TW06.md#verbindlicher-technischer-vertrag)
innerhalb der dortigen Budgets erfüllen? Falls nein oder unbewiesen: Welche
exakte Annahme scheitert und welche kleinste Alternative/weitere Evidenz würde
die Entscheidung ändern? Keine Zieländerung, kein pauschaler Rendererwechsel.

Dieses Paket entscheidet über eine begrenzte technische Lösung. Es ist keine
Produktkorrektur, offene Fehlersuche, neue Performance-Matrix oder vorgezogene
TW06-Abnahme. Ein positives Ergebnis autorisiert keine unmittelbare Umsetzung;
Hauptchat entscheidet und plant danach, Prüfer bestätigen die Übernahme.

## Eingaben und Verantwortung

- Nutzerziele/Messvertrag: [Terrain-Relief](../../../requirements/terrain-relief.md#ziele-und-abnahme-dieser-etappe); Plan und Befunde: [TW06](TW06.md), [Gesamtplan](../plan.md).
- Prüfstand: `.build/terrain-water-handoff/tw06-review-1793028780353/source-snapshot/`; Manifest-SHA `7e66135ced4fb4886618b54d43801f5b6674fcca140d220228f2e5643194e536`.
- Quellen: `atlas-terrain-field-presentation.ts`, `terrain-grid-layout.ts`, `atlas-deck-surface.ts`, `atlas-deck-picking.ts`, Worker/Client und zugehörige gezielte Tests im Snapshot; nur benötigte weitere Abhängigkeiten lesen.
- Befunde R1–R5 des unabhängigen Review-Chats `01a178d9-c991-7de0-8fb3-9003e6c77bf9`.
- Ein Implementierer mit räumlicher Geometrie-/GPU-/Lifecycle-Kompetenz; Modell zunächst `gpt-6-sol`, Reasoning `high`. Er besitzt Diagnose/Proben und deren Überwachung allein. Root prüft Ergebnis/Entscheidung, nicht parallel die Details.

Schreibbereich: ausschließlich isolierte Entscheidungsartefakte unter
`.build/terrain-water-decision/<run-id>/` sowie dieser Paketauftrag für das
kompakte Ergebnis. Produkt, Bestandstests, Buildkonfiguration, gemeinsamer Plan
und andere Paketdateien bleiben unverändert. Kein neues Fenster/OS-/Native-
Experiment und keine zusätzliche Abhängigkeit; die erste Entscheidung beruht
auf kleinen deterministischen, ausführbaren Modellen/Prototypen. Wird für eine
Entscheidungsfrage Hardwareevidenz notwendig, melden und begrenzt nachplanen.

## Priorisierte Entscheidungsproben

Die Reihenfolge ist verbindlich. Untersuche zuerst den kleinsten entscheidenden
Gegenfall. Ein nachgewiesener Ausschluss oder eine entscheidende Wissenslücke
beendet den Versuch; die übrigen Proben werden als unerledigte Folgegates
benannt. Alle drei Modelle in zwei Stunden fertigzustellen ist keine Pflicht.
Nur wenn der vorherige Schritt tragfähig ist, folgt der nächste.

1. **Gemeinsame Topologie:** reproduziere R1: gleiche Box 0..1.000.000,
   Alt-Verfeinerung 100.000..120.000 und Neu-Verfeinerung 700.000..720.000 in
   beiden Achsen. Zeige zuerst den fehlenden alten Stützpunkt des eingefrorenen
   Verfahrens. Lege dann einen begrenzten Konstruktionsvorschlag vor und prüfe
   Altform bei Alpha 0, Neuform bei 1 und gemischte Form bei 0,5 anhand
   unabhängig vorgegebener analytischer Höhen/erwarteter Stützwerte. Zähle
   tatsächliche Vertices, Indizes, Metadaten und simultane Kopien vor Allokation;
   neben dem Gegenfall muss die zulässige Worst-Case-Partition von 32 Alt +
   32 Neu + 32 Draft begrenzt oder ein konkreter Budgetgegenfall gezeigt werden.
   Ein günstiges Beispiel allein ist kein universeller Machbarkeitsbeweis.
2. **Ränder/Ecken:** kleinster gestufter negativer T-/Eckfall mit mehreren
   feineren Nachbarn, diagonalen Stützen und Materialrandkette. Bindende
   erwartete Höhen, physische Gradienten/Normalen und Materialgewichte bei
   0/0,5/1 unabhängig vom produktiven Rayhelper festlegen. Zeige, wie derselbe
   Vorschlag diese Abtastorte/Owner endlich und budgetiert auflöst. Eine
   sichtbare GPU-Schadensgröße wird aus der CPU-Probe nicht behauptet.
3. **Besitzer/Fehler/Ressourcen:** deterministisches Zustandsmodell mit echten
   Besitzer-/Referenz-/Format-/Maß-/Samplezahl-Daten statt vorgegebenen
   `prewarmed=true`-Flags. Prüfe disjunkte 32+32+32, gestaffelten Teilupload,
   setProps-/Drawfehler vor Bestätigung, Kontextverlust, Dispose und explizit
   ausgelösten Neustart. Der letzte bestätigte Besitzer bleibt bis zum
   erfolgreichen atomaren Draw geschützt; Fehler lösen Wartende, sperren
   Eingabe und beenden Arbeit ohne Autoretry. Vor jeder Reservierung müssen
   tatsächliche Alt/Neu/Picker-/Resize-Ressourcen enthalten sein. Das Modell
   beweist noch keinen nativen Peak; fehlende Messung klar ausweisen.

Gleiche unveränderte Quellen dürfen aliasieren; der Nachweis darf den
schwierigen disjunkten Fall nicht durch Aliase oder weggeblendete Details
ersetzen. Keine Erhöhung von Budgets, Reduzierung von AA/Qualität oder
Produktfensterbegrenzung als stiller Ausweg. Midpoint ist keine Lösung für
fehlende Topologie: die Regel bleibt für den späteren unverlangsamten G4-Lauf
unqualifiziert und wird nur mit einer begründeten Zeit-/Drawpolitik vorgesehen.

## Begrenzung, Ergebnis und Prüfung

Höchstens **zwei Stunden Kalenderzeit** ab tatsächlicher Beauftragung,
einschließlich Tests und Warten. Nach spätestens einer Stunde kurzer
Entscheidungspunkt: liegt zum priorisierten Gegenfall ein prüfbarer Vorschlag oder Ausschluss vor?
Liegt bis dahin kein prüfbarer Entwurf vor, stoppen und die konkrete Wissenslücke
melden. Ein früher entscheidender Gegenfall beendet die Untersuchung ebenfalls;
keine unbegrenzte Fixserie. Die
Frist verlangt einen ehrlichen Entscheidungsbefund, keinen erzwungenen Pass.
TW06-Paketzeit läuft unabhängig davon weiter; Agentenwechsel setzt nichts zurück.

Übergabe enthält Quellenhashes, die tatsächlich ausgeführten reproduzierbaren
Proben, erwartete/beobachtete Werte und deren Allokations-/Referenzzählung.
Nicht bearbeitete Fälle und unbewiesene Worst-Case-Grenzen bleiben explizite
Folgegates. Wähle eines der Ergebnisse:

- prüfbarer Entwurf für begrenzte Korrektur-/Hardwarepakete plausibel; noch
  kein universeller Budget- oder Hardwaremachbarkeitsnachweis;
- konkrete Grundlagenkorrektur mit nachgewiesener notwendiger Vertrags-/Budgetentscheidung;
- Gegenfall widerlegt den Vorschlag, kleinste vergleichbare Alternative benannt;
- Evidenz fehlt, genau eine kleinste entscheidende Untersuchung mit messbarem Kriterium benannt.

Bei fehlender Evidenz folgt vor K genau eine neu begrenzte, unabhängig geprüfte
Untersuchung mit Entscheidungsfrage und Abbruchkriterium; keine automatische
Verlängerung dieses Pakets. Ein positiver Entwurf darf unbewiesene Grenzen
nicht als erfüllt weiterreichen.

Zusätzlich, soweit entscheidbar: notwendige Produktänderungen und berührte Schnittstellen ohne
Implementierung, sinnvoll getrennte Folgepakete, realistische aktive und
Maschinenzeiten samt Unsicherheit, genaue Gates für TW06-K/E/Q. Keine gesamte
Abnahme aus diesen kleinen Proben. Hauptchat prüft das Ergebnis, plant begründet nach und führt die
unabhängige Nachprüfung gemäß reviewed durch; abhängige Umsetzung bleibt bis dahin gesperrt.

## Ergebnis und unabhängige Korrektur — 26.10.2026

**R1 bestätigt; universeller 32-Kachel-Budgetausschluss nicht belegt.**
Der alte Feinband-Stützpunkt (110.000,110.000) hat analytisch bei Alpha 0/0,5/1
Höhen 100 / 61,65 / 23,3, das eingefrorene Netz 0 / 11,65 / 23,3.
Das ist ein analytischer CPU-Geometriebeweis; die Probe trägt die Höhen nach,
kein GPU-Vergleich. Die unabhängige rationale Schnittprüfung bestätigt je Box
40.674 Vertices, 48.611 positive Schnittflächen und 242.514 Indizes sowie
1.620.840 B bei vollständiger Fan-Konstruktion. Der konkrete Float32-Zeuge hat
auf beiden Seiten 12.160 nichtkoplanare innere Kanten; die Ein-Kachel-Untergrenze
1.234.116 B trägt für ein gemeinsames alpha-unabhängiges explizites Netz.

Die ursprüngliche 32-fache Untergrenze und der daraus abgeleitete
Streamingauftrag sind **verworfen**: Disjunkte Quellen erzwingen keine getrennten
physischen Indexbuffer. Bei identischer Topologie kann selbst mit getrennten
Vertexbereichen und tatsächlichen Slot-IDs derselbe Indexbuffer dienen.
Dann braucht die konkrete Konstruktion rechnerisch
`32 × 40.674 × 16 + 242.514 × 4 = 21.795.144 B` statt 51.866.880 B.
Das ist nur eine Teilbilanz: geschützter Altbestand, Draft, Metadaten und
weitere Kopien sind noch offen. Auch die frühere Altbestandsaddition setzte
ungeteilte Indizes voraus. Kein universeller Budgetpass und kein Rendererwechsel.

Die 64 einzelnen synthetischen Views bestehen den Validator, ihre gemeinsame
Erreichbarkeit im Produkt ist unbewiesen. Der aktuelle Producer
`atlas-terrain-tile.ts:11–23` liefert uniforme 65×65 Views; der Tileplan
verfeinert Kacheladressen statt innerer Bänder. 30 Pläne über fünf Skalen,
signed Offsets und Fokus an/aus lieferten 680 uniforme Views, null refinement.
Das ist eine Stichprobe. Cacheleser `storage/atlas-terrain-tiles.ts:36–43,47–70`
prüfen den allgemeinen Viewvertrag bzw. refinement-Abwesenheit nicht vollständig.
Allgemeiner Daten-/TW06-Vertrag enthält die Feinbänder weiterhin. Eine engere
Producer-Invariante darf erst nach vollständiger Prüfung präzisiert werden.

Nächster Schritt ausschließlich [TW06-D2](TW06-D2.md): Quellenfamilie und
wirklich einzigartige gleichzeitige Geometriebuffer klären. Kein vorgezogener
UHD620-Streamingversuch. Ränder/Ecken, Materialkette, Lifecycle, GPU-Spitzen,
Nativeingabe und G4 bleiben unqualifiziert; TW06-K/E/Q und TW07 gesperrt.

Belege: ursprüngliche ausführbare [D-Probe](../../../../../.build/terrain-water-decision/20261026-1601-r1/README.md)
mit ihren nun korrigierten Schlussfolgerungen; unabhängige Gegenprüfungen
unter `.build/terrain-water-decision/review-geometry-20261026-1620/`
(`check_exact.py`, `exact-result.json`, `crease-result.json`) und
`review-reachability-20261026/` (`probe.mjs`, `result.json`). Beide endeten Exit 0.
Review-Chat `01a178fc-f15d-78a1-a4f7-bcb8922eef24`, gebundener D-Prüfstand
`.build/terrain-water-handoff/tw06-d-review-20261026-1612/manifest.json`,
SHA256 `7c55e4ce5e23c6da4b2b6797e125eac25e94f7f8f5fef332deb12fb15ec11247`.
Ursprünglicher Dokumentstand zusätzlich in Git
`49f9931bbfe821c6de1ae4307fb071930f685876` gesichert; HEAD/Index unverändert.
Keine Produkt-/Bestandstest-/Build-/GUI-Änderung in D oder Nachreview.
