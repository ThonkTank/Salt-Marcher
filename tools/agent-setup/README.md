# SaltMarcher: Projekteinstieg

Status: Aktuell
Owner: SaltMarcher
Last Reviewed: 2026-10-25
Source of Truth: tools/agent-setup/README.md

Die folgenden Rollen arbeiten am Produkt. Jede Rolle liest ihren Skill; andere Quellen nur nach Bedarf.

| Rolle | Rollenauftrag |
|---|---|
| Idealist Implementer: Produktambition und Tempo | $idealist-implementer |
| Practical Planner: Voraussicht und Tragfähigkeit | $practical-planner |
| GM-UX-QA: tatsächliche Gebrauchstauglichkeit | $gm-ux-qa |

- Gemeinsame Ausführung: [HEARTBEAT-RULES.md](HEARTBEAT-RULES.md).
- Lokale Betriebsangaben: PROJECT.json enthält Repositoryidentität, gemeinsamen Integrationszweig, Projektzuordnung sowie Launcher-/UI-Pfade. Der gemeinsame Repositorypfad ist keine Schreibfreigabe für fremde Arbeit.
- Produktquellen: docs/PRODUCT.md, docs/SCOPE.md, docs/INDEX.md und relevante aktuelle Planung in der eigenen synchronisierten Produktkopie. Maßgeblich ist der gemeinsame Integrationsstand, keine zufällige lokale Änderung einer anderen Rolle.
- Originalanforderungs-Auswahl für den Implementer: Nach dem Git-Abgleich einmal `codex-dungeon-focus .` in der eigenen Produktkopie ausführen. Das Skript zieht eine Originalanforderung samt Thema und fest gebundener Quelle als Schwerpunkt; die Rollenperspektive bleibt erhalten. Einzelheiten stehen in den gemeinsamen Projektregeln.
- Capability-Auswahl: `select-capability.py` wird als `codex-dungeon-capability` installiert. Planner und GM UX QA verwenden `all --rolle planner|qa`; Bereichstester wählen `map|notes|encounter` und die gleichnamige Rolle. Der gemeinsame Katalog liegt unter `~/.local/share/saltmarcher/capabilities/capabilities.json`. Einzelheiten stehen unten und im jeweiligen Rollen-Skill.
- Native Bedienhilfe: [OPERATIONS.md](OPERATIONS.md). Zeitplan, Aktivierung und Berechtigungen: tatsächliche Automation/Chatkonfiguration.
- Arbeitsstand und nächste Schritte bleiben im Chat. Neue Chats beginnen nur mit ihrem Auftrag am aktuellen Produktstand; alte Arbeitsstände und Rollenbranches werden nicht übernommen. Keine Checkpoint- oder Übergabedateien pflegen.

## Capability-Katalog

Die Datei enthält `capabilities` und `auswahlen_pro_rolle`. Pro Ablauf bleiben `bereiche`, `ablauf` und `verglichen_mit` erhalten; `testdateien` enthält repositoryrelative Testdateien. `zuletzt_ausgewaehlt` und `zuletzt_geprueft` sind UTC-Zeitpunkte oder `null`. Die letzte Berücksichtigung ist der spätere dieser beiden Zeitpunkte. Unbekannte Zeitpunkte kommen zuerst, Gleichstände folgen der Katalogreihenfolge.

Jede Rolle hat zwei Bestandseinstiege und anschließend „Neue Capability“. Leere Bereichskataloge bieten sofort einen neuen Ablauf an. `all` ohne `--rolle` verwendet weiterhin QA; Bereichsaufrufe verwenden ihre gleichnamige Rolle. Ein neuer Eintrag wird als jetzt ausgewählt, aber noch nicht geprüft angelegt. Abgebrochene Bearbeitungen kehren nach einer Runde zurück. Auswahlzähler und Datumsangaben gehören zum gemeinsamen Katalog, nicht zu einem Chat-Checkpoint. Kurze Dateisperren und atomare Schreibvorgänge erhalten parallele Änderungen.

- Anlegen: `codex-dungeon-capability --ablauf "…" --bereiche reference session`.
- Testdateien zuordnen: `codex-dungeon-capability --ablauf "…" --tests tests/beispiel.test.mjs`.
- Nach eigener fachlicher Prüfung: `codex-dungeon-capability --ablauf "…" --geprueft`, auch bei Fehlbefunden; keine Bestätigung durch bloßes Lesen oder allgemeines Testgrün.
- Vergleichsprodukt nach vollständigem tatsächlichem Vergleich: `--ablauf "…" --verglichen-mit "Obsidian"`.
- Beim Umbenennen neue Pfade mit `--tests` hinzufügen und alte mit `--entferne-tests` entfernen. Entfernte Dateien ausdrücklich austragen.
- Gegenansicht: `codex-dungeon-capability --testuebersicht --repo PFAD`. Sie zeigt versionierte `*.test.*`, native `tools/test-desktop-*.mjs` und sämtliche zugeordneten Dateien einschließlich fehlender Dateien. Nicht zugeordnet bedeutet nicht überflüssig. Eine Datei kann mehrere Abläufe absichern; die Zuordnung ersetzt keine Prüfung der tatsächlichen Abdeckung.

Dateizugänge werden gegen `--repo` beziehungsweise die Git-Wurzel des aktuellen Arbeitsverzeichnisses geprüft. Die Gegenansicht schreibt keine Daten. `--migrieren` überführt das frühere Listenformat ohne erfundene Prüfungen; normale Auswahl- und Schreibaufrufe lesen beide Formate. Die Zuordnung des Testbestands wächst bei jeder Bearbeitung; keine Pflicht zur vollständigen Inventur in einem Lauf oder zu zusätzlichen Berichten.

## Struktureller Rückblick nach zehn Läufen

QA und Planner prüfen zu Beginn eines Automationslaufs mit `codex-dungeon-review --automation AUTOMATIONS_ID` ihren Rhythmus. `heartbeat-review.py` wird dafür als `codex-dungeon-review` installiert. Der Helfer liest nur die native Chat-Historie unter `CODEX_HOME` beziehungsweise `~/.codex`; `CODEX_THREAD_ID` bestimmt den eigenen Chat. Für gezielte Prüfung sind `--thread` und `--history` verfügbar.

Gezählt werden tatsächliche Heartbeat-Aufrufe der genannten Automation im aktuellen Chat, einschließlich laufender, fehlgeschlagener und abgebrochener Läufe. Manuelle Nachrichten und fremde Chats zählen nicht. Die Ausgabe enthält `lauf`, `strukturrueckblick` und `naechster_rueckblick_bei`. Bei Lauf 10, 20, 30 usw. hat der Rollenauftrag zum strukturellen Rückblick Vorrang vor einer neuen Themenwahl. Maßgeblich sind die letzten rund zwölf selbst gefundenen Probleme, kein künstlich gefüllter Katalog oder zusätzlicher Pflichtbericht. Eine gestartete strukturelle Korrektur wird bis zum Abschluss weitergeführt.

Der Rhythmus benötigt keinen eigenen Zählerstand, keine neue Automation und keine Checkpoint-Datei. Ein neuer Chat beginnt bei seinem ersten eigenen Heartbeat. Bestehende Chat-Läufe zählen weiter; vergangene Rückblicktermine werden nicht nachträglich als erledigt behauptet. Bei unlesbarer oder fehlender Historie meldet der Helfer einen Fehler statt einer erfundenen Laufzahl; die Rolle nennt die Unsicherheit und arbeitet sinnvoll weiter.

## Änderungen am Setup

Die Bearbeitungsquellen liegen unter tools/agent-setup im vorhandenen Produktrepository: Rollen-Skills, diese drei Projektdokumente sowie select-focus.py, select-capability.py und heartbeat-review.py. Die lokalen Skilldateien und Projekt-Markdown-Dateien sind installierte Fassungen; select-focus.py wird ausführbar als codex-dungeon-focus im lokalen bin-Verzeichnis installiert. Änderungen in einer eigenen synchronisierten Kopie bearbeiten, Skills mit dem vorhandenen skill-creator-Validator und relevante Änderungen gezielt prüfen, anschließend die betreffenden Dateien an ihre bestehenden lokalen Installationsorte kopieren und byteweise vergleichen. Heartbeat-Aufträge weiterhin über die App aktualisieren, falls ihre Verweise geändert werden.

Der Originalanforderungs-Einstieg des Implementers verwendet ausschließlich source_requirements aus dem vorhandenen Quellenregister docs/scope-sources.json: die dort gebundenen Originalanforderungen mit ihren Titeln und unveränderlichen Quell-URLs. Neu angelegte Pläne verändern weder die Auswahl noch die Gewichtung. Eine zusätzliche Themenliste oder Ziehungshistorie wird nicht gepflegt.

Technische Hostpfade und Projekt-IDs stehen ausschließlich im lokalen PROJECT.json; dort keine Rollenbranches oder privaten Arbeitsstände speichern. Auf anderen Rechnern diese lokalen Angaben neu auflösen; keine fremden Einstellungen oder Erfolgsmeldungen übernehmen. Beim Einrichten den Integrationszweig gegen git ls-remote --symref origin HEAD prüfen. Auf diesem Linux-Rechner schützt der root-eigene Dienst codex-chat-protection@UID ausschließlich die installierte ChatGPT-App und ihre Codex-Steuerprozesse mit oom_score_adj=-1000 sowie OOMPolicy=continue/ManagedOOMPreference=omit in ihren systemd-Units. Installation und Rücknahme stehen in tools/chat-protection.md. Erst nach wirksamem Schutz und bestandenem isoliertem OOM-Test die alten Ressourcenlimits entfernen. Kein Rollen-Lock, Speicherbudget, Heaplimit oder Ressourcen-Watchdog. Für aufräumbare native UI-Prozessgruppen tools/ui-session.py als codex-ui-session installieren; die eigene Linux-Prozesssitzung benötigt keine systemd-Startwarteschlange. tools/agent-setup/run-ui.sh ist die Quelle der lokalen UI-Bedienhilfe. Builds und Tests brauchen keinen Ressourcenlauncher. Der vorhandene UI-Adapter dokumentiert die eigene Prozesssitzung und prüft ihre Identität. Für bereits auf ui-ownership.patch aktualisierte Adapter ergänzt ui-session.patch diese Zuordnung (mit git apply --unsafe-paths --directory=ADAPTERPFAD und dem absoluten Patchpfad anwenden). Quellen laufender Sitzungen nicht verändern; bei der Umstellung ihre Profile und Sitzungen erhalten.

Bestehende Chats bleiben im Projekt. Keine laufende Routingverwaltung. Eine tatsächlich falsche lokale Zuordnung kann bei Bedarf über den vorhandenen assign_project.py-Weg mit echter Thread-ID repariert werden; kein Ersatzprojekt, kein App-Neustart und keine Ersatzstarts bei unklarer Erstellung.

Das frühere Studienprogramm ist stillgelegt. Originaldateien, Tests, Quellkopien und Belege bleiben erhalten; einzelne Altdateien sind technische Imports der UI-Bedienhilfe. Daraus keine aktuellen Arbeitsaufträge, Bereitschaftsangaben oder Pflegepflichten ableiten. Arbeitsverläufe bleiben in ihren Chats.
