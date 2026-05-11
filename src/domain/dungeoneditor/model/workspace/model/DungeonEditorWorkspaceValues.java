package src.domain.dungeoneditor.model.workspace.model;

import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;

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
            return this == other || other instanceof MapId that && value == that.value;
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

    public enum TopologyKind {
        SQUARE,
        HEX;

        public static TopologyKind fromName(@Nullable String name) {
            return "HEX".equals(name) ? HEX : SQUARE;
        }

        public boolean isHex() {
            return this == HEX;
        }
    }

    public enum AreaKind {
        ROOM,
        CORRIDOR;

        public static AreaKind fromName(@Nullable String name) {
            return "CORRIDOR".equals(name) ? CORRIDOR : ROOM;
        }

        public boolean isRoom() {
            return this == ROOM;
        }

        public boolean isCorridor() {
            return this == CORRIDOR;
        }
    }

    public static final class BoundaryKind {
        public static final BoundaryKind WALL = new BoundaryKind("WALL", "wall");
        public static final BoundaryKind DOOR = new BoundaryKind("DOOR", "door");

        private final String name;
        private final String externalKind;

        private BoundaryKind(String name, String externalKind) {
            this.name = name;
            this.externalKind = externalKind;
        }

        public static BoundaryKind fromExternalKind(@Nullable String kind) {
            return "door".equalsIgnoreCase(kind) ? DOOR : WALL;
        }

        public static BoundaryKind defaultKind() {
            return WALL;
        }

        public String name() {
            return name;
        }

        public String externalKind() {
            return externalKind;
        }

        public boolean isDoor() {
            return this == DOOR;
        }

        @Override
        public String toString() {
            return name;
        }
    }

    public enum FeatureKind {
        STAIR,
        TRANSITION;

        public static FeatureKind fromName(@Nullable String name) {
            return "TRANSITION".equals(name) ? TRANSITION : STAIR;
        }

        public boolean isTransition() {
            return this == TRANSITION;
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

        public boolean isRoom() {
            return this == ROOM;
        }

        public boolean isCorridor() {
            return this == CORRIDOR;
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

        public boolean isClusterLabel() {
            return this == CLUSTER_LABEL;
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

    public static final class Cell {
        private final int q;
        private final int r;
        private final int level;

        public Cell(int q, int r, int level) {
            this.q = q;
            this.r = r;
            this.level = level;
        }

        public static Cell empty() {
            return new Cell(0, 0, 0);
        }

        public int q() {
            return q;
        }

        public int r() {
            return r;
        }

        public int level() {
            return level;
        }

        @Override
        public boolean equals(Object other) {
            if (this == other) {
                return true;
            }
            if (!(other instanceof Cell that)) {
                return false;
            }
            return q == that.q && r == that.r && level == that.level;
        }

        @Override
        public int hashCode() {
            return Objects.hash(q, r, level);
        }

        @Override
        public String toString() {
            return "Cell[q=%d, r=%d, level=%d]".formatted(q, r, level);
        }
    }

    public static final class Edge {
        private final Cell from;
        private final Cell to;

        public Edge(Cell from, Cell to) {
            Cell safeFrom = from == null ? Cell.empty() : from;
            this.from = safeFrom;
            this.to = to == null ? safeFrom : to;
        }

        public Cell from() {
            return from;
        }

        public Cell to() {
            return to;
        }

        @Override
        public boolean equals(Object other) {
            if (this == other) {
                return true;
            }
            if (!(other instanceof Edge that)) {
                return false;
            }
            return Objects.equals(from, that.from) && Objects.equals(to, that.to);
        }

        @Override
        public int hashCode() {
            return Objects.hash(from, to);
        }

        @Override
        public String toString() {
            return "Edge[from=%s, to=%s]".formatted(from, to);
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
            return new TopologyElementRef(kind.isCorridor() ? TopologyElementKind.CORRIDOR : TopologyElementKind.ROOM, id);
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
            return new TopologyElementRef(kind.isDoor() ? TopologyElementKind.DOOR : TopologyElementKind.WALL, id);
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
                    kind.isTransition() ? TopologyElementKind.TRANSITION : TopologyElementKind.STAIR,
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
        private final List<String> facts;
        private final List<RoomNarrationCard> roomNarrations;

        public Inspector(String title, String summary, List<String> facts, List<RoomNarrationCard> roomNarrations) {
            this.title = title == null || title.isBlank() ? "Dungeon" : title;
            this.summary = summary == null ? "" : summary;
            this.facts = facts == null ? List.of() : List.copyOf(facts);
            this.roomNarrations = roomNarrations == null ? List.of() : List.copyOf(roomNarrations);
        }

        public String title() {
            return title;
        }

        public String summary() {
            return summary;
        }

        public List<String> facts() {
            return List.copyOf(facts);
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
                    && Objects.equals(facts, that.facts)
                    && Objects.equals(roomNarrations, that.roomNarrations);
        }

        @Override
        public int hashCode() {
            return Objects.hash(title, summary, facts, roomNarrations);
        }

        @Override
        public String toString() {
            return "Inspector[title=%s, summary=%s, facts=%s, roomNarrations=%s]"
                    .formatted(title, summary, facts, roomNarrations);
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
