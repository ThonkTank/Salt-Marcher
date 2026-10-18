# SaltMarcher-Profil

Arbeitskopie, Integrationszweig und Checkpoint stehen unter `roles.maintainer`
im lokal benannten PROJECT.json. Hostpfade und Chat-IDs bleiben dort.
Gemeinsame Ausführung: `tools/agent-setup/HEARTBEAT-RULES.md` der aktuellen eigenen
Produktkopie. Die Pflege nutzt ihren festen Moduswechsel, keine Zufallsauswahl.

## Zuständige Quellen nur nach Bedarf

- Einstieg: `docs/INDEX.md`; aktueller Atlasweg: `docs/ATLAS.md`.
  `docs/PRODUCT.md` erklärt Zweck und Gesamtziel.
- Soll/Bindungen: zuständiger Teil von `docs/SCOPE.md` und `docs/scope-sources.json`.
  Originalrevisionen, Hashes und Anforderungen erhalten.
- Technik: betroffener Abschnitt von `ARCHITECTURE.md`. Electron/TypeScript/SQLite
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
Nach Fetch eigenen veröffentlichten Commit im entfernten Main nachweisen.
Kein Force-Push oder Übernehmen fremder schmutziger Kopien. Installierte Skill-
und Setupfassungen gezielt synchronisieren, fremde lokale Änderungen erhalten.
