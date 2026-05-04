package src.domain.dungeoneditor.published;

import java.util.List;
import org.jspecify.annotations.Nullable;

public record DungeonEditorMapProjectionSnapshot(
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

    public DungeonEditorMapProjectionSnapshot {
        mapName = normalizeMapName(mapName);
        topology = topology == null ? TopologyKind.SQUARE : topology;
        width = normalizeDimension(width);
        height = normalizeDimension(height);
        cells = immutableElements(cells);
        edges = immutableElements(edges);
        labels = immutableElements(labels);
        markers = immutableElements(markers);
        graphNodes = immutableElements(graphNodes);
        graphLinks = immutableElements(graphLinks);
    }

    public static DungeonEditorMapProjectionSnapshot empty(String mapName) {
        return new DungeonEditorMapProjectionSnapshot(
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

    public record CellProjection(
            int q,
            int r,
            int level,
            String label,
            CellKind kind,
            long ownerId,
            long clusterId,
            DungeonEditorTopologyElementRef topologyRef,
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
            topologyRef = topologyRef == null ? DungeonEditorTopologyElementRef.empty() : topologyRef;
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
            DungeonEditorTopologyElementRef topologyRef,
            boolean selected,
            boolean preview
    ) {

        public EdgeProjection {
            kind = kind == null ? EdgeKind.WALL : kind;
            label = label == null ? "" : label;
            ownerId = Math.max(0L, ownerId);
            topologyRef = topologyRef == null ? DungeonEditorTopologyElementRef.empty() : topologyRef;
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
            DungeonEditorTopologyElementRef topologyRef,
            boolean selected,
            boolean preview
    ) {

        public LabelProjection {
            label = label == null ? "" : label;
            ownerId = Math.max(0L, ownerId);
            clusterId = Math.max(0L, clusterId);
            topologyRef = topologyRef == null ? DungeonEditorTopologyElementRef.empty() : topologyRef;
        }
    }

    public record MarkerProjection(
            String label,
            double q,
            double r,
            int level,
            MarkerKind kind,
            boolean selected,
            DungeonEditorHandleRef handleRef,
            boolean preview
    ) {

        public MarkerProjection {
            label = label == null ? "" : label;
            kind = kind == null ? MarkerKind.DOOR : kind;
            handleRef = handleRef == null ? DungeonEditorHandleRef.empty() : handleRef;
        }
    }

    public enum MarkerKind {
        DOOR,
        STAIR,
        WAYPOINT
    }

    public record GraphLinkProjection(long fromId, long toId, boolean selected) {

        public GraphLinkProjection {
            fromId = normalizedId(fromId);
            toId = normalizedId(toId);
        }
    }

    public enum Heading {
        NORTH,
        EAST,
        SOUTH,
        WEST
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

    private static String normalizeMapName(String mapName) {
        return mapName == null || mapName.isBlank() ? "Dungeon" : mapName.trim();
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

    private static <T> List<T> immutableElements(@Nullable List<T> elements) {
        return elements == null ? List.of() : List.copyOf(elements);
    }
}
