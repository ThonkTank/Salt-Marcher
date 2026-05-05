package src.domain.dungeoneditor.published;

import java.util.List;
import org.jspecify.annotations.Nullable;

public record ApplyDungeonEditorSessionCommand(
        Action action,
        @Nullable DungeonEditorMapId mapId,
        String mapName,
        DungeonEditorViewMode viewMode,
        DungeonEditorTool selectedTool,
        int projectionLevelDelta,
        DungeonEditorOverlaySettings overlaySettings,
        MainViewInput mainViewInput,
        RoomNarrationInput roomNarration
) {

    public ApplyDungeonEditorSessionCommand {
        action = action == null ? Action.INTERPRET_MAIN_VIEW : action;
        mapName = mapName == null ? "" : mapName;
        viewMode = viewMode == null ? DungeonEditorViewMode.GRID : viewMode;
        selectedTool = selectedTool == null ? DungeonEditorTool.SELECT : selectedTool;
        overlaySettings = overlaySettings == null ? DungeonEditorOverlaySettings.defaults() : overlaySettings;
        mainViewInput = mainViewInput == null ? MainViewInput.empty() : mainViewInput;
        roomNarration = roomNarration == null ? RoomNarrationInput.empty() : roomNarration;
    }

    public enum Action {
        SELECT_MAP,
        CREATE_MAP,
        RENAME_MAP,
        DELETE_MAP,
        SET_VIEW_MODE,
        SET_TOOL,
        SHIFT_PROJECTION_LEVEL,
        SET_OVERLAY,
        INTERPRET_MAIN_VIEW,
        SAVE_ROOM_NARRATION
    }

    public record MainViewInput(
            Source source,
            double canvasX,
            double canvasY,
            boolean primaryButtonDown,
            boolean secondaryButtonDown,
            String hitRef,
            int levelDelta
    ) {

        public MainViewInput {
            source = source == null ? Source.POINTER_MOVED : source;
            hitRef = hitRef == null ? "" : hitRef;
        }

        public static MainViewInput empty() {
            return new MainViewInput(Source.POINTER_MOVED, 0.0, 0.0, false, false, "", 0);
        }

        public enum Source {
            POINTER_PRESSED,
            POINTER_DRAGGED,
            POINTER_RELEASED,
            POINTER_MOVED,
            LEVEL_SCROLLED
        }
    }

    public record RoomNarrationInput(
            long roomId,
            String visualDescription,
            List<DungeonEditorInspectorSnapshot.RoomExitNarration> exits
    ) {

        public RoomNarrationInput {
            roomId = Math.max(0L, roomId);
            visualDescription = visualDescription == null ? "" : visualDescription;
            exits = exits == null ? List.of() : List.copyOf(exits);
        }

        public static RoomNarrationInput empty() {
            return new RoomNarrationInput(0L, "", List.of());
        }
    }
}
