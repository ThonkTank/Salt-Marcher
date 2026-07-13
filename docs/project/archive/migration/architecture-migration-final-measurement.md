Status: Active
Source of Truth: Final M6.3 architecture-migration measurement and German
closing report for the branch state after M6.2.

# Architektur-Migration Abschlussmessung

## Messpunkt

Baseline ist `d2d1cb4bde6d26be66ea88d726cfa7ac4bfbfcdd`, der Parent von
`0ff4c2f82` und damit der Stand unmittelbar vor dem Migrationsroadmap-Commit.
Finaler Messpunkt ist `b244aa2d5`, der Ledger-Stand nach M6.2
`governance-right-sizing`.

Dieser Bericht misst den Stand vor seiner eigenen Aufnahme. Die spaetere
Aufnahme dieses Berichts erhoeht deshalb nur die Dokumentationszeilen der
Abschlussdokumentation, nicht die Migrationsmessung selbst.

## Messformeln

- `tracked files`: alle getrackten Dateien aus `git ls-tree -r`.
- `tracked text LOC`: physische Zeilen aller getrackten nicht-binaeren Blobs.
- `production Java`: getrackte `.java`-Dateien unter `bootstrap/**`,
  `shell/**` und `src/**`.
- `documentation lines`: getrackte Markdown-Zeilen unter `docs/**`,
  `AGENTS.md` und `tools/quality/skills/**`.
- `checker sources`: erste eigene Check-/Rule-/Task-Quellen in
  build-harness, Error Prone, PMD-Quality-Rules und Gradle-Quality-Tasks.
- `role-family checker/policy sources`: die alte Role-Family-Formel:
  Error-Prone-Checker ausser `NearMiss*`, `tools/quality/architecture-policy`,
  und build-harness Topology-/Boundary-/Role-Regeln fuer bootstrap, data,
  domain, feature, shell, view, domain-context und passive carrier mirrors.
- `average chain length`: ungewichteter Mittelwert der 13 Ledger-Areas aus
  akzeptierten Baseline-Dominantketten und den final akzeptierten
  Design-/Conformance-Ketten. Das ist kein statischer Callgraph; es ist die
  im Migrationsprozess judge-gepruefte meaningful-hop-Metrik.

## Repo-Metriken

| Metrik | Vor Migration | Nach M6.2 | Delta |
| --- | ---: | ---: | ---: |
| Getrackte Dateien | 2.017 | 1.601 | -416 (-20,6 %) |
| Getrackte Text-LOC | 216.768 | 188.361 | -28.407 (-13,1 %) |
| Produkt-Java-Dateien | 1.496 | 1.214 | -282 (-18,9 %) |
| Produkt-Java-LOC | 124.831 | 114.411 | -10.420 (-8,3 %) |
| Dokumentationsdateien | 184 | 181 | -3 (-1,6 %) |
| Dokumentationszeilen | 18.489 | 21.775 | +3.286 (+17,8 %) |
| Erste Check-/Rule-/Task-Quellen | 128 | 38 | -90 (-70,3 %) |
| Alte Role-Family-Checker/Policy-Quellen | 83 | 0 | -83 (-100 %) |
| Durchschnittliche Area-Chain-Laenge | 7,62 | 4,62 | -3,00 (-39,4 %) |

Die Dokumentationszeilen sind der einzige steigende Wert. Der Anstieg ist kein
erneutes Strukturdoctrine-Wachstum, sondern kommt aus behaltenen
Migrationsbelegen: Ledger, Baseline-Artefakte, Target Designs, Owner-Smokes und
Statusnotizen. M6.1/M6.2 haben die aktiven Instruktionsoberflaechen trotzdem
verkleinert: `AGENTS.md` steht bei 73 Zeilen, und die aktive
Source-Architecture-Erklaerung bleibt bei 69 Zeilen.

## Chain-Messung

| Area | Baseline hops | Final akzeptierte hops |
| --- | ---: | ---: |
| `hex` | 5 | 3 |
| `worldplanner` | 5 | 3 |
| `creatures` | 7 | 3 |
| `party` | 5 | 3 |
| `sessionplanner` | 6 | 3 |
| `encountertable` | 5 | 3 |
| `encounter` | 13 | 5 |
| `dungeon-authored-core` | 7 | 5 |
| `dungeon-editor-session-runtime` | 11 | 7 |
| `dungeon-travel` | 11 | 7 |
| `dungeon-rendering-pipeline` | 13 | 11 |
| `dungeon-editor-view` | 5 | 4 |
| `remaining-view-and-shell` | 6 | 3 |

Die groessten Restketten sind die drei judge-akzeptierten Dungeon-Ausnahmen.
Sie behalten echte Runtime-, Travel- und Render-Verantwortung statt Wrapper nur
umzubenennen. Die Migrationsreviews haben diese Ausnahmen einzeln akzeptiert;
eine pauschale Zielaufweichung wurde nicht benutzt.

## Abschlussbefund

Die alte Role-Family-Architektur wird auf den aktiven Oberflaechen nicht mehr
gelehrt oder durchgesetzt. Live-Instruktions- und Governance-Texte enthalten
nur negative/retirierende Hinweise auf Role-Family-Formchecks. Die
reproduzierbare Role-Family-Checker/Policy-Zaehlliste ist leer; die
verbleibenden Checkquellen sind Outcome-, Hygiene-, Packaging-, Near-Miss- oder
retained Strukturpruefung.

Alle Ledger-Areas stehen auf `Done on branch`. Die letzte Production-Handoff-
Pflicht fuer produktive Codeaenderungen wurde in M5 gruen erfuellt; M6.1 bis
M6.3 sind Dokumentations-/Governance-Arbeit und verwenden bewusst keinen
entfernten Doc-Gate-Pfad. Die Migration ist auf diesem Branch technisch
abgeschlossen, sobald dieser Bericht, der Ledger-Abschluss und die
abschliessende Judge-Pruefung committed sind.
