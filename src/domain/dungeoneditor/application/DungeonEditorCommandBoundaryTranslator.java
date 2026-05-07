package src.domain.dungeoneditor;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonMapId;
import src.domain.dungeoneditor.published.ApplyDungeonEditorSessionCommand;
import src.domain.dungeoneditor.published.DungeonEditorCell;
import src.domain.dungeoneditor.published.DungeonEditorInspectorSnapshot;
import src.domain.dungeoneditor.published.DungeonEditorMapId;
import src.domain.dungeoneditor.published.DungeonEditorOverlaySettings;
import src.domain.dungeoneditor.published.DungeonEditorTool;
import src.domain.dungeoneditor.published.DungeonEditorViewMode;
import src.domain.dungeoneditor.published.LoadDungeonEditorQuery;
import src.domain.dungeoneditor.session.value.DungeonEditorSessionCommand;
import src.domain.dungeoneditor.session.value.DungeonEditorSessionValues;
import src.domain.dungeoneditor.workspace.value.DungeonEditorWorkspaceValues;
import src.domain.dungeoneditor.application.DungeonEditorWorkspaceBoundaryTranslator;

public final class DungeonEditorCommandBoundaryTranslator {

    private DungeonEditorCommandBoundaryTranslator() {
    }

    public static @Nullable DungeonMapId requestedDomainMapId(@Nullable LoadDungeonEditorQuery query) {
        LoadDungeonEditorQuery effectiveQuery = query == null ? new LoadDungeonEditorQuery(null) : query;
        DungeonEditorMapId mapId = effectiveQuery.mapId();
        return mapId == null
                ? null
                : DungeonEditorWorkspaceBoundaryTranslator.toDomainMapId(toWorkspaceMapId(mapId));
    }

    public static DungeonEditorSessionCommand toInternalCommand(@Nullable ApplyDungeonEditorSessionCommand command) {
        ApplyDungeonEditorSessionCommand effective = command == null
                ? new ApplyDungeonEditorSessionCommand(
                        ApplyDungeonEditorSessionCommand.Action.INTERPRET_MAIN_VIEW,
                        null,
                        "",
                        DungeonEditorViewMode.GRID,
                        DungeonEditorTool.SELECT,
                        0,
                        DungeonEditorOverlaySettings.defaults(),
                        ApplyDungeonEditorSessionCommand.MainViewInput.empty(),
                        ApplyDungeonEditorSessionCommand.RoomNarrationInput.empty())
                : command;
        return new DungeonEditorSessionCommand(
                DungeonEditorSessionCommand.Action.fromName(effective.action().name()),
                toWorkspaceMapId(effective.mapId()),
                effective.mapName(),
                toSessionViewMode(effective.viewMode()),
                toSessionTool(effective.selectedTool()),
                effective.projectionLevelDelta(),
                toInternalOverlay(effective.overlaySettings()),
                toInternalMainViewInput(effective.mainViewInput()),
                toInternalRoomNarration(effective.roomNarration()));
    }

    private static DungeonEditorWorkspaceValues.@Nullable MapId toWorkspaceMapId(@Nullable DungeonEditorMapId mapId) {
        return mapId == null ? null : new DungeonEditorWorkspaceValues.MapId(mapId.value());
    }

    private static DungeonEditorSessionValues.OverlaySettings toInternalOverlay(
            @Nullable DungeonEditorOverlaySettings overlaySettings
    ) {
        DungeonEditorOverlaySettings safeOverlay = overlaySettings == null
                ? DungeonEditorOverlaySettings.defaults()
                : overlaySettings;
        return new DungeonEditorSessionValues.OverlaySettings(
                safeOverlay.modeKey(),
                safeOverlay.levelRange(),
                safeOverlay.opacity(),
                safeOverlay.selectedLevels());
    }

    private static DungeonEditorSessionCommand.MainViewInput toInternalMainViewInput(
            ApplyDungeonEditorSessionCommand.@Nullable MainViewInput mainViewInput
    ) {
        ApplyDungeonEditorSessionCommand.MainViewInput safeInput = mainViewInput == null
                ? ApplyDungeonEditorSessionCommand.MainViewInput.empty()
                : mainViewInput;
        return new DungeonEditorSessionCommand.MainViewInput(
                DungeonEditorSessionCommand.MainViewInputSource.fromName(safeInput.source().name()),
                safeInput.canvasX(),
                safeInput.canvasY(),
                safeInput.primaryButtonDown(),
                safeInput.secondaryButtonDown(),
                safeInput.hitRef(),
                safeInput.levelDelta());
    }

    private static DungeonEditorSessionCommand.RoomNarrationInput toInternalRoomNarration(
            ApplyDungeonEditorSessionCommand.@Nullable RoomNarrationInput roomNarration
    ) {
        ApplyDungeonEditorSessionCommand.RoomNarrationInput safeNarration = roomNarration == null
                ? ApplyDungeonEditorSessionCommand.RoomNarrationInput.empty()
                : roomNarration;
        return new DungeonEditorSessionCommand.RoomNarrationInput(
                safeNarration.roomId(),
                safeNarration.visualDescription(),
                safeNarration.exits().stream().map(DungeonEditorCommandBoundaryTranslator::toDomainRoomExit).toList());
    }

    private static DungeonEditorSessionValues.ViewMode toSessionViewMode(@Nullable DungeonEditorViewMode viewMode) {
        return viewMode == DungeonEditorViewMode.GRAPH
                ? DungeonEditorSessionValues.ViewMode.GRAPH
                : DungeonEditorSessionValues.ViewMode.GRID;
    }

    private static DungeonEditorSessionValues.Tool toSessionTool(@Nullable DungeonEditorTool tool) {
        return tool == null ? DungeonEditorSessionValues.Tool.SELECT : DungeonEditorSessionValues.Tool.fromName(tool.name());
    }

    private static DungeonEditorWorkspaceValues.RoomExitNarration toDomainRoomExit(
            DungeonEditorInspectorSnapshot.@Nullable RoomExitNarration exit
    ) {
        DungeonEditorInspectorSnapshot.RoomExitNarration safeExit = exit == null
                ? new DungeonEditorInspectorSnapshot.RoomExitNarration("", new DungeonEditorCell(0, 0, 0), "", "")
                : exit;
        return new DungeonEditorWorkspaceValues.RoomExitNarration(
                safeExit.label(),
                new DungeonEditorWorkspaceValues.Cell(
                        safeExit.cell().q(),
                        safeExit.cell().r(),
                        safeExit.cell().level()),
                safeExit.direction(),
                safeExit.description());
    }
}
