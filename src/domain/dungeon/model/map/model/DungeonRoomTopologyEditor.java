package src.domain.dungeon.model.map.model;

import java.util.List;
import java.util.Objects;
import src.domain.dungeon.model.map.model.DungeonMap;
import src.domain.dungeon.model.map.model.DungeonCell;
import src.domain.dungeon.model.map.model.DungeonClusterBoundaryKind;
import src.domain.dungeon.model.map.model.DungeonEdge;

public final class DungeonRoomTopologyEditor {

    private static final DungeonRoomRectangleMutationLogic RECTANGLE_MUTATION_SERVICE =
            new DungeonRoomRectangleMutationLogic();
    private static final DungeonClusterBoundaryEditLogic BOUNDARY_EDIT_SERVICE =
            new DungeonClusterBoundaryEditLogic();
    private static final DungeonBoundaryStretchEditLogic STRETCH_EDIT_SERVICE =
            new DungeonBoundaryStretchEditLogic();

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
