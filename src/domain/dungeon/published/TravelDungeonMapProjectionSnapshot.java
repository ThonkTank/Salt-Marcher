package src.domain.dungeon.published;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonMapProjectionContent;
import src.domain.dungeon.published.DungeonTopologyKind;

public record TravelDungeonMapProjectionSnapshot(
        String mapName,
        DungeonTopologyKind topology,
        int width,
        int height,
        DungeonMapProjectionContent<
                CellProjection,
                EdgeProjection,
                LabelProjection,
                MarkerProjection,
                GraphNodeProjection,
                GraphLinkProjection> content,
        @Nullable PartyTokenProjection partyToken
) {

    public TravelDungeonMapProjectionSnapshot {
        mapName = normalizeMapName(mapName);
        topology = topology == null ? DungeonTopologyKind.SQUARE : topology;
        width = normalizeDimension(width);
        height = normalizeDimension(height);
        content = content == null ? DungeonMapProjectionContent.empty() : content;
    }

    public record TopologyRef(String kind, long id) {

        public TopologyRef {
            kind = normalizedKind(kind);
            id = normalizedId(id);
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
            kind = normalizedKind(kind);
            topologyRef = topologyRef == null ? TopologyRef.empty() : topologyRef;
            ownerId = normalizedId(ownerId);
            clusterId = normalizedId(clusterId);
            corridorId = normalizedId(corridorId);
            roomId = normalizedId(roomId);
            index = Math.max(0, index);
            direction = normalizedDirection(direction);
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
            ownerId = normalizedId(ownerId);
            clusterId = normalizedId(clusterId);
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
            ownerId = normalizedId(ownerId);
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
            ownerId = normalizedId(ownerId);
            clusterId = normalizedId(clusterId);
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
            id = normalizedId(id);
            clusterId = normalizedId(clusterId);
            label = normalizedGraphLabel(label);
        }
    }

    public record GraphLinkProjection(long fromId, long toId, boolean selected) {

        public GraphLinkProjection {
            fromId = normalizedId(fromId);
            toId = normalizedId(toId);
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
            heading = defaultHeading(heading);
        }
    }

    public enum Heading {
        NORTH,
        EAST,
        SOUTH,
        WEST
    }

    private static String normalizeMapName(String mapName) {
        return mapName == null || mapName.isBlank() ? "Dungeon" : mapName.trim();
    }

    private static String normalizedKind(String kind) {
        return kind == null || kind.isBlank() ? "EMPTY" : kind.trim();
    }

    private static int normalizeDimension(int dimension) {
        return Math.max(1, dimension);
    }

    private static long normalizedId(long id) {
        return Math.max(0L, id);
    }

    private static String normalizedGraphLabel(String label) {
        return label == null || label.isBlank() ? "Room" : label;
    }

    private static Heading defaultHeading(@Nullable Heading heading) {
        return heading == null ? Heading.SOUTH : heading;
    }

    private static String normalizedDirection(String direction) {
        return direction == null ? "" : direction.trim();
    }

}
