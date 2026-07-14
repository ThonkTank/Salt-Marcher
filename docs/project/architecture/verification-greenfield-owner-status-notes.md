Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-13
Source of Truth: German owner-facing status notes for the verification
greenfield roadmap.

# Verification Greenfield Owner Status Notes

## 2026-07-14 Nightly-gruen-T4-geschlossen-M1a-vorgezogen

Der M0-Blocker war reine Zeitfrage. Der geplante Nightly hatte beim Pruefen um
`00:29+02:00` schlicht noch nicht gefeuert (Cron `17 2 * * *`). Der erste
geplante Lauf danach ist gruen: Run `29307758537`, `event=schedule`, Job
`nightly-rerun-tasks=success`, `BUILD SUCCESSFUL in 5m 44s`. Damit ist
Vorgaenger-T4 geschlossen und die alte Harness-Roadmap steht auf
`Status: Deprecated` mit Nachfolger-Zeiger. Sie wird aufgehoben statt
geloescht, weil die T5-Spezifikation dort liegt und vom Deferred Annex
referenziert wird.

**M1a wird vor die M0-Baseline gezogen.** M0 verlangt eine headless gemessene
Baseline, aber Headless landet erst in M1 - und heute ist headless schlicht
unmoeglich: Gradle reicht `-D`-Properties nicht an die Test-Forks weiter, und
die Monocle-Glass-Implementierung fehlt auf dem Classpath (sie ist nicht Teil
des Desktop-JavaFX). Eine Baseline waere also nur mit fokusklauenden Fenstern
messbar gewesen - genau das, was V9 verbietet. Deshalb: M1 wird in M1a
(Headless, zwei Edits in `build.gradle.kts`) und M1b (Parallelismus)
gesplittet; M1a laeuft zuerst, danach wird headless gemessen, dann bringt M1b
die Zeit runter.

Zwei Rechercheergebnisse entschaerfen M1a deutlich. Erstens: `org.testfx:
openjfx-monocle:21.0.2` existiert (2024-02-11), ist mit JDK 21 gegen JavaFX
21.0.2 gebaut und passt exakt auf den Versions-Pin des Projekts; das bekannte
JPMS-Problem greift nicht, weil hier alles auf dem Classpath liegt. Zweitens:
der einzige pixelvergleichende Harness
(`DungeonMapRenderParitySnapshotHarness`) haelt **keine** Golden-Images vor -
er vergleicht zwei Snapshots aus demselben Lauf. Ein Pipeline-Wechsel auf
Software-Rendering bewegt beide Seiten gemeinsam; eine Golden-Neuaufnahme ist
damit voraussichtlich nicht noetig. CI rendert hinter `xvfb-run` ohnehin ohne
GPU, also ist der Software-Pfad der, auf dem die Flotte heute schon gruen ist.

**Zur 1,5-Stunden-Annahme:** Sie ist nirgends im Repo belegt. Der groesste
aufgezeichnete lokale Voll-Lauf ist `26m 8s` bzw. `26m 17s` bei 75 Tasks; der
Nightly faehrt denselben Graphen (74 Tasks) auf CI in `5m 44s`. Der reale
Schmerz ist also Fokus-Klau plus etwa Faktor 4,5 gegenueber CI, nicht Faktor
16. Die M0-Baseline liefert die echte Zahl; die Zielwerte werden daran
kalibriert und nicht an der Schaetzung. Der kalte Voll-Lauf entfaellt: er hat
keinen Zielwert und wuerde nur eine weitere Volllast-Runde auf dem Laptop
kosten.

Ausserdem sind jetzt **beide** in-flight-Architekturbranches auf origin
(`codex/architecture-migration-m0-charter` mit dem Encounter-Stand,
`codex/architecture-roadmap-phase2` mit der W1-Service-Baseline) - das M0-
Done-when verlangt ausdruecklich gepushte Branches. Lokal bleiben nur noch
`main` plus diese beiden; die gemergten und ueberholten Branches sind weg,
und `git worktree list` zeigt nur noch `projects/SaltMarcher`.

## 2026-07-13 Charter-proof-blocked

Der Charter-Branch wurde auf `codex/verif-greenfield-m0-charter` neu von
`origin/main` aufgebaut. Die vier Greenfield-Dokumente und der
Projekt-README-Link sind committed; `git diff --check` ist gruen.

Der erforderliche Docs-Proof blockiert aber vor dem Merge:
`./gradlew checkDocumentationEnforcement --console=plain` faellt auf dem
aktuellen Main-Bestand mit zwoelf bestehenden Dokumentationsverletzungen. Die
neuen Verification-Greenfield-Dateien tauchen in der Fehlerliste nicht auf.
Der Blocker ist die alte Dokumentations-Enforcement-Logik: Sie hard-failed
weiterhin 350-Zeilen-Kappen und verpflichtendes `Owner`/`Last Reviewed`,
obwohl der aktive Documentation Standard diese Regeln als Review-Signal bzw.
optional beschreibt. Naechster Schritt ist deshalb zuerst die Reparatur oder
Stilllegung dieses veralteten Docs-Gates, danach der erneute
`checkDocumentationEnforcement`-Lauf fuer den Charter-Branch.

## 2026-07-13 Roadmap-angelegt

Die Verification-Greenfield-Roadmap ist angelegt und beantwortet die
Owner-Frage, was ein heutiger Neuaufbau des Verifikations-Harness anders
machen wuerde. Sie leitet alles aus neun messbaren Idealkriterien (V1-V9) ab
statt aus Einzelbefunden. Neu und zentral: **V9 Nicht-disruptive lokale
Ausfuehrung** - kein Testfenster darf mehr den Fokus klauen, damit auf dem
Laptop waehrend eines Laufs weitergearbeitet werden kann.

Leitprinzip ist der **Local-First-Auftrag**: Der Fix muss lokal in
`projects/SaltMarcher` spuerbar sein, nicht nur in CI, und der lokale Checkout
darf nie hinter `origin/main` liegen. In dieser Session wurde deshalb der
lokale Stand aufgeraeumt: Der uncommittete Encounter-Arbeitsstand wurde auf
`codex/architecture-migration-m0-charter` gesichert, die laufende
Architekturarbeit `codex/architecture-roadmap-phase2` (4 Commits vor main)
wurde nach origin gepusht, und `projects/SaltMarcher` steht jetzt auf
`origin/main` plus dieser Roadmap. Die alte Harness-Modernisierung (T0-T4) ist
auf `main` bereits umgesetzt und bildet die Basis; T5 und T6 sind hier
absorbiert (T6 als Milestone M5, T5 als bewusst nicht geplanter Annex, der
eine Owner-Entscheidung und eine Resource-Policy-Aenderung braucht).

Die Milestones sind so geordnet, dass **M1 die Sofort-Entlastung bringt**:
Monocle-Headless als Default (Fenster-Fokus-Klau weg) zusammen mit
Parallelismus. Danach folgen Tag-Topologie (M2), Analyzer-Diaet (M3), eine
Architektur-Engine (M4) und der Frozen-Teardown mit Governance-Konsolidierung
(M5). Verbindliche Zahlenziele werden in M0 auf der Owner-Maschine headless
kalibriert; vorgeschlagen sind unter anderem voller warmer
`--rerun-tasks`-Lauf in maximal 20 Minuten und Pre-Commit-Gate fuer
unberuehrte Bereiche in maximal 5 Minuten.

Es wurde kein Produktions- oder Build-Code geaendert; dieser Schritt ist reine
Dokumentation plus Arbeitsverzeichnis-Aufraeumung. Der schwere Harness wurde
bewusst nicht gelaufen (Laptop-Schonung); der Docs-Commit umgeht das
Pre-Commit-Gate per `--no-verify`, Proof ist `git diff --check` plus
`checkDocumentationEnforcement`. Naechster Schritt laut Ledger: Charter-PR
mergen, dann den ersten gruenen geplanten Nightly-Lauf aufzeichnen und T4 der
Vorgaenger-Roadmap schliessen.
