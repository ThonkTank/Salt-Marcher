package src.domain.dungeon.published;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonMapProjectionContent;
import src.domain.dungeon.published.DungeonTopologyKind;

public record DungeonEditorMapProjectionSnapshot(
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

    public DungeonEditorMapProjectionSnapshot {
        mapName = normalizeMapName(mapName);
        topology = topology == null ? DungeonTopologyKind.SQUARE : topology;
        width = normalizeDimension(width);
        height = normalizeDimension(height);
        content = content == null ? DungeonMapProjectionContent.empty() : content;
    }

    public static DungeonEditorMapProjectionSnapshot empty(String mapName) {
        return new DungeonEditorMapProjectionSnapshot(mapName, DungeonTopologyKind.SQUARE, 1, 1, DungeonMapProjectionContent.empty(), null);
    }

    public List<CellProjection> cells() { return content.cells(); }
    public List<EdgeProjection> edges() { return content.edges(); }
    public List<LabelProjection> labels() { return content.labels(); }
    public List<MarkerProjection> markers() { return content.markers(); }
    public List<GraphNodeProjection> graphNodes() { return content.graphNodes(); }
    public List<GraphLinkProjection> graphLinks() { return content.graphLinks(); }

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
            DungeonBoundaryKind kind,
            String label,
            long ownerId,
            DungeonEditorTopologyElementRef topologyRef,
            boolean selected,
            boolean preview
    ) {

        public EdgeProjection {
            kind = kind == null ? DungeonBoundaryKind.WALL : kind;
            label = label == null ? "" : label;
            ownerId = Math.max(0L, ownerId);
            topologyRef = topologyRef == null ? DungeonEditorTopologyElementRef.empty() : topologyRef;
        }
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

    public record PartyTokenProjection(
            double q,
            double r,
            int level,
            DungeonTravelHeading heading,
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

    private static DungeonTravelHeading defaultHeading(@Nullable DungeonTravelHeading heading) {
        return heading == null ? DungeonTravelHeading.SOUTH : heading;
    }

}
