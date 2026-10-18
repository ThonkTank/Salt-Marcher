# SaltMarcher: Projekteinstieg

Status: Aktuell
Owner: SaltMarcher
Last Reviewed: 2026-10-16
Source of Truth: tools/agent-setup/README.md

Die vier Hauptrollen arbeiten unabhängig am vollständigen Produkt. Jede Rolle liest ihren Skill; andere Quellen nur nach Bedarf.

| Rolle | Rollenauftrag |
|---|---|
| Idealist Implementer: Produktambition und Tempo | $idealist-implementer |
| Practical Planner: Voraussicht und Tragfähigkeit | $practical-planner |
| Restrained Realist: Einfachheit und dauerhafter Aufwand | $restrained-realist |
| GM-UX-QA: tatsächliche Gebrauchstauglichkeit | $gm-ux-qa |
| Zusätzliche Code-/Doku-Pflege: Entwicklerverständlichkeit und gezielte Lesewege | [code-and-docs-maintainer](skills/code-and-docs-maintainer/SKILL.md) |

- Gemeinsame Ausführung: [HEARTBEAT-RULES.md](HEARTBEAT-RULES.md).
- Lokale Betriebsangaben: PROJECT.json enthält Repositoryidentität, gemeinsamen Integrationszweig, eigene Rollenarbeitskopien und Checkpoints, Projektzuordnung sowie Launcher-/UI-Pfade. Der gemeinsame Repositorypfad ist keine Schreibfreigabe für fremde Arbeit.
- Produktquellen: docs/PRODUCT.md, docs/SCOPE.md, docs/INDEX.md und relevante aktuelle Planung in der eigenen synchronisierten Produktkopie. Maßgeblich ist der gemeinsame Integrationsstand, keine zufällige lokale Änderung einer anderen Rolle.
- Zufallseinstieg: Nach dem Git-Abgleich einmal `codex-dungeon-focus .` in der eigenen Produktkopie ausführen. Das Skript zieht eine Originalanforderung samt Thema und fest gebundener Quelle als Schwerpunkt; die Rollenperspektive bleibt erhalten. Einzelheiten stehen in den gemeinsamen Projektregeln.
- Native Bedienhilfe: [OPERATIONS.md](OPERATIONS.md). Zeitplan, Aktivierung und Berechtigungen: tatsächliche Automation/Chatkonfiguration.
- Arbeitsstand: der eigene Checkpoint aus PROJECT.json. Den aktuellen Stand dort ersetzen, historische Originalbelege bei Bedarf über Verweise nutzen. Keine fremden Kontrollurteile übernehmen.

## Änderungen am Setup

Die Bearbeitungsquellen liegen unter tools/agent-setup im vorhandenen Produktrepository: Rollen-Skills, diese drei Projektdokumente und select-focus.py. Die lokalen Skilldateien und Projekt-Markdown-Dateien sind installierte Fassungen; select-focus.py wird ausführbar als codex-dungeon-focus im lokalen bin-Verzeichnis installiert. Änderungen in einer eigenen synchronisierten Kopie bearbeiten, Skills mit dem vorhandenen skill-creator-Validator und relevante Änderungen gezielt prüfen, anschließend die betreffenden Dateien an ihre bestehenden lokalen Installationsorte kopieren und byteweise vergleichen. Heartbeat-Aufträge weiterhin über die App aktualisieren, falls ihre Verweise geändert werden.

Die zusätzliche Pflege lädt nur ihre aktuelle Arbeitsanleitung: Aussagen aktuell halten → Doku bereinigen → Code auffindbarer → Code verständlicher → Wissenslücken schließen → Einstiege/Lesewege. Eine offene Aufgabe einschließlich Prüfung und Veröffentlichung zuerst abschließen. `roles.maintainer` in PROJECT.json benennt eigene Kopie und Checkpoint; der im Skill enthaltene Helfer verwaltet lokale Git-Durchsicht und zählt bei Bedarf Zeichen ohne Inhaltsausgabe. Das stillgelegte Studienledger bleibt unberührt.

Der Zufallseinstieg verwendet ausschließlich source_requirements aus dem vorhandenen Quellenregister docs/scope-sources.json: die dort gebundenen Originalanforderungen mit ihren Titeln und unveränderlichen Quell-URLs. Neu angelegte Pläne verändern weder die Auswahl noch die Gewichtung. Eine zusätzliche Themenliste oder Ziehungshistorie wird nicht gepflegt.

Hostpfade, Thread-/Projekt-IDs und private Arbeitsstände bleiben ausschließlich im lokalen PROJECT.json beziehungsweise den eigenen Checkpoints. Auf anderen Rechnern diese lokalen Angaben neu auflösen; keine fremden Einstellungen oder Erfolgsmeldungen übernehmen. Beim Einrichten den Integrationszweig gegen git ls-remote --symref origin HEAD prüfen. Auf diesem Linux-Rechner schützt der root-eigene Dienst codex-chat-protection@UID ausschließlich die installierte ChatGPT-App und ihre Codex-Steuerprozesse mit oom_score_adj=-1000 sowie OOMPolicy=continue/ManagedOOMPreference=omit in ihren systemd-Units. Installation und Rücknahme stehen in tools/chat-protection.md. Erst nach wirksamem Schutz und bestandenem isoliertem OOM-Test die alten Ressourcenlimits entfernen. Kein Rollen-Lock, Speicherbudget, Heaplimit oder Ressourcen-Watchdog. Für aufräumbare native UI-Prozessgruppen tools/ui-session.py als codex-ui-session installieren; die eigene Linux-Prozesssitzung benötigt keine systemd-Startwarteschlange. tools/agent-setup/run-ui.sh ist die Quelle der lokalen UI-Bedienhilfe. Builds und Tests brauchen keinen Ressourcenlauncher. Der vorhandene UI-Adapter dokumentiert die eigene Prozesssitzung und prüft ihre Identität. Für bereits auf ui-ownership.patch aktualisierte Adapter ergänzt ui-session.patch diese Zuordnung (mit git apply --unsafe-paths --directory=ADAPTERPFAD und dem absoluten Patchpfad anwenden). Quellen laufender Sitzungen nicht verändern; bei der Umstellung ihre Profile und Sitzungen erhalten.

Bestehende Chats bleiben im Projekt. Keine laufende Routingverwaltung. Eine tatsächlich falsche lokale Zuordnung kann bei Bedarf über den vorhandenen assign_project.py-Weg mit echter Thread-ID repariert werden; kein Ersatzprojekt, kein App-Neustart und keine Ersatzstarts bei unklarer Erstellung.

Das frühere Studienprogramm ist stillgelegt. Originaldateien, Tests, Quellkopien und Belege bleiben erhalten; einzelne Altdateien sind technische Imports der UI-Bedienhilfe. Daraus keine aktuellen Arbeitsaufträge, Bereitschaftsangaben oder Pflegepflichten ableiten. Historie bleibt über bestehende Checkpoint-Verweise erreichbar.
