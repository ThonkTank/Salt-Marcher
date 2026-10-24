# SaltMarcher-Profil

Arbeitskopie, Integrationszweig und Checkpoint stehen unter `roles.maintainer`
im lokal benannten PROJECT.json. Hostpfade und Chat-IDs bleiben dort.
Gemeinsame Ausführung: `tools/agent-setup/HEARTBEAT-RULES.md` der aktuellen eigenen
Produktkopie. Die Pflege nutzt ihren festen Moduswechsel, keine Zufallsauswahl.

## Zuständige Quellen nur nach Bedarf

- Einstieg: `docs/INDEX.md`; aktueller Atlasweg: `docs/atlas/guide.md`.
  `docs/project/requirements/product.md` erklärt Zweck und Gesamtziel.
- Soll/Bindungen: zuständiger Teil von `docs/project/requirements/scope.md` und `docs/project/requirements/sources.json`.
  Originalrevisionen, Hashes und Anforderungen erhalten.
- Technik: betroffener Abschnitt von `docs/project/architecture/overview.md`. Electron/TypeScript/SQLite
  unter `desktop/` und `src/app/`; Obsidian-Anschlüsse bleiben Referenz.
- Abnahme: passende IDs/Teilbäume von `acceptance.json` gezielt auslesen, niemals
  das große Register pauschal laden. Implementation, automatisierte Evidenz,
  native Qualifikation und Ownerabnahme sind getrennte Aussagen.

Aktuelle menschlich gepflegte Quellen, Tests, Werkzeuge und Markdown auf
Entwicklernutzen durchsehen. Generierte Daten, Drittquellen, Binärassets und
gebundene Originalbelege brauchen keine Stilüberarbeitung: Erhalt, Verbraucher
und Verlinkung prüfen, fachliche Teilfragen gezielt erschließen. Kein historischer
Ordner ist pauschal nutzlos oder ungeprüft vollständig erledigt.

## Zusammenarbeit und Lieferung

Nur diese beauftragte Pflegerrolle darf parallele lokale SaltMarcher-Chats lesend
zur Bedarfsermittlung erschließen. Zugehörigkeit anhand aktueller Projekt-/
Rollenquellen und Automationsziele feststellen, nicht nur alter CWDs. Keine
Nachrichten, privaten Denkprozesse oder fremden Kontrollurteile übernehmen.
Laufende überlappende Arbeit berücksichtigen, keine neuen Locks.

Main besitzt native Fähigkeiten/kanonischen Store; Renderer bleibt auf der
Preload-Brücke. `CampaignWorkbench`, Formatkennungen, Nutzertexte, IDs und
History-/Recoverysemantik erhalten. Keine Nebenbei-Features oder Datenmigration.

Node 22/npm. Vor Integration die sechs vom Nutzer vorgegebenen Checks
`check:repo`, `check`, `check:desktop`, `test`, `build`, `build:desktop` ausführen;
relevante native Prüfungen nur bei betroffenen Wegen laden. Aktuelles AGENTS.md
und echte Branchregeln beachten. Eigene fertige Änderungen auf aktuellem
`origin/main`, lineare Integration, echte `Candidate · exact-SHA aggregate`-CI.
Nach Fetch den integrierten eigenen Commit im entfernten Main nachweisen.
Danach auch die eigene weitere Arbeitskopie auf aktuellen Main bringen und dort
`git merge-base --is-ancestor origin/main HEAD` erfolgreich prüfen; vor jeder
Wiederaufnahme erneut abgleichen. Ein alter Checkpoint-Branch ersetzt das nicht.
Kein Force-Push oder Übernehmen fremder schmutziger Kopien. Installierte Skill-
und Setupfassungen gezielt synchronisieren, fremde lokale Änderungen erhalten.
