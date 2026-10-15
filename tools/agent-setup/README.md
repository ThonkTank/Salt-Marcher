# Dungeon Editor: Projekteinstieg

Die vier Hauptrollen arbeiten unabhängig am vollständigen Produkt. Jede Rolle liest ihren Skill; andere Quellen nur nach Bedarf.

| Rolle | Rollenauftrag |
|---|---|
| Idealist Implementer: Produktambition und Tempo | $idealist-implementer |
| Practical Planner: Voraussicht und Tragfähigkeit | $practical-planner |
| Restrained Realist: Einfachheit und dauerhafter Aufwand | $restrained-realist |
| GM-UX-QA: tatsächliche Gebrauchstauglichkeit | $gm-ux-qa |

- Gemeinsame Ausführung: [HEARTBEAT-RULES.md](HEARTBEAT-RULES.md).
- Lokale Betriebsangaben: PROJECT.json enthält Repositoryidentität, gemeinsamen Integrationszweig, eigene Rollenarbeitskopien und Checkpoints, Projektzuordnung sowie Launcher-/UI-Pfade. Der gemeinsame Repositorypfad ist keine Schreibfreigabe für fremde Arbeit.
- Produktquellen: docs/PRODUCT.md, docs/SCOPE.md, docs/INDEX.md und relevante aktuelle Planung in der eigenen synchronisierten Produktkopie. Maßgeblich ist der gemeinsame Integrationsstand, keine zufällige lokale Änderung einer anderen Rolle.
- Native Bedienhilfe: [OPERATIONS.md](OPERATIONS.md). Zeitplan, Aktivierung und Berechtigungen: tatsächliche Automation/Chatkonfiguration.
- Arbeitsstand: der eigene Checkpoint aus PROJECT.json. Den aktuellen Stand dort ersetzen, historische Originalbelege bei Bedarf über Verweise nutzen. Keine fremden Kontrollurteile übernehmen.

## Änderungen am Setup

Die Bearbeitungsquellen liegen unter tools/agent-setup im vorhandenen Produktrepository: vier Skilldateien und diese drei Projektdokumente. Die lokalen Skilldateien und Projekt-Markdown-Dateien sind installierte Fassungen. Änderungen in einer eigenen synchronisierten Kopie bearbeiten, Skills mit dem vorhandenen skill-creator-Validator und relevante Änderungen gezielt prüfen, anschließend die betreffenden Dateien an ihre bestehenden lokalen Installationsorte kopieren und byteweise vergleichen. Heartbeat-Aufträge weiterhin über die App aktualisieren, falls ihre Verweise geändert werden.

Hostpfade, Thread-/Projekt-IDs und private Arbeitsstände bleiben ausschließlich im lokalen PROJECT.json beziehungsweise den eigenen Checkpoints. Auf anderen Rechnern diese lokalen Angaben neu auflösen; keine fremden Einstellungen oder Erfolgsmeldungen übernehmen. Beim Einrichten den Integrationszweig gegen git ls-remote --symref origin HEAD prüfen. Den aktuellen Launcher aus tools/codex-dungeon-job.py gezielt am konfigurierten lokalen Pfad installieren und vergleichen. Die bestehende gemeinsame systemd-User-Slice codex-dungeon-jobs.slice behält MemoryHigh=20G, MemoryMax=22G, MemorySwapMax=0 und TasksMax=1024; CPUWeight=25 ersetzt ihre CPUQuota. Nach Änderungen daemon-reload ausführen und die wirksamen Eigenschaften einschließlich vorhandener Drop-ins prüfen. Jobs behalten ihre eigenen 3G/4G-Speichergrenzen, Swap 0, Nice=5 und 20 Minuten Watchdog; weder Jobs noch gemeinsame Slice erhalten eine CPUQuota oder pauschale Threadzahlvorgaben.

Bestehende Chats bleiben im Projekt. Keine laufende Routingverwaltung. Eine tatsächlich falsche lokale Zuordnung kann bei Bedarf über den vorhandenen assign_project.py-Weg mit echter Thread-ID repariert werden; kein Ersatzprojekt, kein App-Neustart und keine Ersatzstarts bei unklarer Erstellung.

Das frühere Studienprogramm ist stillgelegt. Originaldateien, Tests, Quellkopien und Belege bleiben erhalten; einzelne Altdateien sind technische Imports der UI-Bedienhilfe. Daraus keine aktuellen Arbeitsaufträge, Bereitschaftsangaben oder Pflegepflichten ableiten. Historie bleibt über bestehende Checkpoint-Verweise erreichbar.
