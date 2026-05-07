package src.domain.dungeoneditor.workspace.value;

import java.util.List;
import org.jspecify.annotations.Nullable;

public final class DungeonEditorWorkspaceValues {

    private DungeonEditorWorkspaceValues() {
    }

    public record MapId(long value) {
        public MapId {
            value = Math.max(1L, value);
        }
    }

    public record MapSummary(
            MapId mapId,
            String mapName,
            long revision
    ) {
        public MapSummary {
            mapId = mapId == null ? new MapId(1L) : mapId;
            mapName = mapName == null || mapName.isBlank() ? "Dungeon Map" : mapName;
            revision = Math.max(0L, revision);
        }
    }

    public enum TopologyKind {
        SQUARE,
        HEX;

        public static TopologyKind fromName(@Nullable String name) {
            return "HEX".equals(name) ? HEX : SQUARE;
        }
    }

    public enum AreaKind {
        ROOM,
        CORRIDOR;

        public static AreaKind fromName(@Nullable String name) {
            return "CORRIDOR".equals(name) ? CORRIDOR : ROOM;
        }
    }

    public enum BoundaryKind {
        WALL("wall"),
        DOOR("door");

        private final String externalKind;

        BoundaryKind(String externalKind) {
            this.externalKind = externalKind;
        }

        public static BoundaryKind fromExternalKind(@Nullable String kind) {
            return "door".equalsIgnoreCase(kind) ? DOOR : WALL;
        }

        public String externalKind() {
            return externalKind;
        }
    }

    public enum FeatureKind {
        STAIR,
        TRANSITION;

        public static FeatureKind fromName(@Nullable String name) {
            return "TRANSITION".equals(name) ? TRANSITION : STAIR;
        }
    }

    public enum TopologyElementKind {
        EMPTY,
        ROOM,
        CORRIDOR,
        CORRIDOR_ANCHOR,
        DOOR,
        WALL,
        STAIR,
        TRANSITION;

        public static TopologyElementKind fromName(@Nullable String name) {
            try {
                return valueOf(name == null ? EMPTY.name() : name);
            } catch (IllegalArgumentException ignored) {
                return EMPTY;
            }
        }
    }

    public enum HandleKind {
        CLUSTER_LABEL,
        DOOR,
        CORRIDOR_ANCHOR,
        CORRIDOR_WAYPOINT,
        STAIR_ANCHOR;

        public static HandleKind fromName(@Nullable String name) {
            try {
                return valueOf(name == null ? CLUSTER_LABEL.name() : name);
            } catch (IllegalArgumentException ignored) {
                return CLUSTER_LABEL;
            }
        }
    }

    public record TopologyElementRef(
            TopologyElementKind kind,
            long id
    ) {
        public TopologyElementRef {
            kind = kind == null ? TopologyElementKind.EMPTY : kind;
            id = Math.max(0L, id);
        }

        public static TopologyElementRef empty() {
            return new TopologyElementRef(TopologyElementKind.EMPTY, 0L);
        }
    }

    public record Cell(
            int q,
            int r,
            int level
    ) {
        public static Cell empty() {
            return new Cell(0, 0, 0);
        }
    }

    public record Edge(
            Cell from,
            Cell to
    ) {
        public Edge {
            from = from == null ? Cell.empty() : from;
            to = to == null ? from : to;
        }
    }

    public record HandleRef(
            HandleKind kind,
            TopologyElementRef topologyRef,
            long ownerId,
            long clusterId,
            long corridorId,
            long roomId,
            int index,
            Cell cell,
            String direction
    ) {
        public HandleRef {
            kind = kind == null ? HandleKind.CLUSTER_LABEL : kind;
            topologyRef = topologyRef == null ? TopologyElementRef.empty() : topologyRef;
            ownerId = Math.max(0L, ownerId);
            clusterId = Math.max(0L, clusterId);
            corridorId = Math.max(0L, corridorId);
            roomId = Math.max(0L, roomId);
            index = Math.max(0, index);
            cell = cell == null ? Cell.empty() : cell;
            direction = direction == null ? "" : direction.trim();
        }

        public static HandleRef empty() {
            return new HandleRef(
                    HandleKind.CLUSTER_LABEL,
                    TopologyElementRef.empty(),
                    0L,
                    0L,
                    0L,
                    0L,
                    0,
                    Cell.empty(),
                    "");
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
            AreaKind kind,
            long id,
            long clusterId,
            String label,
            List<Cell> cells,
            TopologyElementRef topologyRef
    ) {
        public Area {
            kind = kind == null ? AreaKind.ROOM : kind;
            id = Math.max(1L, id);
            clusterId = Math.max(0L, clusterId);
            label = label == null || label.isBlank() ? kind.name() : label;
            cells = cells == null ? List.of() : List.copyOf(cells);
            topologyRef = topologyRef == null ? defaultTopologyRef(kind, id) : topologyRef;
        }

        private static TopologyElementRef defaultTopologyRef(AreaKind kind, long id) {
            return new TopologyElementRef(kind == AreaKind.CORRIDOR ? TopologyElementKind.CORRIDOR : TopologyElementKind.ROOM, id);
        }
    }

    public record Boundary(
            BoundaryKind kind,
            long id,
            String label,
            Edge edge,
            TopologyElementRef topologyRef
    ) {
        public Boundary {
            kind = kind == null ? BoundaryKind.WALL : kind;
            id = Math.max(1L, id);
            label = label == null || label.isBlank() ? kind.externalKind() : label;
            edge = edge == null ? new Edge(Cell.empty(), Cell.empty()) : edge;
            topologyRef = topologyRef == null ? defaultTopologyRef(kind, id) : topologyRef;
        }

        private static TopologyElementRef defaultTopologyRef(BoundaryKind kind, long id) {
            return new TopologyElementRef(kind == BoundaryKind.DOOR ? TopologyElementKind.DOOR : TopologyElementKind.WALL, id);
        }
    }

    public record Feature(
            FeatureKind kind,
            long id,
            String label,
            List<Cell> cells,
            String description,
            String destinationLabel,
            TopologyElementRef topologyRef
    ) {
        public Feature {
            kind = kind == null ? FeatureKind.STAIR : kind;
            id = Math.max(1L, id);
            label = label == null || label.isBlank() ? kind.name() : label.trim();
            cells = cells == null ? List.of() : List.copyOf(cells);
            description = description == null ? "" : description.trim();
            destinationLabel = destinationLabel == null ? "" : destinationLabel.trim();
            topologyRef = topologyRef == null ? defaultTopologyRef(kind, id) : topologyRef;
        }

        private static TopologyElementRef defaultTopologyRef(FeatureKind kind, long id) {
            return new TopologyElementRef(
                    kind == FeatureKind.TRANSITION ? TopologyElementKind.TRANSITION : TopologyElementKind.STAIR,
                    id);
        }
    }

    public record MapSnapshot(
            TopologyKind topology,
            int width,
            int height,
            List<Area> areas,
            List<Boundary> boundaries,
            List<Feature> features,
            List<Handle> editorHandles
    ) {
        public MapSnapshot {
            topology = topology == null ? TopologyKind.SQUARE : topology;
            width = Math.max(1, width);
            height = Math.max(1, height);
            areas = areas == null ? List.of() : List.copyOf(areas);
            boundaries = boundaries == null ? List.of() : List.copyOf(boundaries);
            features = features == null ? List.of() : List.copyOf(features);
            editorHandles = editorHandles == null ? List.of() : List.copyOf(editorHandles);
        }

        public static MapSnapshot empty() {
            return new MapSnapshot(TopologyKind.SQUARE, 1, 1, List.of(), List.of(), List.of(), List.of());
        }
    }

    public record RoomExitNarration(
            String label,
            Cell cell,
            String direction,
            String description
    ) {
        public RoomExitNarration {
            label = label == null || label.isBlank() ? "Ausgang" : label.trim();
            cell = cell == null ? Cell.empty() : cell;
            direction = direction == null || direction.isBlank() ? "NORTH" : direction.trim();
            description = description == null ? "" : description;
        }
    }

    public record RoomNarrationCard(
            long roomId,
            String roomName,
            String visualDescription,
            List<RoomExitNarration> exits
    ) {
        public RoomNarrationCard {
            roomId = Math.max(0L, roomId);
            roomName = roomName == null || roomName.isBlank() ? "Raum" : roomName.trim();
            visualDescription = visualDescription == null ? "" : visualDescription;
            exits = exits == null ? List.of() : List.copyOf(exits);
        }
    }

    public record Inspector(
            String title,
            String summary,
            List<String> facts,
            List<RoomNarrationCard> roomNarrations
    ) {
        public Inspector {
            title = title == null || title.isBlank() ? "Dungeon" : title;
            summary = summary == null ? "" : summary;
            facts = facts == null ? List.of() : List.copyOf(facts);
            roomNarrations = roomNarrations == null ? List.of() : List.copyOf(roomNarrations);
        }
    }

    public sealed interface CorridorEndpoint permits CorridorDoorEndpoint, CorridorAnchorEndpoint {
    }

    public record CorridorDoorEndpoint(
            long roomId,
            long clusterId,
            Cell roomCell,
            String direction,
            TopologyElementRef topologyRef
    ) implements CorridorEndpoint {
        public CorridorDoorEndpoint {
            roomId = Math.max(0L, roomId);
            clusterId = Math.max(0L, clusterId);
            roomCell = roomCell == null ? Cell.empty() : roomCell;
            direction = direction == null ? "" : direction.trim();
            topologyRef = topologyRef == null ? TopologyElementRef.empty() : topologyRef;
        }
    }

    public record CorridorAnchorEndpoint(
            long hostCorridorId,
            Cell anchorCell,
            TopologyElementRef topologyRef
    ) implements CorridorEndpoint {
        public CorridorAnchorEndpoint {
            hostCorridorId = Math.max(0L, hostCorridorId);
            anchorCell = anchorCell == null ? Cell.empty() : anchorCell;
            topologyRef = topologyRef == null ? TopologyElementRef.empty() : topologyRef;
        }
    }
}
