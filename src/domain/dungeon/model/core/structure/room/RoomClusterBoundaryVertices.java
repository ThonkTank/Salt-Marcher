package src.domain.dungeon.model.core.structure.room;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.CellOrdering;
import src.domain.dungeon.model.core.geometry.EdgeKey;
import src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryKind;
import src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryRow;

final class RoomClusterBoundaryVertices {

    private RoomClusterBoundaryVertices() {
    }

    static List<Cell> authored(
            Map<EdgeKey, BoundaryRow> rowsByKey,
            @Nullable Cell center,
            int level,
            Iterable<Cell> relativeVertices
    ) {
        Set<Cell> vertices = new LinkedHashSet<>();
        addRelativeVertices(vertices, center, level, relativeVertices);
        if (vertices.isEmpty()) {
            addWallEndpoints(vertices, rowsByKey, level);
        }
        return vertices.stream()
                .sorted(CellOrdering::compareCells)
                .toList();
    }

    private static void addRelativeVertices(
            Set<Cell> vertices,
            @Nullable Cell center,
            int level,
            Iterable<Cell> relativeVertices
    ) {
        Cell resolvedCenter = center == null ? new Cell(0, 0, level) : center;
        for (Cell vertex : relativeVertices == null ? List.<Cell>of() : relativeVertices) {
            if (vertex != null && !RoomCellCoverage.LOOP_SEPARATOR.equals(vertex)) {
                vertices.add(new Cell(
                        resolvedCenter.q() + vertex.q(),
                        resolvedCenter.r() + vertex.r(),
                        level));
            }
        }
    }

    private static void addWallEndpoints(Set<Cell> vertices, Map<EdgeKey, BoundaryRow> rowsByKey, int level) {
        for (Map.Entry<EdgeKey, BoundaryRow> entry : rowsByKey.entrySet()) {
            if (wallRowAtLevel(entry.getKey(), entry.getValue(), level)) {
                vertices.add(entry.getKey().lower());
                vertices.add(entry.getKey().upper());
            }
        }
    }

    private static boolean wallRowAtLevel(@Nullable EdgeKey key, @Nullable BoundaryRow row, int level) {
        return row != null
                && row.level() == level
                && row.kind() == BoundaryKind.WALL
                && key != null
                && key.lower() != null
                && key.upper() != null
                && key.lower().level() == key.upper().level();
    }
}
