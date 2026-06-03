package src.domain.dungeon.model.runtime.travel.projection;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.worldspace.DungeonCell;
import src.domain.dungeon.model.worldspace.DungeonEdge;

final class TravelGeometryProjectionMapper {

    private TravelGeometryProjectionMapper() {
    }

    static Cell toCoreCell(@Nullable DungeonCell cell) {
        return cell == null ? new Cell(0, 0, 0) : new Cell(cell.q(), cell.r(), cell.level());
    }

    static DungeonCell toWorldspaceCell(@Nullable Cell cell) {
        Cell safeCell = cell == null ? new Cell(0, 0, 0) : cell;
        return new DungeonCell(safeCell.q(), safeCell.r(), safeCell.level());
    }

    static Edge toCoreEdge(@Nullable DungeonEdge edge) {
        return edge == null
                ? new Edge(new Cell(0, 0, 0), new Cell(0, 0, 0))
                : new Edge(toCoreCell(edge.from()), toCoreCell(edge.to()));
    }
}
