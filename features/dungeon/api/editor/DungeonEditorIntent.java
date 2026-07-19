package features.dungeon.api.editor;

import features.dungeon.api.DungeonEditorViewMode;
import features.dungeon.api.DungeonMapId;
import features.dungeon.api.DungeonOverlaySettings;
import java.util.List;

/** Typed editor inputs introduced ahead of the JavaFX consumer migration. */
public sealed interface DungeonEditorIntent {

    record SetViewport(DungeonEditorViewportInput viewport) implements DungeonEditorIntent {
        public SetViewport {
            if (viewport == null) {
                throw new IllegalArgumentException("viewport is required");
            }
        }
    }

    record SelectMap(DungeonMapId mapId) implements DungeonEditorIntent {
        public SelectMap {
            if (mapId == null) {
                throw new IllegalArgumentException("mapId is required");
            }
        }
    }

    record CreateMap(String mapName) implements DungeonEditorIntent {
        public CreateMap {
            mapName = cleanName(mapName);
        }
    }

    record RenameMap(DungeonMapId mapId, String mapName) implements DungeonEditorIntent {
        public RenameMap {
            if (mapId == null) {
                throw new IllegalArgumentException("mapId is required");
            }
            mapName = cleanName(mapName);
        }
    }

    record DeleteMap(DungeonMapId mapId) implements DungeonEditorIntent {
        public DeleteMap {
            if (mapId == null) {
                throw new IllegalArgumentException("mapId is required");
            }
        }
    }

    record SetViewMode(DungeonEditorViewMode viewMode) implements DungeonEditorIntent {
        public SetViewMode {
            viewMode = viewMode == null ? DungeonEditorViewMode.GRID : viewMode;
        }
    }

    record SetTool(DungeonEditorToolSelection selection) implements DungeonEditorIntent {
        public SetTool {
            selection = selection == null ? DungeonEditorToolSelection.select() : selection;
        }
    }

    record ShiftProjectionLevel(int levelShift) implements DungeonEditorIntent {
    }

    record SetOverlay(DungeonOverlaySettings overlaySettings) implements DungeonEditorIntent {
        public SetOverlay {
            overlaySettings = overlaySettings == null ? DungeonOverlaySettings.defaults() : overlaySettings;
        }
    }

    record ScrollSelection(int levelDelta) implements DungeonEditorIntent {
    }

    enum CancelPreview implements DungeonEditorIntent {
        INSTANCE
    }

    enum Undo implements DungeonEditorIntent {
        INSTANCE
    }

    enum Redo implements DungeonEditorIntent {
        INSTANCE
    }

    record Pointer(DungeonEditorPointerInput input) implements DungeonEditorIntent {
        public Pointer {
            if (input == null) {
                throw new IllegalArgumentException("input is required");
            }
        }
    }

    enum ClearPointerSession implements DungeonEditorIntent {
        INSTANCE
    }

    record UpdateRoomNarration(RoomNarrationInput narration) implements DungeonEditorIntent {
        public UpdateRoomNarration {
            narration = narration == null ? RoomNarrationInput.empty() : narration;
        }
    }

    record CommitRoomNarration(RoomNarrationInput narration) implements DungeonEditorIntent {
        public CommitRoomNarration {
            narration = narration == null ? RoomNarrationInput.empty() : narration;
        }
    }

    record UpdateLabelName(LabelTarget target, String name) implements DungeonEditorIntent {
        public UpdateLabelName {
            target = target == null ? LabelTarget.empty() : target;
            name = safeText(name);
        }
    }

    record CommitLabelName(LabelTarget target, String name) implements DungeonEditorIntent {
        public CommitLabelName {
            target = target == null ? LabelTarget.empty() : target;
            name = safeText(name);
        }
    }

    record UpdateCorridorPoint(String q, String r) implements DungeonEditorIntent {
        public UpdateCorridorPoint {
            q = safeText(q);
            r = safeText(r);
        }
    }

    record CommitCorridorPoint(int q, int r) implements DungeonEditorIntent {
    }

    record UpdateTransitionDescription(long transitionId, String description) implements DungeonEditorIntent {
        public UpdateTransitionDescription {
            transitionId = Math.max(0L, transitionId);
            description = safeText(description);
        }
    }

    record CommitTransitionDescription(long transitionId, String description) implements DungeonEditorIntent {
        public CommitTransitionDescription {
            transitionId = Math.max(0L, transitionId);
            description = safeText(description);
        }
    }

    record CommitFeatureMarkerSemantics(
            long markerId,
            String label,
            String description
    ) implements DungeonEditorIntent {
        public CommitFeatureMarkerSemantics {
            markerId = Math.max(0L, markerId);
            label = safeText(label);
            description = safeText(description);
        }
    }

    record UpdateTransitionDestination(TransitionDestinationInput destination) implements DungeonEditorIntent {
        public UpdateTransitionDestination {
            destination = destination == null ? TransitionDestinationInput.empty() : destination;
        }
    }

    record CommitTransitionDestination(
            long sourceTransitionId,
            TransitionDestinationInput destination
    ) implements DungeonEditorIntent {
        public CommitTransitionDestination {
            sourceTransitionId = Math.max(0L, sourceTransitionId);
            destination = destination == null ? TransitionDestinationInput.empty() : destination;
        }
    }

    record UpdateStairGeometry(StairGeometryInput geometry) implements DungeonEditorIntent {
        public UpdateStairGeometry {
            geometry = geometry == null ? StairGeometryInput.empty() : geometry;
        }
    }

    record CommitStairGeometry(StairGeometryInput geometry) implements DungeonEditorIntent {
        public CommitStairGeometry {
            geometry = geometry == null ? StairGeometryInput.empty() : geometry;
        }
    }

    record RoomNarrationInput(long roomId, String visualDescription, List<ExitNarrationInput> exits) {
        public RoomNarrationInput {
            roomId = Math.max(0L, roomId);
            visualDescription = safeText(visualDescription);
            exits = exits == null ? List.of() : List.copyOf(exits);
        }

        public static RoomNarrationInput empty() {
            return new RoomNarrationInput(0L, "", List.of());
        }
    }

    record ExitNarrationInput(
            String label,
            int q,
            int r,
            int level,
            String direction,
            String description
    ) {
        public ExitNarrationInput {
            label = safeText(label);
            direction = safeText(direction);
            description = safeText(description);
        }
    }

    record LabelTarget(LabelTargetKind kind, long id) {
        public LabelTarget {
            kind = kind == null ? LabelTargetKind.EMPTY : kind;
            id = Math.max(0L, id);
            if (kind == LabelTargetKind.EMPTY || id == 0L) {
                kind = LabelTargetKind.EMPTY;
                id = 0L;
            }
        }

        public static LabelTarget empty() {
            return new LabelTarget(LabelTargetKind.EMPTY, 0L);
        }
    }

    enum LabelTargetKind {
        EMPTY,
        ROOM,
        CLUSTER
    }

    record TransitionDestinationInput(
            String destinationTypeKey,
            String mapId,
            String tileId,
            String transitionId,
            boolean bidirectional
    ) {
        public TransitionDestinationInput {
            destinationTypeKey = safeText(destinationTypeKey);
            mapId = safeText(mapId);
            tileId = safeText(tileId);
            transitionId = safeText(transitionId);
        }

        public static TransitionDestinationInput empty() {
            return new TransitionDestinationInput("UNLINKED_ENTRANCE", "", "", "", true);
        }
    }

    record StairGeometryInput(
            long stairId,
            String shapeName,
            String directionName,
            String dimension1,
            String dimension2
    ) {
        public StairGeometryInput {
            stairId = Math.max(0L, stairId);
            shapeName = safeText(shapeName);
            directionName = safeText(directionName);
            dimension1 = safeText(dimension1);
            dimension2 = safeText(dimension2);
        }

        public static StairGeometryInput empty() {
            return new StairGeometryInput(0L, "", "", "", "");
        }
    }

    private static String cleanName(String mapName) {
        if (mapName == null || mapName.isBlank()) {
            throw new IllegalArgumentException("mapName is required");
        }
        return mapName.strip();
    }

    private static String safeText(String value) {
        return value == null ? "" : value;
    }
}
