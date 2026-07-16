package features.dungeon.domain.core.graph;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.projection.DungeonAreaFacts;
import features.dungeon.domain.core.projection.DungeonAreaType;
import features.dungeon.domain.core.projection.DungeonMapFacts;

final class DungeonCorridorTraversalLinkProjection {

    List<DungeonTraversalLink> project(DungeonMapFacts map) {
        if (map == null) {
            return List.of();
        }
        List<DungeonTraversalLink> result = new ArrayList<>();
        for (DungeonAreaFacts area : map.areas()) {
            if (area != null && area.kind() == DungeonAreaType.CORRIDOR) {
                appendCorridorLinks(result, area);
            }
        }
        return List.copyOf(result);
    }

    private static void appendCorridorLinks(List<DungeonTraversalLink> result, DungeonAreaFacts area) {
        Set<String> seen = new LinkedHashSet<>();
        Set<Cell> cells = corridorCellSet(area);
        for (Cell first : area.cells()) {
            if (first == null) {
                continue;
            }
            appendHorizontalLinks(result, area, first, cells, seen);
        }
    }

    private static Set<Cell> corridorCellSet(DungeonAreaFacts area) {
        Set<Cell> result = new LinkedHashSet<>();
        for (Cell cell : area.cells()) {
            if (cell != null) {
                result.add(cell);
            }
        }
        return Set.copyOf(result);
    }

    private static void appendHorizontalLinks(
            List<DungeonTraversalLink> result,
            DungeonAreaFacts area,
            Cell first,
            Set<Cell> cells,
            Set<String> seen
    ) {
        List<Cell> neighbors = List.of(
                new Cell(first.q() + 1, first.r(), first.level()),
                new Cell(first.q() - 1, first.r(), first.level()),
                new Cell(first.q(), first.r() + 1, first.level()),
                new Cell(first.q(), first.r() - 1, first.level()));
        for (Cell second : neighbors) {
            if (cells.contains(second)) {
                appendLink(result, area, first, second, seen);
            }
        }
    }

    private static void appendLink(
            List<DungeonTraversalLink> result,
            DungeonAreaFacts area,
            Cell first,
            Cell second,
            Set<String> seen
    ) {
        String pairKey = pairKey(first, second);
        if (!seen.add(pairKey)) {
            return;
        }
        String key = DungeonTraversalSourceKind.CORRIDOR.name().toLowerCase(Locale.ROOT)
                + ":" + area.id() + ":" + pairKey;
        result.add(new DungeonTraversalLink(
                key,
                new DungeonTraversalSource(DungeonTraversalSourceKind.CORRIDOR, area.id(), area.label()),
                new DungeonTraversalEndpoint(first, area.id(), area.label()),
                new DungeonTraversalEndpoint(second, area.id(), area.label())));
    }

    private static String pairKey(Cell first, Cell second) {
        String left = cellKey(first);
        String right = cellKey(second);
        return left.compareTo(right) <= 0 ? left + ":" + right : right + ":" + left;
    }

    private static String cellKey(Cell cell) {
        return cell.q() + "," + cell.r() + "," + cell.level();
    }

}
