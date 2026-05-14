package src.domain.dungeoneditor.application;

import src.domain.dungeoneditor.model.session.model.DungeonEditorDungeonFacts;
import src.domain.dungeoneditor.model.session.model.DungeonEditorSession;
import src.domain.dungeoneditor.model.session.model.DungeonEditorSessionCommand;
import src.domain.dungeoneditor.model.session.port.DungeonEditorDungeonPort;
import src.domain.dungeoneditor.model.session.repository.DungeonEditorDungeonRepository;
import src.domain.dungeoneditor.model.workspace.model.DungeonEditorWorkspaceValues;

final class DungeonEditorSessionCatalogUseCase {
    private final DungeonEditorDungeonRepository dungeonRepository;
    private final DungeonEditorDungeonPort dungeonPort;
    private final DungeonEditorSessionInteractionUseCase interactionWorkflow;

    DungeonEditorSessionCatalogUseCase(
            DungeonEditorDungeonRepository dungeonRepository,
            DungeonEditorDungeonPort dungeonPort,
            DungeonEditorSessionInteractionUseCase interactionWorkflow
    ) {
        this.dungeonRepository = dungeonRepository;
        this.dungeonPort = dungeonPort;
        this.interactionWorkflow = interactionWorkflow;
    }

    DungeonEditorSession apply(DungeonEditorSession session, DungeonEditorSessionCommand command) {
        if (command.action().isSelectMapAction()) {
            return clearTransientState(session.withSelectedMap(command.mapId()).clearSelection(), "");
        }
        if (command.action().isMapMutationAction()) {
            return applyCatalogMutation(session, command);
        }
        if (command.action().isSessionSettingAction()) {
            return applySessionSetting(session, command);
        }
        return session;
    }

    private DungeonEditorSession applyCatalogMutation(DungeonEditorSession session, DungeonEditorSessionCommand command) {
        String mapName = command.mapName();
        applyCatalogCommand(command, mapName);
        DungeonEditorDungeonFacts facts = dungeonPort.currentFacts(
                session.selectedMapId(),
                session.selection(),
                session.preview());
        DungeonEditorWorkspaceValues.MapId nextMapId = facts.mutationMapId();
        if (command.action().isDeleteMapAction()) {
            DungeonEditorSession nextSession = nextMapId != null && nextMapId.equals(session.selectedMapId())
                    ? session.withSelectedMap(null)
                    : session;
            return clearTransientState(nextSession.clearSelection(), "Dungeon-Map gelöscht.");
        }
        if (command.action().isCreateMapAction()) {
            return clearTransientState(session.withSelectedMap(nextMapId).clearSelection(), "Dungeon-Map erstellt.");
        }
        return session.withSelectedMap(nextMapId).withStatusText("Dungeon-Map umbenannt.");
    }

    private void applyCatalogCommand(DungeonEditorSessionCommand command, String mapName) {
        if (command.action().isCreateMapAction()) {
            dungeonRepository.createMap(mapName);
            return;
        }
        if (command.action().isRenameMapAction()) {
            dungeonRepository.renameMap(command.mapId(), mapName);
            return;
        }
        dungeonRepository.deleteMap(command.mapId());
    }

    private DungeonEditorSession applySessionSetting(DungeonEditorSession session, DungeonEditorSessionCommand command) {
        if (command.action().isSetViewModeAction()) {
            return clearTransientState(session.withViewMode(command.viewMode()), "");
        }
        if (command.action().isSetToolAction()) {
            return clearTransientState(session.withSelectedTool(command.selectedTool()), "");
        }
        if (command.action().isShiftProjectionLevelAction()) {
            return session.shiftProjectionLevel(command.projectionLevelDelta()).withStatusText("");
        }
        return session.withOverlaySettings(command.overlaySettings()).withStatusText("");
    }

    private DungeonEditorSession clearTransientState(DungeonEditorSession session, String nextStatusText) {
        interactionWorkflow.clear();
        return session.clearTransientState(nextStatusText);
    }
}
