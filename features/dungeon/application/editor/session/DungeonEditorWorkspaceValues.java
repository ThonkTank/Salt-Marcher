package features.dungeon.application.editor.session;

import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import features.dungeon.domain.core.geometry.DungeonTopology;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Direction;
import features.dungeon.domain.core.geometry.Edge;
import features.dungeon.domain.core.graph.DungeonTopologyElementKind;
import features.dungeon.domain.core.graph.DungeonTopologyRef;
import features.dungeon.domain.core.projection.DungeonAreaType;
import features.dungeon.domain.core.projection.DungeonFeatureType;
import features.dungeon.api.DungeonEditorHandleKind;
import features.dungeon.domain.core.component.boundary.BoundaryKind;

public final class DungeonEditorWorkspaceValues {

    private DungeonEditorWorkspaceValues() {
    }

    public static boolean hasId(long id) {
        return id > 0L;
    }

    public static final class MapId {
        private final long value;

        public MapId(long value) {
            this.value = Math.max(1L, value);
        }

        public long value() {
            return value;
        }

        @Override
        public boolean equals(Object other) {
            return this == other || (other instanceof MapId that && value == that.value);
        }

        @Override
        public int hashCode() {
            return Long.hashCode(value);
        }

        @Override
        public String toString() {
            return "MapId[value=%d]".formatted(value);
        }
    }

    public static final class MapSummary {
        private final MapId mapId;
        private final String mapName;
        private final long revision;

        public MapSummary(MapId mapId, String mapName, long revision) {
            this.mapId = mapId == null ? new MapId(1L) : mapId;
            this.mapName = mapName == null || mapName.isBlank() ? "Dungeon Map" : mapName;
            this.revision = Math.max(0L, revision);
        }

        public MapId mapId() {
            return mapId;
        }

        public String mapName() {
            return mapName;
        }

        public long revision() {
            return revision;
        }

        @Override
        public boolean equals(Object other) {
            if (this == other) {
                return true;
            }
            if (!(other instanceof MapSummary that)) {
                return false;
            }
            return revision == that.revision
                    && Objects.equals(mapId, that.mapId)
                    && Objects.equals(mapName, that.mapName);
        }

        @Override
        public int hashCode() {
            return Objects.hash(mapId, mapName, revision);
        }

        @Override
        public String toString() {
            return "MapSummary[mapId=%s, mapName=%s, revision=%d]".formatted(mapId, mapName, revision);
        }
    }

    public record HandleRef(
            DungeonEditorHandleKind kind,
            DungeonTopologyRef topologyRef,
            long ownerId,
            long clusterId,
            long corridorId,
            long roomId,
            int index,
            Cell cell,
            Direction direction,
            Edge sourceEdge,
            List<Edge> sourceEdges
    ) {
        public HandleRef {
            kind = kind == null ? DungeonEditorHandleKind.CLUSTER_LABEL : kind;
            topologyRef = topologyRef == null ? DungeonTopologyRef.empty() : topologyRef;
            ownerId = Math.max(0L, ownerId);
            clusterId = Math.max(0L, clusterId);
            corridorId = Math.max(0L, corridorId);
            roomId = Math.max(0L, roomId);
            index = Math.max(0, index);
            cell = cell == null ? Cell.empty() : cell;
            direction = direction == null ? Direction.NORTH : direction;
            sourceEdges = sourceEdges == null ? List.of() : List.copyOf(sourceEdges);
        }

        public static HandleRef empty() {
            return new HandleRef(
                    DungeonEditorHandleKind.CLUSTER_LABEL,
                    DungeonTopologyRef.empty(),
                    0L,
                    0L,
                    0L,
                    0L,
                    0,
                    Cell.empty(),
                    Direction.NORTH,
                    null,
                    List.of());
        }

        public boolean hasSourceEdge() {
            return sourceEdge != null;
        }

    }

    public record Handle(
            HandleRef ref,
            String label,
            Cell cell
    ) {
        public Handle {
            ref = ref == null ? HandleRef.empty() : ref;
            label = label == null || label.isBlank() ? ref.kind().name() : label.trim();
            cell = cell == null ? ref.cell() : cell;
        }
    }

    public record Area(
            DungeonAreaType kind,
            long id,
            long clusterId,
            String label,
            List<Cell> cells,
            DungeonTopologyRef topologyRef
    ) {
        public Area {
            kind = kind == null ? DungeonAreaType.ROOM : kind;
            id = Math.max(1L, id);
            clusterId = Math.max(0L, clusterId);
            label = label == null || label.isBlank() ? kind.name() : label;
            cells = cells == null ? List.of() : List.copyOf(cells);
            topologyRef = topologyRef == null ? defaultTopologyRef(kind.isCorridor(), id) : topologyRef;
        }

        private static DungeonTopologyRef defaultTopologyRef(boolean corridor, long id) {
            return new DungeonTopologyRef(
                    corridor ? DungeonTopologyElementKind.CORRIDOR : DungeonTopologyElementKind.ROOM,
                    id);
        }
    }

    public record Boundary(
            BoundaryKind kind,
            long id,
            String label,
            Edge edge,
            DungeonTopologyRef topologyRef
    ) {
        public Boundary {
            kind = kind == null ? BoundaryKind.WALL : kind;
            id = Math.max(1L, id);
            label = label == null || label.isBlank() ? externalBoundaryKind(kind) : label;
            edge = edge == null ? new Edge(Cell.empty(), Cell.empty()) : edge;
            topologyRef = topologyRef == null ? defaultTopologyRef(kind, id) : topologyRef;
        }

        private static DungeonTopologyRef defaultTopologyRef(BoundaryKind kind, long id) {
            return new DungeonTopologyRef(
                    kind.isDoor() ? DungeonTopologyElementKind.DOOR : DungeonTopologyElementKind.WALL,
                    id);
        }

        private static String externalBoundaryKind(BoundaryKind kind) {
            return switch (kind) {
                case WALL -> "wall";
                case DOOR -> "door";
                case OPEN -> "open";
            };
        }
    }

    public record Feature(
            DungeonFeatureType kind,
            long id,
            String label,
            List<Cell> cells,
            String description,
            String destinationLabel,
            DungeonTopologyRef topologyRef,
            @Nullable Edge anchorEdge
    ) {
        public Feature {
            kind = kind == null ? DungeonFeatureType.STAIR : kind;
            id = Math.max(1L, id);
            label = label == null || label.isBlank() ? kind.name() : label.trim();
            cells = cells == null ? List.of() : List.copyOf(cells);
            description = description == null ? "" : description.trim();
            destinationLabel = destinationLabel == null ? "" : destinationLabel.trim();
            topologyRef = topologyRef == null ? defaultTopologyRef(kind, id) : topologyRef;
        }

        private static DungeonTopologyRef defaultTopologyRef(DungeonFeatureType kind, long id) {
            if (kind != null && kind.isTransition()) {
                return new DungeonTopologyRef(DungeonTopologyElementKind.TRANSITION, id);
            }
            if (kind != null && kind.isMarker()) {
                return new DungeonTopologyRef(DungeonTopologyElementKind.FEATURE_MARKER, id);
            }
            return new DungeonTopologyRef(DungeonTopologyElementKind.STAIR, id);
        }
    }

    public record MapSnapshot(
            DungeonTopology topology,
            int width,
            int height,
            List<Area> areas,
            List<Boundary> boundaries,
            List<Feature> features,
            List<Handle> editorHandles
    ) {
        public MapSnapshot {
            topology = topology == null ? DungeonTopology.SQUARE : topology;
            width = Math.max(1, width);
            height = Math.max(1, height);
            areas = areas == null ? List.of() : List.copyOf(areas);
            boundaries = boundaries == null ? List.of() : List.copyOf(boundaries);
            features = features == null ? List.of() : List.copyOf(features);
            editorHandles = editorHandles == null ? List.of() : List.copyOf(editorHandles);
        }

        public static MapSnapshot empty() {
            return new MapSnapshot(DungeonTopology.SQUARE, 1, 1, List.of(), List.of(), List.of(), List.of());
        }
    }

    public static final class RoomExitNarration {
        private final String label;
        private final Cell cell;
        private final String direction;
        private final String description;

        public RoomExitNarration(String label, Cell cell, String direction, String description) {
            this.label = label == null || label.isBlank() ? "Ausgang" : label.trim();
            this.cell = cell == null ? Cell.empty() : cell;
            this.direction = direction == null || direction.isBlank() ? "NORTH" : direction.trim();
            this.description = description == null ? "" : description;
        }

        public String label() {
            return label;
        }

        public Cell cell() {
            return cell;
        }

        public String direction() {
            return direction;
        }

        public String description() {
            return description;
        }

        @Override
        public boolean equals(Object other) {
            if (this == other) {
                return true;
            }
            if (!(other instanceof RoomExitNarration that)) {
                return false;
            }
            return Objects.equals(label, that.label)
                    && Objects.equals(cell, that.cell)
                    && Objects.equals(direction, that.direction)
                    && Objects.equals(description, that.description);
        }

        @Override
        public int hashCode() {
            return Objects.hash(label, cell, direction, description);
        }

        @Override
        public String toString() {
            return "RoomExitNarration[label=%s, cell=%s, direction=%s, description=%s]"
                    .formatted(label, cell, direction, description);
        }
    }

    public static final class RoomNarrationCard {
        private final long roomId;
        private final String roomName;
        private final String visualDescription;
        private final List<RoomExitNarration> exits;

        public RoomNarrationCard(long roomId, String roomName, String visualDescription, List<RoomExitNarration> exits) {
            this.roomId = Math.max(0L, roomId);
            this.roomName = roomName == null || roomName.isBlank() ? "Raum" : roomName.trim();
            this.visualDescription = visualDescription == null ? "" : visualDescription;
            this.exits = exits == null ? List.of() : List.copyOf(exits);
        }

        public long roomId() {
            return roomId;
        }

        public String roomName() {
            return roomName;
        }

        public String visualDescription() {
            return visualDescription;
        }

        public List<RoomExitNarration> exits() {
            return List.copyOf(exits);
        }

        @Override
        public boolean equals(Object other) {
            if (this == other) {
                return true;
            }
            if (!(other instanceof RoomNarrationCard that)) {
                return false;
            }
            return roomId == that.roomId
                    && Objects.equals(roomName, that.roomName)
                    && Objects.equals(visualDescription, that.visualDescription)
                    && Objects.equals(exits, that.exits);
        }

        @Override
        public int hashCode() {
            return Objects.hash(roomId, roomName, visualDescription, exits);
        }

        @Override
        public String toString() {
            return "RoomNarrationCard[roomId=%d, roomName=%s, visualDescription=%s, exits=%s]"
                    .formatted(roomId, roomName, visualDescription, exits);
        }
    }

    public static final class Inspector {
        private final String title;
        private final String summary;
        private final InspectorStatePanelState statePanelFacts;
        private final List<RoomNarrationCard> roomNarrations;

        public Inspector(
                String title,
                String summary,
                InspectorStatePanelState statePanelFacts,
                List<RoomNarrationCard> roomNarrations
        ) {
            this.title = title == null || title.isBlank() ? "Dungeon" : title;
            this.summary = summary == null ? "" : summary;
            this.statePanelFacts = statePanelFacts == null ? InspectorStatePanelState.empty() : statePanelFacts;
            this.roomNarrations = roomNarrations == null ? List.of() : List.copyOf(roomNarrations);
        }

        public String title() {
            return title;
        }

        public String summary() {
            return summary;
        }

        public InspectorStatePanelState statePanelFacts() {
            return statePanelFacts;
        }

        public List<RoomNarrationCard> roomNarrations() {
            return List.copyOf(roomNarrations);
        }

        @Override
        public boolean equals(Object other) {
            if (this == other) {
                return true;
            }
            if (!(other instanceof Inspector that)) {
                return false;
            }
            return Objects.equals(title, that.title)
                    && Objects.equals(summary, that.summary)
                    && Objects.equals(statePanelFacts, that.statePanelFacts)
                    && Objects.equals(roomNarrations, that.roomNarrations);
        }

        @Override
        public int hashCode() {
            return Objects.hash(title, summary, statePanelFacts, roomNarrations);
        }

        @Override
        public String toString() {
            return "Inspector[title=%s, summary=%s, statePanelFacts=%s, roomNarrations=%s]"
                    .formatted(title, summary, statePanelFacts, roomNarrations);
        }
    }

    public record InspectorStatePanelState(
            InspectorStairGeometryState stairGeometryState,
            InspectorTransitionDestinationState transitionDestinationState
    ) {
        public InspectorStatePanelState {
            stairGeometryState =
                    stairGeometryState == null ? InspectorStairGeometryState.empty() : stairGeometryState;
            transitionDestinationState = transitionDestinationState == null
                    ? InspectorTransitionDestinationState.empty()
                    : transitionDestinationState;
        }

        public static InspectorStatePanelState empty() {
            return new InspectorStatePanelState(
                    InspectorStairGeometryState.empty(),
                    InspectorTransitionDestinationState.empty());
        }
    }

    public record InspectorStairGeometryState(
            boolean selected,
            long selectedStairId,
            String authoredShapeName,
            String authoredDirectionName,
            int firstDimension,
            int secondDimension
    ) {
        public InspectorStairGeometryState {
            selectedStairId = Math.max(0L, selectedStairId);
            authoredShapeName =
                    authoredShapeName == null || authoredShapeName.isBlank() ? "STRAIGHT" : authoredShapeName.strip();
            authoredDirectionName = authoredDirectionName == null || authoredDirectionName.isBlank()
                    ? "NORTH"
                    : authoredDirectionName.strip();
            firstDimension = Math.max(0, firstDimension);
            secondDimension = Math.max(0, secondDimension);
            selected = selected && selectedStairId > 0L;
        }

        public static InspectorStairGeometryState empty() {
            return new InspectorStairGeometryState(false, 0L, "", "", 0, 0);
        }
    }

    public record InspectorTransitionDestinationState(
            boolean linked,
            String targetKindKey,
            long targetMapId,
            long targetTileId,
            long targetTransitionId
    ) {
        public InspectorTransitionDestinationState {
            targetKindKey = targetKindKey == null || targetKindKey.isBlank()
                    ? "UNLINKED_ENTRANCE"
                    : targetKindKey.strip();
            targetMapId = Math.max(0L, targetMapId);
            targetTileId = Math.max(0L, targetTileId);
            targetTransitionId = Math.max(0L, targetTransitionId);
        }

        public static InspectorTransitionDestinationState empty() {
            return new InspectorTransitionDestinationState(false, "UNLINKED_ENTRANCE", 0L, 0L, 0L);
        }
    }

    public sealed interface CorridorEndpoint permits CorridorDoorEndpoint, CorridorAnchorEndpoint {
    }

    public record CorridorDoorEndpoint(
            long roomId,
            long clusterId,
            Cell roomCell,
            Direction direction,
            DungeonTopologyRef topologyRef
    ) implements CorridorEndpoint {
        public CorridorDoorEndpoint {
            roomId = Math.max(0L, roomId);
            clusterId = Math.max(0L, clusterId);
            roomCell = roomCell == null ? Cell.empty() : roomCell;
            direction = direction == null ? Direction.NORTH : direction;
            topologyRef = topologyRef == null ? DungeonTopologyRef.empty() : topologyRef;
        }
    }

    public record CorridorAnchorEndpoint(
            long hostCorridorId,
            Cell anchorCell,
            DungeonTopologyRef topologyRef
    ) implements CorridorEndpoint {
        public CorridorAnchorEndpoint {
            hostCorridorId = Math.max(0L, hostCorridorId);
            anchorCell = anchorCell == null ? Cell.empty() : anchorCell;
            topologyRef = topologyRef == null ? DungeonTopologyRef.empty() : topologyRef;
        }
    }
}
