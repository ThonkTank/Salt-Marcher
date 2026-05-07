package src.domain.dungeoneditor.application;

import java.util.function.Function;
import src.domain.dungeon.published.DungeonMapCatalogCommand;
import src.domain.dungeon.published.DungeonMapCatalogResponse;
import src.domain.dungeoneditor.session.entity.DungeonEditorSession;
import src.domain.dungeoneditor.session.value.DungeonEditorSessionCommand;
import src.domain.dungeoneditor.workspace.value.DungeonEditorWorkspaceValues;

final class DungeonEditorSessionCatalogUseCase {
    private final Function<DungeonMapCatalogCommand, DungeonMapCatalogResponse> catalog;
    private final DungeonEditorSessionInteractionUseCase interactionWorkflow;

    DungeonEditorSessionCatalogUseCase(
            Function<DungeonMapCatalogCommand, DungeonMapCatalogResponse> catalog,
            DungeonEditorSessionInteractionUseCase interactionWorkflow
    ) {
        this.catalog = catalog;
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
        DungeonEditorWorkspaceValues.MapId nextMapId = DungeonEditorWorkspaceMapBoundaryTranslator.toWorkspaceMapId(
                ApplyDungeonEditorSessionUseCase.requireMutationMapId(catalog.apply(catalogCommand(command, mapName))));
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

    private DungeonMapCatalogCommand catalogCommand(DungeonEditorSessionCommand command, String mapName) {
        if (command.action().isCreateMapAction()) {
            return new DungeonMapCatalogCommand.CreateMap(mapName);
        }
        if (command.action().isRenameMapAction()) {
            return new DungeonMapCatalogCommand.RenameMap(
                    ApplyDungeonEditorSessionUseCase.requireMapId(command.mapId()),
                    mapName);
        }
        return new DungeonMapCatalogCommand.DeleteMap(ApplyDungeonEditorSessionUseCase.requireMapId(command.mapId()));
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
