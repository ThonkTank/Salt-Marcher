package src.domain.travel.published;

import java.util.List;
import org.jspecify.annotations.Nullable;

public record TravelDungeonMapProjectionSnapshot(
        String mapName,
        TopologyKind topology,
        int width,
        int height,
        List<CellProjection> cells,
        List<EdgeProjection> edges,
        List<LabelProjection> labels,
        List<MarkerProjection> markers,
        List<GraphNodeProjection> graphNodes,
        List<GraphLinkProjection> graphLinks,
        @Nullable PartyTokenProjection partyToken
) {

    public TravelDungeonMapProjectionSnapshot {
        mapName = mapName == null || mapName.isBlank() ? "Dungeon" : mapName.trim();
        topology = topology == null ? TopologyKind.SQUARE : topology;
        width = Math.max(1, width);
        height = Math.max(1, height);
        cells = cells == null ? List.of() : List.copyOf(cells);
        edges = edges == null ? List.of() : List.copyOf(edges);
        labels = labels == null ? List.of() : List.copyOf(labels);
        markers = markers == null ? List.of() : List.copyOf(markers);
        graphNodes = graphNodes == null ? List.of() : List.copyOf(graphNodes);
        graphLinks = graphLinks == null ? List.of() : List.copyOf(graphLinks);
    }

    public static TravelDungeonMapProjectionSnapshot empty(String mapName) {
        return new TravelDungeonMapProjectionSnapshot(
                mapName,
                TopologyKind.SQUARE,
                1,
                1,
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                null);
    }

    public enum TopologyKind {
        SQUARE,
        HEX
    }

    public record TopologyRef(String kind, long id) {

        public TopologyRef {
            kind = kind == null || kind.isBlank() ? "EMPTY" : kind.trim();
            id = Math.max(0L, id);
        }

        public static TopologyRef empty() {
            return new TopologyRef("EMPTY", 0L);
        }
    }

    public record MarkerHandle(
            String kind,
            TopologyRef topologyRef,
            long ownerId,
            long clusterId,
            long corridorId,
            long roomId,
            int index,
            int q,
            int r,
            int level,
            String direction
    ) {

        public MarkerHandle {
            kind = kind == null || kind.isBlank() ? "EMPTY" : kind.trim();
            topologyRef = topologyRef == null ? TopologyRef.empty() : topologyRef;
            ownerId = Math.max(0L, ownerId);
            clusterId = Math.max(0L, clusterId);
            corridorId = Math.max(0L, corridorId);
            roomId = Math.max(0L, roomId);
            index = Math.max(0, index);
            direction = direction == null ? "" : direction.trim();
        }
    }

    public record CellProjection(
            int q,
            int r,
            int level,
            String label,
            CellKind kind,
            long ownerId,
            long clusterId,
            TopologyRef topologyRef,
            boolean selected,
            boolean overlay,
            boolean preview,
            boolean destructivePreview
    ) {

        public CellProjection {
            label = label == null ? "" : label;
            kind = kind == null ? CellKind.ROOM : kind;
            ownerId = Math.max(0L, ownerId);
            clusterId = Math.max(0L, clusterId);
            topologyRef = topologyRef == null ? TopologyRef.empty() : topologyRef;
        }
    }

    public enum CellKind {
        ROOM,
        CORRIDOR,
        STAIR,
        TRANSITION
    }

    public record EdgeProjection(
            double startQ,
            double startR,
            double endQ,
            double endR,
            int level,
            EdgeKind kind,
            String label,
            long ownerId,
            TopologyRef topologyRef,
            boolean selected,
            boolean preview
    ) {

        public EdgeProjection {
            kind = kind == null ? EdgeKind.WALL : kind;
            label = label == null ? "" : label;
            ownerId = Math.max(0L, ownerId);
            topologyRef = topologyRef == null ? TopologyRef.empty() : topologyRef;
        }
    }

    public enum EdgeKind {
        WALL,
        DOOR
    }

    public record LabelProjection(
            String label,
            double q,
            double r,
            int level,
            long ownerId,
            long clusterId,
            TopologyRef topologyRef,
            boolean selected,
            boolean preview
    ) {

        public LabelProjection {
            label = label == null ? "" : label;
            ownerId = Math.max(0L, ownerId);
            clusterId = Math.max(0L, clusterId);
            topologyRef = topologyRef == null ? TopologyRef.empty() : topologyRef;
        }
    }

    public record MarkerProjection(
            String label,
            double q,
            double r,
            int level,
            MarkerKind kind,
            boolean selected,
            MarkerHandle handle,
            boolean preview
    ) {

        public MarkerProjection {
            label = label == null ? "" : label;
            kind = kind == null ? MarkerKind.DOOR : kind;
            handle = handle == null ? new MarkerHandle("EMPTY", TopologyRef.empty(), 0L, 0L, 0L, 0L, 0, 0, 0, 0, "") : handle;
        }
    }

    public enum MarkerKind {
        DOOR,
        STAIR,
        WAYPOINT
    }

    public record GraphNodeProjection(
            long id,
            long clusterId,
            String label,
            double q,
            double r,
            boolean selected
    ) {

        public GraphNodeProjection {
            id = Math.max(0L, id);
            clusterId = Math.max(0L, clusterId);
            label = label == null || label.isBlank() ? "Room" : label;
        }
    }

    public record GraphLinkProjection(long fromId, long toId, boolean selected) {

        public GraphLinkProjection {
            fromId = Math.max(0L, fromId);
            toId = Math.max(0L, toId);
        }
    }

    public record PartyTokenProjection(
            double q,
            double r,
            int level,
            Heading heading,
            boolean visible
    ) {

        public PartyTokenProjection {
            heading = heading == null ? Heading.SOUTH : heading;
        }
    }

    public enum Heading {
        NORTH,
        EAST,
        SOUTH,
        WEST
    }
}
