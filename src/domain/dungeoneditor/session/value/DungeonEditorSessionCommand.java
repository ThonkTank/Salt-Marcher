package src.domain.dungeoneditor.session.value;

import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeoneditor.workspace.value.DungeonEditorWorkspaceValues;
import src.domain.dungeoneditor.workspace.value.DungeonEditorWorkspaceValues.MapId;

public record DungeonEditorSessionCommand(
        Action action,
        @Nullable MapId mapId,
        String mapName,
        DungeonEditorSessionValues.ViewMode viewMode,
        DungeonEditorSessionValues.Tool selectedTool,
        int projectionLevelDelta,
        DungeonEditorSessionValues.OverlaySettings overlaySettings,
        MainViewInput mainViewInput,
        RoomNarrationInput roomNarration
) {

    public DungeonEditorSessionCommand {
        action = action == null ? Action.INTERPRET_MAIN_VIEW : action;
        mapName = mapName == null ? "" : mapName;
        viewMode = viewMode == null ? DungeonEditorSessionValues.ViewMode.defaultMode() : viewMode;
        selectedTool = selectedTool == null ? DungeonEditorSessionValues.Tool.defaultTool() : selectedTool;
        overlaySettings = overlaySettings == null ? DungeonEditorSessionValues.OverlaySettings.defaults() : overlaySettings;
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
        SAVE_ROOM_NARRATION;

        public static Action fromName(@Nullable String name) {
            try {
                return valueOf(name == null ? INTERPRET_MAIN_VIEW.name() : name);
            } catch (IllegalArgumentException ignored) {
                return INTERPRET_MAIN_VIEW;
            }
        }

        public boolean isCatalogAction() {
            return switch (this) {
                case SELECT_MAP,
                        CREATE_MAP,
                        RENAME_MAP,
                        DELETE_MAP,
                        SET_VIEW_MODE,
                        SET_TOOL,
                        SHIFT_PROJECTION_LEVEL,
                        SET_OVERLAY -> true;
                case INTERPRET_MAIN_VIEW, SAVE_ROOM_NARRATION -> false;
            };
        }
    }

    public enum MainViewInputSource {
        POINTER_PRESSED,
        POINTER_DRAGGED,
        POINTER_RELEASED,
        POINTER_MOVED,
        LEVEL_SCROLLED;

        public static MainViewInputSource fromName(@Nullable String name) {
            try {
                return valueOf(name == null ? POINTER_MOVED.name() : name);
            } catch (IllegalArgumentException ignored) {
                return POINTER_MOVED;
            }
        }
    }

    public static final class MainViewInput {
        private final MainViewInputSource source;
        private final double canvasX;
        private final double canvasY;
        private final boolean primaryButtonDown;
        private final boolean secondaryButtonDown;
        private final String hitRef;
        private final int levelDelta;

        public MainViewInput(
                @Nullable MainViewInputSource source,
                double canvasX,
                double canvasY,
                boolean primaryButtonDown,
                boolean secondaryButtonDown,
                @Nullable String hitRef,
                int levelDelta
        ) {
            this.source = source == null ? MainViewInputSource.POINTER_MOVED : source;
            this.canvasX = canvasX;
            this.canvasY = canvasY;
            this.primaryButtonDown = primaryButtonDown;
            this.secondaryButtonDown = secondaryButtonDown;
            this.hitRef = hitRef == null ? "" : hitRef;
            this.levelDelta = levelDelta;
        }

        public static MainViewInput empty() {
            return new MainViewInput(MainViewInputSource.POINTER_MOVED, 0.0, 0.0, false, false, "", 0);
        }

        public MainViewInputSource source() {
            return source;
        }

        public double canvasX() {
            return canvasX;
        }

        public double canvasY() {
            return canvasY;
        }

        public boolean primaryButtonDown() {
            return primaryButtonDown;
        }

        public boolean secondaryButtonDown() {
            return secondaryButtonDown;
        }

        public String hitRef() {
            return hitRef;
        }

        public int levelDelta() {
            return levelDelta;
        }

        public boolean isPointerPressed() {
            return source == MainViewInputSource.POINTER_PRESSED;
        }

        public boolean isPointerDragged() {
            return source == MainViewInputSource.POINTER_DRAGGED;
        }

        public boolean isPointerReleased() {
            return source == MainViewInputSource.POINTER_RELEASED;
        }

        public boolean isPointerMoved() {
            return source == MainViewInputSource.POINTER_MOVED;
        }

        public boolean isLevelScrolled() {
            return source == MainViewInputSource.LEVEL_SCROLLED;
        }

        @Override
        public boolean equals(Object other) {
            if (this == other) {
                return true;
            }
            if (!(other instanceof MainViewInput that)) {
                return false;
            }
            return Double.compare(that.canvasX, canvasX) == 0
                    && Double.compare(that.canvasY, canvasY) == 0
                    && primaryButtonDown == that.primaryButtonDown
                    && secondaryButtonDown == that.secondaryButtonDown
                    && levelDelta == that.levelDelta
                    && source == that.source
                    && hitRef.equals(that.hitRef);
        }

        @Override
        public int hashCode() {
            return Objects.hash(source, canvasX, canvasY, primaryButtonDown, secondaryButtonDown, hitRef, levelDelta);
        }
    }

    public record RoomNarrationInput(
            long roomId,
            String visualDescription,
            List<DungeonEditorWorkspaceValues.RoomExitNarration> exits
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
