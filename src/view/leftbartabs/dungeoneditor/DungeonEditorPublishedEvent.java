package src.view.leftbartabs.dungeoneditor;

import java.util.List;

public record DungeonEditorPublishedEvent(
        Kind kind,
        long mapId,
        String mapName,
        String viewModeKey,
        String selectedTool,
        int projectionLevelDelta,
        OverlaySettings overlaySettings,
        MainViewInput mainViewInput,
        RoomNarrationInput roomNarration
) {

    public DungeonEditorPublishedEvent {
        kind = kind == null ? Kind.INTERPRET_MAIN_VIEW : kind;
        mapId = Math.max(0L, mapId);
        mapName = mapName == null ? "" : mapName;
        viewModeKey = viewModeKey == null || viewModeKey.isBlank() ? "GRID" : viewModeKey;
        selectedTool = selectedTool == null || selectedTool.isBlank() ? "Auswahl" : selectedTool;
        overlaySettings = overlaySettings == null ? OverlaySettings.defaults() : overlaySettings;
        mainViewInput = mainViewInput == null ? MainViewInput.empty() : mainViewInput;
        roomNarration = roomNarration == null ? RoomNarrationInput.empty() : roomNarration;
    }

    static DungeonEditorPublishedEvent selectMap(long mapId) {
        return new DungeonEditorPublishedEvent(
                Kind.SELECT_MAP,
                mapId,
                "",
                "GRID",
                "Auswahl",
                0,
                OverlaySettings.defaults(),
                MainViewInput.empty(),
                RoomNarrationInput.empty());
    }

    static DungeonEditorPublishedEvent createMap(String mapName) {
        return new DungeonEditorPublishedEvent(
                Kind.CREATE_MAP,
                0L,
                mapName,
                "GRID",
                "Auswahl",
                0,
                OverlaySettings.defaults(),
                MainViewInput.empty(),
                RoomNarrationInput.empty());
    }

    static DungeonEditorPublishedEvent renameMap(long mapId, String mapName) {
        return new DungeonEditorPublishedEvent(
                Kind.RENAME_MAP,
                mapId,
                mapName,
                "GRID",
                "Auswahl",
                0,
                OverlaySettings.defaults(),
                MainViewInput.empty(),
                RoomNarrationInput.empty());
    }

    static DungeonEditorPublishedEvent deleteMap(long mapId) {
        return new DungeonEditorPublishedEvent(
                Kind.DELETE_MAP,
                mapId,
                "",
                "GRID",
                "Auswahl",
                0,
                OverlaySettings.defaults(),
                MainViewInput.empty(),
                RoomNarrationInput.empty());
    }

    static DungeonEditorPublishedEvent setViewMode(String viewModeKey) {
        return new DungeonEditorPublishedEvent(
                Kind.SET_VIEW_MODE,
                0L,
                "",
                viewModeKey,
                "Auswahl",
                0,
                OverlaySettings.defaults(),
                MainViewInput.empty(),
                RoomNarrationInput.empty());
    }

    static DungeonEditorPublishedEvent setTool(String selectedTool) {
        return new DungeonEditorPublishedEvent(
                Kind.SET_TOOL,
                0L,
                "",
                "GRID",
                selectedTool,
                0,
                OverlaySettings.defaults(),
                MainViewInput.empty(),
                RoomNarrationInput.empty());
    }

    static DungeonEditorPublishedEvent shiftProjectionLevel(int delta) {
        return new DungeonEditorPublishedEvent(
                Kind.SHIFT_PROJECTION_LEVEL,
                0L,
                "",
                "GRID",
                "Auswahl",
                delta,
                OverlaySettings.defaults(),
                MainViewInput.empty(),
                RoomNarrationInput.empty());
    }

    static DungeonEditorPublishedEvent setOverlay(OverlaySettings overlaySettings) {
        return new DungeonEditorPublishedEvent(
                Kind.SET_OVERLAY,
                0L,
                "",
                "GRID",
                "Auswahl",
                0,
                overlaySettings,
                MainViewInput.empty(),
                RoomNarrationInput.empty());
    }

    static DungeonEditorPublishedEvent interpretMainView(MainViewInput mainViewInput) {
        return new DungeonEditorPublishedEvent(
                Kind.INTERPRET_MAIN_VIEW,
                0L,
                "",
                "GRID",
                "Auswahl",
                0,
                OverlaySettings.defaults(),
                mainViewInput,
                RoomNarrationInput.empty());
    }

    static DungeonEditorPublishedEvent saveRoomNarration(RoomNarrationInput roomNarration) {
        return new DungeonEditorPublishedEvent(
                Kind.SAVE_ROOM_NARRATION,
                0L,
                "",
                "GRID",
                "Auswahl",
                0,
                OverlaySettings.defaults(),
                MainViewInput.empty(),
                roomNarration);
    }

    enum Kind {
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

    public record OverlaySettings(
            String modeKey,
            int levelRange,
            double opacity,
            List<Integer> selectedLevels
    ) {
        public OverlaySettings {
            modeKey = modeKey == null || modeKey.isBlank() ? "OFF" : modeKey;
            levelRange = Math.max(0, levelRange);
            opacity = Math.max(0.0, Math.min(1.0, opacity));
            selectedLevels = selectedLevels == null ? List.of() : List.copyOf(selectedLevels);
        }

        static OverlaySettings defaults() {
            return new OverlaySettings("OFF", 2, 0.35, List.of());
        }
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

        static MainViewInput empty() {
            return new MainViewInput(Source.POINTER_MOVED, 0.0, 0.0, false, false, "", 0);
        }

        enum Source {
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
            List<RoomExitNarration> exits
    ) {
        public RoomNarrationInput {
            roomId = Math.max(0L, roomId);
            visualDescription = visualDescription == null ? "" : visualDescription;
            exits = exits == null ? List.of() : List.copyOf(exits);
        }

        static RoomNarrationInput empty() {
            return new RoomNarrationInput(0L, "", List.of());
        }
    }

    public record RoomExitNarration(
            String label,
            CellRef cell,
            String direction,
            String description
    ) {
        public RoomExitNarration {
            label = label == null ? "" : label;
            cell = cell == null ? CellRef.empty() : cell;
            direction = direction == null ? "" : direction;
            description = description == null ? "" : description;
        }
    }

    public record CellRef(int q, int r, int level) {
        static CellRef empty() {
            return new CellRef(0, 0, 0);
        }
    }
}
