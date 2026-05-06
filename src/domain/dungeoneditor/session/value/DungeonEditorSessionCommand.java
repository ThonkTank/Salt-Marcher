package src.domain.dungeoneditor.session.value;

import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonInspectorSnapshot;
import src.domain.dungeon.published.DungeonMapId;

public record DungeonEditorSessionCommand(
        Action action,
        @Nullable DungeonMapId mapId,
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
        viewMode = viewMode == null ? DungeonEditorSessionValues.ViewMode.GRID : viewMode;
        selectedTool = selectedTool == null ? DungeonEditorSessionValues.Tool.SELECT : selectedTool;
        overlaySettings = overlaySettings == null ? DungeonEditorSessionValues.OverlaySettings.defaults() : overlaySettings;
        mainViewInput = mainViewInput == null ? MainViewInput.empty() : mainViewInput;
        roomNarration = roomNarration == null ? RoomNarrationInput.empty() : roomNarration;
    }

    public static final class Action {
        public static final Action SELECT_MAP = new Action("SELECT_MAP");
        public static final Action CREATE_MAP = new Action("CREATE_MAP");
        public static final Action RENAME_MAP = new Action("RENAME_MAP");
        public static final Action DELETE_MAP = new Action("DELETE_MAP");
        public static final Action SET_VIEW_MODE = new Action("SET_VIEW_MODE");
        public static final Action SET_TOOL = new Action("SET_TOOL");
        public static final Action SHIFT_PROJECTION_LEVEL = new Action("SHIFT_PROJECTION_LEVEL");
        public static final Action SET_OVERLAY = new Action("SET_OVERLAY");
        public static final Action INTERPRET_MAIN_VIEW = new Action("INTERPRET_MAIN_VIEW");
        public static final Action SAVE_ROOM_NARRATION = new Action("SAVE_ROOM_NARRATION");

        private final String name;

        private Action(String name) {
            this.name = name;
        }

        public String name() {
            return name;
        }

        public static Action fromName(@Nullable String name) {
            return switch (name == null ? "" : name) {
                case "SELECT_MAP" -> SELECT_MAP;
                case "CREATE_MAP" -> CREATE_MAP;
                case "RENAME_MAP" -> RENAME_MAP;
                case "DELETE_MAP" -> DELETE_MAP;
                case "SET_VIEW_MODE" -> SET_VIEW_MODE;
                case "SET_TOOL" -> SET_TOOL;
                case "SHIFT_PROJECTION_LEVEL" -> SHIFT_PROJECTION_LEVEL;
                case "SET_OVERLAY" -> SET_OVERLAY;
                case "SAVE_ROOM_NARRATION" -> SAVE_ROOM_NARRATION;
                default -> INTERPRET_MAIN_VIEW;
            };
        }

        @Override
        public boolean equals(Object other) {
            if (this == other) {
                return true;
            }
            if (!(other instanceof Action that)) {
                return false;
            }
            return name.equals(that.name);
        }

        @Override
        public int hashCode() {
            return name.hashCode();
        }

        @Override
        public String toString() {
            return name;
        }
    }

    public static final class MainViewInputSource {
        public static final MainViewInputSource POINTER_PRESSED = new MainViewInputSource("POINTER_PRESSED");
        public static final MainViewInputSource POINTER_DRAGGED = new MainViewInputSource("POINTER_DRAGGED");
        public static final MainViewInputSource POINTER_RELEASED = new MainViewInputSource("POINTER_RELEASED");
        public static final MainViewInputSource POINTER_MOVED = new MainViewInputSource("POINTER_MOVED");
        public static final MainViewInputSource LEVEL_SCROLLED = new MainViewInputSource("LEVEL_SCROLLED");

        private final String name;

        private MainViewInputSource(String name) {
            this.name = name;
        }

        public String name() {
            return name;
        }

        public static MainViewInputSource fromName(@Nullable String name) {
            return switch (name == null ? "" : name) {
                case "POINTER_PRESSED" -> POINTER_PRESSED;
                case "POINTER_DRAGGED" -> POINTER_DRAGGED;
                case "POINTER_RELEASED" -> POINTER_RELEASED;
                case "LEVEL_SCROLLED" -> LEVEL_SCROLLED;
                default -> POINTER_MOVED;
            };
        }

        @Override
        public boolean equals(Object other) {
            if (this == other) {
                return true;
            }
            if (!(other instanceof MainViewInputSource that)) {
                return false;
            }
            return name.equals(that.name);
        }

        @Override
        public int hashCode() {
            return name.hashCode();
        }

        @Override
        public String toString() {
            return name;
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
                    && source.equals(that.source)
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
            List<DungeonInspectorSnapshot.RoomExitNarration> exits
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
