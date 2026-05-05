package src.domain.dungeon.map.service;

import java.util.List;
import java.util.Objects;
import src.domain.dungeon.map.aggregate.DungeonMap;
import src.domain.dungeon.map.value.DungeonCell;
import src.domain.dungeon.map.value.DungeonClusterBoundaryKind;
import src.domain.dungeon.map.value.DungeonEdge;

public final class DungeonRoomTopologyEditor {

    private static final DungeonRoomRectangleMutationService RECTANGLE_MUTATION_SERVICE =
            new DungeonRoomRectangleMutationService();
    private static final DungeonClusterBoundaryEditService BOUNDARY_EDIT_SERVICE =
            new DungeonClusterBoundaryEditService();
    private static final DungeonBoundaryStretchEditService STRETCH_EDIT_SERVICE =
            new DungeonBoundaryStretchEditService();

    public DungeonMap paintRectangle(DungeonMap dungeonMap, DungeonCell start, DungeonCell end) {
        Objects.requireNonNull(dungeonMap, "dungeonMap");
        return RECTANGLE_MUTATION_SERVICE.paintRectangle(dungeonMap, start, end);
    }

    public DungeonMap deleteRectangle(DungeonMap dungeonMap, DungeonCell start, DungeonCell end) {
        Objects.requireNonNull(dungeonMap, "dungeonMap");
        return RECTANGLE_MUTATION_SERVICE.deleteRectangle(dungeonMap, start, end);
    }

    public DungeonMap editBoundaries(
            DungeonMap dungeonMap,
            long clusterId,
            List<DungeonEdge> edges,
            DungeonClusterBoundaryKind kind,
            boolean deleteBoundary
    ) {
        Objects.requireNonNull(dungeonMap, "dungeonMap");
        return BOUNDARY_EDIT_SERVICE.editBoundaries(dungeonMap, clusterId, edges, kind, deleteBoundary);
    }

    public DungeonMap moveBoundaryStretch(
            DungeonMap dungeonMap,
            long clusterId,
            List<DungeonEdge> sourceEdges,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        Objects.requireNonNull(dungeonMap, "dungeonMap");
        return STRETCH_EDIT_SERVICE.moveBoundaryStretch(dungeonMap, clusterId, sourceEdges, deltaQ, deltaR, deltaLevel);
    }
}
