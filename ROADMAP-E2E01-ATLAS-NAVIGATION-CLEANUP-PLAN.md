# RUNTIME-I01b-CLEAN-P01: Abschluss des Atlas-Navigationskerns

Begrenzter eigener Aufräumplan vom 10. Oktober 2026 für
[E2E-01, Nutzerzeile 13](ROADMAP-E2E-GATES-CANDIDATE.md#e2e-01--kampagne-und-gemeinsamer-raum--saverestart).
Stadts tatsächlicher unabhängiger
[R02 auf `adc4b98`](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/pull/13#issuecomment-6094937083)
hat `RUNTIME-I01b-R01-01` geschlossen: Typprüfung, 551 Tests, sauberer Build
und vier unabhängige Gegenproben bestanden. Getestete integrierte Source ist
`81c6a257`; die Reparatur stammt aus `e982c2fa`. R01 bleibt als ursprünglicher
Fehlernachweis erhalten. Auch Stadts separate Reviewer-Aufräumfolge ist
[abgeschlossen](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/12#issuecomment-6094957819).

## Umfang und Erhaltung

**Die Löschliste ist leer.** Der Review verlangt keine weitere Produktänderung.
Der akzeptierte Auftragstoken und seine Prüfung nach der Aktivierungsantwort
bleiben erhalten. Kein Formatierungs- oder Refactoringpaket wird eröffnet.

Geschützt bleiben die vier Source-/Testdateien des Navigationspakets:
`src/features/atlas/atlas-campaign-navigation.ts`,
`src/features/atlas/atlas-repository.ts`,
`tests/core/atlas-campaign-navigation.test.ts` und `tests/core.test.ts`.
Der Runtimeplan, sämtliche Fixtures, native Kennungen und Markdowntexte bleiben
unverändert. Alle 45 eigenen I01b-/N01b-Belegdateien mit zusammen 32.451.869 Bytes
werden einschließlich fehlgeschlagener Läufe und ursprünglicher Gegenproben
aufbewahrt. Die exakte Erhaltungsmenge mit SHA-256 steht in
`/home/aaron/.cache/dungeon-native-qa/hex-03/runtime-navigation-i01b-cleanup-20261010/p01/retained-evidence-inventory.json`.
Fremde Belege und Checkpoint-Wurzeln, der ursprüngliche schmutzige Checkout,
Abhängigkeiten, der Nutzervault und `sources/` bleiben unangetastet.

## Getrennte Folge

1. **CLEAN-P01, dieser Lauf:** tatsächlichen R02 samt Hashbindung übernehmen,
   Plan und Erhaltungsmenge festlegen, eindeutiges JSON und erlaubten Diff
   prüfen; vor Veröffentlichung eingehenden Shared-Stand konsumieren.
2. **CLEAN-I01, nächster eigener Lauf:** frischen Repo-Stand konsumieren und
   geschützte Source-/Fixtureblobs sowie die 45 Belege gegen diesen Plan prüfen.
   Nur externen Erhaltungsbeleg und eigene Abschlussmetadaten schreiben.
   Keine Löschung und keine Produktänderung; bei Belegdrift konkret anhalten.
3. **CLEAN-R01, danach:** bestehender unabhängiger Stadtchat prüft genau den
   veröffentlichten Abschluss, Hashbindung und erlaubten Diff. Nur neue
   Pflichtbefunde erzeugen Nachbesserung; der bestandene Codereview wird nicht
   wiederholt.
4. Danach folgt **I01c, der sichtbare Atlasanschluss** aus dem bestehenden
   Runtimeplan. Stadt liefert das bestätigte neue `src/ui/atlas-detail-entry.ts`
   samt isoliertem DOM-Test; Hex montiert es im bestehenden Dock und hält
   AtlasView/Editor/Renderer/Repository, Quellenauflösung, Guards, Kamera,
   History und Speichern. Campaign/Data erhält den konkreten Provideranschluss
   des bereits exportierten `AtlasCampaignNavigationPorts`; kein neuer
   allgemeiner Plan- oder Ratifikationslauf.

Ziel bleibt Ort/Key → Stadt/Haus/Dungeon/Raum-Key → herauszoomen → gemeinsames
Undo/Redo → Save → frischer Start, in einem boundless Atlas ohne getrennte Modi.
Eigene Repoänderungen dieses Aufräumens betreffen ausschließlich diesen Plan,
`checkpoint.hexAtlasExecution` und `acceptance.hexAtlas`. Neue eingehende
Codeänderungen werden gesondert integriert und passend geprüft; unveränderte
Produktblobs brauchen keine Wiederholung bestandener Kernprüfungen für Metadaten.

## Grenzen dieses Abschlusses

Der Navigationskern ist mit tatsächlichen nativen Sources an kontrollierten
Ports geprüft. Produktive Registry-/Inventar-/Hostinstanzen, P02/P04, Import und
Mehrbesitzer-Publish bleiben konkrete Integrationsabhängigkeiten. R02 und dieses
Aufräumen liefern keinen neuen sichtbaren Host-, GUI-/Neustart-, Installations-,
Originalparitäts-, Großwelt-, physischen oder vollständigen E2E-Nachweis.
Der historische native I01b-Nachweis auf `88babcd` wird nicht überschrieben.
