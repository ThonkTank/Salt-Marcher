package src.domain.dungeon.model.worldspace;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.structure.room.RoomClusterDoorBoundaryMaterialization;

final class DungeonClusterBoundaryDoorDecisionAdapter {

    boolean allowsDoorMaterialization(
            @Nullable DungeonClusterBoundary existing,
            DungeonEdge edge,
            Map<Long, List<DungeonCell>> cellsByRoom
    ) {
        return RoomClusterDoorBoundaryMaterialization.forEdge(
                coreEdge(edge),
                coreCellsByRoom(cellsByRoom),
                boundaryKind(existing))
                .materializesDoor();
    }

    private static RoomClusterDoorBoundaryMaterialization.ExistingBoundaryKind boundaryKind(
            @Nullable DungeonClusterBoundary boundary
    ) {
        if (boundary == null) {
            return RoomClusterDoorBoundaryMaterialization.ExistingBoundaryKind.NONE;
        }
        if (boundary.kind() == DungeonClusterBoundaryKind.DOOR) {
            return RoomClusterDoorBoundaryMaterialization.ExistingBoundaryKind.DOOR;
        }
        return RoomClusterDoorBoundaryMaterialization.ExistingBoundaryKind.NON_DOOR;
    }

    private static @Nullable Edge coreEdge(@Nullable DungeonEdge edge) {
        if (edge == null || edge.from() == null || edge.to() == null) {
            return null;
        }
        return new Edge(edge.from().geometry(), edge.to().geometry());
    }

    private static Map<Long, List<Cell>> coreCellsByRoom(Map<Long, List<DungeonCell>> cellsByRoom) {
        if (cellsByRoom == null || cellsByRoom.isEmpty()) {
            return Map.of();
        }
        Map<Long, List<Cell>> result = new LinkedHashMap<>();
        for (Map.Entry<Long, List<DungeonCell>> entry : cellsByRoom.entrySet()) {
            if (entry.getKey() != null) {
                result.put(entry.getKey(), coreCells(entry.getValue()));
            }
        }
        return Map.copyOf(result);
    }

    private static List<Cell> coreCells(List<DungeonCell> cells) {
        List<Cell> result = new ArrayList<>();
        for (DungeonCell cell : cells == null ? List.<DungeonCell>of() : cells) {
            if (cell != null) {
                result.add(cell.geometry());
            }
        }
        return List.copyOf(result);
    }
}
