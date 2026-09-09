# Editoranbindungen für Release-Wartung

Referenz: [Phase 4 der Roadmap](release-maintenance-roadmap.md).
Ausführungsnachweise und verbleibende Fehler: [Execution-Log](../../roadmap-execution.md).

Die folgenden produktiven Teilnehmer verwenden `useMaintenanceDraft`; die
Fachlogik für Speichern und Verwerfen bleibt jeweils bei ihnen. Dateinamen in der
Tabelle liegen unter `src/renderer/features/`, Tests unter `tests/unit/`.
Die Aufstellung dokumentiert Registrierungen und ihre Abnahme, sie ersetzt keinen
Nachweis des vollständigen AppImage-Updatewegs.

| Bereich | Registrierung | Gezielte Abnahme |
| --- | --- | --- |
| Kampagnenverwaltung | workspace/campaign-screen.tsx | campaign-screen.test.tsx |
| Laufender Kampagnenwechsel | workspace/use-campaign-session-coordinator.ts | campaign-screen-coordinator.test.tsx |
| Generator-Preset | workspace/encounter-generator-settings.tsx | encounter-generator-settings.test.tsx |
| Kampagnen-Belohnungsregel | workspace/campaign-reward-rules-card.tsx | reward-rules-maintenance.test.tsx |
| Sitzungsplanung mit abhängigen Dialogen | session-planner/use-planner-maintenance.ts | session-planner-maintenance.test.tsx, session-planner-maintenance-ports.test.tsx |
| Gruppenentwürfe | session/use-group-manager-controller.ts | group-manager-maintenance.test.tsx |
| Gruppenaktionen | session/use-group-lifecycle.tsx | group-lifecycle-ui.test.tsx, group-lifecycle-controller.test.ts |
| Szenenaktionen | session/use-scene-commands.tsx | scene-command-maintenance.test.tsx |
| Charakterkatalog | party/character-catalog-section.tsx | character-library.test.tsx |
| XP-Entwurf | scene-desktop/desktop-xp-action.tsx | desktop-roster-actions.test.tsx; SceneDesktop-Electronfälle |
| Besetzung/Verschieben | scene-desktop/desktop-roster-actions.tsx | desktop-roster-actions.test.tsx |
| Gewählte Rast | scene-desktop/desktop-rest-action.tsx | desktop-roster-actions.test.tsx; SceneDesktop-Electronfälle |
| Kampfaktionen und Kampfentwürfe | encounter/use-combat-commands.tsx, encounter/use-combat-draft.ts | combat-maintenance.test.tsx |
| Reiseaktionen und Routenentwurf (getrennte Teilnehmer) | hex/use-hex-travel-command-owner.tsx | hex-travel-command-owner.test.tsx, hex-route-plan-draft.test.ts, session-travel-console.test.tsx |
| Hexkartendialog | hex/hex-map-dialog.tsx | hex-map-maintenance-draft.test.tsx |
| Ort und abhängige Neuanlagen | worldplanner/world-location-dialog.tsx | location-maintenance-draft.test.tsx |
| Fraktion und abhängiger Dialog | worldplanner/use-world-faction-editor-controller.ts | faction-maintenance-draft.test.tsx |
| NSC | catalog/npc-catalog-editor.tsx | npc-maintenance-draft.test.tsx |
| Begegnungstabelle | encounter-table/encounter-table-manager.tsx | table-maintenance-draft.test.tsx |
| Schatz | loot/treasure-editor-dialog.tsx | treasure-editor-maintenance.test.tsx, treasure-editor-maintenance-ports.test.tsx |
| Beuteverteilung | loot/reward-distribution-dialog.tsx | reward-distribution-maintenance.test.tsx, reward-distribution-maintenance-ports.test.tsx |
| Persönliche Beute | loot/character-loot-ledger-dialog.tsx | character-ledger-maintenance.test.tsx, character-loot-maintenance-ports.test.tsx |

Zusätzlich meldet `scene-desktop/desktop-projection.ts` seine automatische
Persistenz direkt an. `scene-desktop-maintenance.test.ts` prüft das Abschließen
laufender Writes, Fehlerklärung und Verwerfen.

Nach Abhängen einer Ansicht bleiben unklare Befehle bei den bestehenden
Controllern registriert: CharacterCommandController, ScenePartyCommandController,
SceneCommandController, GroupLifecycleController, CombatCommandController und
HexTravelCommandController. HexRoutePlanDraft behält außerdem ungesendete
Routenentwürfe. Diese Registrierungen besitzen eigene Save-/Discard-Funktionen;
sie erzeugen keinen Ersatzauftrag beim bloßen Schließen einer Ansicht.

Die gemeinsame Koordination prüft Abhängigkeiten, Teilerfolge und verbleibende
Änderungen vor Freigabe. Fehlende Save-/Discard-Funktionen führen weiterhin zu
einem Fehler statt zur Freigabe. Der frühere `useMaintenanceDraftGuard`, der nur
ein Dirty-Flag registrierte, hat keine produktiven Aufrufer mehr und wurde entfernt.

Updateprüfung, Download und Installation werden separat in
`release-update-ui.test.tsx` geprüft. `draft-transition.test.tsx`,
`maintenance-draft-coordinator.test.ts` und `session-travel-console.test.tsx`
prüfen gemeinsame Entscheidungen, Teilerfolge und Eingabesperren. Die
Release-Artefaktqualifikation bleibt Phase 5.
