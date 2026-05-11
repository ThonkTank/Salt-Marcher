package src.view.leftbartabs.dungeoneditor;

import src.domain.dungeoneditor.model.session.model.DungeonEditorSessionCommand;
import src.domain.dungeoneditor.model.session.model.DungeonEditorSessionValues;
import src.domain.dungeoneditor.model.workspace.model.DungeonEditorWorkspaceValues;

final class DungeonEditorSessionCommands {

    private DungeonEditorSessionCommands() {
    }

    static DungeonEditorSessionCommand mainViewCommand(DungeonEditorSessionCommand.MainViewInput mainViewInput) {
        return new DungeonEditorSessionCommand(
                DungeonEditorSessionCommand.Action.INTERPRET_MAIN_VIEW,
                null,
                "",
                DungeonEditorSessionValues.ViewMode.defaultMode(),
                DungeonEditorSessionValues.Tool.defaultTool(),
                0,
                DungeonEditorSessionValues.OverlaySettings.defaults(),
                mainViewInput,
                DungeonEditorSessionCommand.RoomNarrationInput.empty());
    }

    static DungeonEditorSessionCommand mapCommand(
            DungeonEditorSessionCommand.Action action,
            DungeonEditorWorkspaceValues.MapId mapId,
            String mapName
    ) {
        return new DungeonEditorSessionCommand(
                action,
                mapId,
                mapName,
                DungeonEditorSessionValues.ViewMode.defaultMode(),
                DungeonEditorSessionValues.Tool.defaultTool(),
                0,
                DungeonEditorSessionValues.OverlaySettings.defaults(),
                DungeonEditorSessionCommand.MainViewInput.empty(),
                DungeonEditorSessionCommand.RoomNarrationInput.empty());
    }

    static DungeonEditorSessionCommand viewModeCommand(DungeonEditorSessionValues.ViewMode viewMode) {
        return new DungeonEditorSessionCommand(
                DungeonEditorSessionCommand.Action.SET_VIEW_MODE,
                null,
                "",
                viewMode,
                DungeonEditorSessionValues.Tool.defaultTool(),
                0,
                DungeonEditorSessionValues.OverlaySettings.defaults(),
                DungeonEditorSessionCommand.MainViewInput.empty(),
                DungeonEditorSessionCommand.RoomNarrationInput.empty());
    }

    static DungeonEditorSessionCommand toolCommand(DungeonEditorSessionValues.Tool tool) {
        return new DungeonEditorSessionCommand(
                DungeonEditorSessionCommand.Action.SET_TOOL,
                null,
                "",
                DungeonEditorSessionValues.ViewMode.defaultMode(),
                tool,
                0,
                DungeonEditorSessionValues.OverlaySettings.defaults(),
                DungeonEditorSessionCommand.MainViewInput.empty(),
                DungeonEditorSessionCommand.RoomNarrationInput.empty());
    }

    static DungeonEditorSessionCommand shiftProjectionLevelCommand(int projectionLevelDelta) {
        return new DungeonEditorSessionCommand(
                DungeonEditorSessionCommand.Action.SHIFT_PROJECTION_LEVEL,
                null,
                "",
                DungeonEditorSessionValues.ViewMode.defaultMode(),
                DungeonEditorSessionValues.Tool.defaultTool(),
                projectionLevelDelta,
                DungeonEditorSessionValues.OverlaySettings.defaults(),
                DungeonEditorSessionCommand.MainViewInput.empty(),
                DungeonEditorSessionCommand.RoomNarrationInput.empty());
    }

    static DungeonEditorSessionCommand overlayCommand(
            DungeonEditorSessionValues.OverlaySettings overlaySettings
    ) {
        return new DungeonEditorSessionCommand(
                DungeonEditorSessionCommand.Action.SET_OVERLAY,
                null,
                "",
                DungeonEditorSessionValues.ViewMode.defaultMode(),
                DungeonEditorSessionValues.Tool.defaultTool(),
                0,
                overlaySettings,
                DungeonEditorSessionCommand.MainViewInput.empty(),
                DungeonEditorSessionCommand.RoomNarrationInput.empty());
    }

    static DungeonEditorSessionCommand roomNarrationCommand(
            DungeonEditorSessionCommand.RoomNarrationInput roomNarration
    ) {
        return new DungeonEditorSessionCommand(
                DungeonEditorSessionCommand.Action.SAVE_ROOM_NARRATION,
                null,
                "",
                DungeonEditorSessionValues.ViewMode.defaultMode(),
                DungeonEditorSessionValues.Tool.defaultTool(),
                0,
                DungeonEditorSessionValues.OverlaySettings.defaults(),
                DungeonEditorSessionCommand.MainViewInput.empty(),
                roomNarration);
    }
}
