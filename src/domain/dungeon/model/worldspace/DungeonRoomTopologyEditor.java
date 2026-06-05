package src.domain.dungeon.model.worldspace;

import java.util.List;
import java.util.Objects;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Edge;

public final class DungeonRoomTopologyEditor {

    private static final DungeonRoomRectangleMutationLogic RECTANGLE_MUTATION_SERVICE =
            new DungeonRoomRectangleMutationLogic();
    private static final DungeonClusterBoundaryEditLogic BOUNDARY_EDIT_SERVICE =
            new DungeonClusterBoundaryEditLogic();
    private static final DungeonBoundaryStretchEditLogic STRETCH_EDIT_SERVICE =
            new DungeonBoundaryStretchEditLogic();

    public DungeonMap paintRectangle(DungeonMap dungeonMap, Cell start, Cell end) {
        return RECTANGLE_MUTATION_SERVICE.paintRectangle(requireDungeonMap(dungeonMap), start, end);
    }

    public DungeonMap deleteRectangle(DungeonMap dungeonMap, Cell start, Cell end) {
        return RECTANGLE_MUTATION_SERVICE.deleteRectangle(requireDungeonMap(dungeonMap), start, end);
    }

    public DungeonMap editBoundaries(
            DungeonMap dungeonMap,
            long clusterId,
            List<Edge> edges,
            DungeonClusterBoundaryKind kind,
            boolean deleteBoundary
    ) {
        return BOUNDARY_EDIT_SERVICE.editBoundaries(requireDungeonMap(dungeonMap), clusterId, edges, kind, deleteBoundary);
    }

    public DungeonMap moveBoundaryStretch(
            DungeonMap dungeonMap,
            long clusterId,
            List<Edge> sourceEdges,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        return STRETCH_EDIT_SERVICE.moveBoundaryStretch(
                requireDungeonMap(dungeonMap),
                clusterId,
                sourceEdges,
                deltaQ,
                deltaR,
                deltaLevel);
    }

    private DungeonMap requireDungeonMap(DungeonMap dungeonMap) {
        return Objects.requireNonNull(dungeonMap, "dungeonMap");
    }
}
