package src.domain.dungeon.application;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.map.value.DungeonCell;
import src.domain.dungeon.map.value.DungeonEdge;
import src.domain.dungeon.map.value.DungeonEdgeDirection;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonEdgeRef;

public final class DungeonCellEdgeBoundaryTranslator {

    private DungeonCellEdgeBoundaryTranslator() {
    }

    public static DungeonCellRef cell(DungeonCell cell) {
        return new DungeonCellRef(cell.q(), cell.r(), cell.level());
    }

    public static DungeonCell domainCell(@Nullable DungeonCellRef cell) {
        return cell == null ? emptyCell() : new DungeonCell(cell.q(), cell.r(), cell.level());
    }

    public static DungeonCell emptyCell() {
        return new DungeonCell(0, 0, 0);
    }

    public static DungeonEdgeRef edge(DungeonEdge edge) {
        return new DungeonEdgeRef(cell(edge.from()), cell(edge.to()));
    }

    public static DungeonEdge domainEdge(@Nullable DungeonEdgeRef edge) {
        if (edge == null) {
            DungeonCell origin = emptyCell();
            return new DungeonEdge(origin, origin);
        }
        return new DungeonEdge(domainCell(edge.from()), domainCell(edge.to()));
    }

    public static DungeonEdgeDirection direction(@Nullable String direction) {
        return direction == null || direction.isBlank()
                ? DungeonEdgeDirection.NORTH
                : DungeonEdgeDirection.parse(direction);
    }
}
