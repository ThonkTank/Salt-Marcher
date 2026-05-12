package src.domain.dungeon.model.map.model;

import org.jspecify.annotations.Nullable;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

public final class DungeonTraversalLinkProjection {

    private static final String DOOR_KIND = "door";

    public List<DungeonTraversalLink> project(@Nullable DungeonMap dungeonMap, DungeonMapFacts map) {
        List<DungeonTraversalLink> result = new ArrayList<>();
        result.addAll(doorTraversalLinks(map));
        if (dungeonMap != null) {
            result.addAll(stairTraversalLinks(dungeonMap, map));
        }
        return List.copyOf(result);
    }

    private static List<DungeonTraversalLink> doorTraversalLinks(DungeonMapFacts map) {
        if (map == null) {
            return List.of();
        }
        Set<DungeonCell> traversableCells = new LinkedHashSet<>(map.allCells());
        List<DungeonTraversalLink> result = new ArrayList<>();
        for (DungeonBoundaryFacts boundary : map.boundaries()) {
            DungeonEdge edge = boundary.edge();
            List<DungeonCell> touchingCells = edge == null ? List.of() : edge.touchingCells();
            if (doorLinkUnavailable(boundary, touchingCells, traversableCells)) {
                continue;
            }
            DungeonCell first = touchingCells.get(0);
            DungeonCell second = touchingCells.get(1);
            result.add(new DungeonTraversalLink(
                    traversalKey(DungeonTraversalSourceKind.DOOR, boundary.id(), first, second),
                    new DungeonTraversalSource(DungeonTraversalSourceKind.DOOR, boundary.id(), boundary.label()),
                    traversalEndpoint(map, first),
                    traversalEndpoint(map, second)));
        }
        return List.copyOf(result);
    }

    private static boolean doorLinkUnavailable(
            DungeonBoundaryFacts boundary,
            List<DungeonCell> touchingCells,
            Set<DungeonCell> traversableCells
    ) {
        return boundary == null
                || !DOOR_KIND.equalsIgnoreCase(boundary.kind())
                || touchingCells.size() != 2
                || !traversableCells.contains(touchingCells.get(0))
                || !traversableCells.contains(touchingCells.get(1));
    }

    private static List<DungeonTraversalLink> stairTraversalLinks(DungeonMap dungeonMap, DungeonMapFacts map) {
        if (map == null) {
            return List.of();
        }
        List<DungeonTraversalLink> result = new ArrayList<>();
        for (DungeonStair stair : dungeonMap.connections().stairs()) {
            appendStairLinks(result, map, stair);
        }
        return List.copyOf(result);
    }

    private static void appendStairLinks(List<DungeonTraversalLink> result, DungeonMapFacts map, DungeonStair stair) {
        List<DungeonStairExit> exits = stair.exits();
        for (int leftIndex = 0; leftIndex < exits.size(); leftIndex++) {
            for (int rightIndex = leftIndex + 1; rightIndex < exits.size(); rightIndex++) {
                DungeonStairExit left = exits.get(leftIndex);
                DungeonStairExit right = exits.get(rightIndex);
                result.add(new DungeonTraversalLink(
                        traversalKey(DungeonTraversalSourceKind.STAIR, stair.stairId(), left.position(), right.position()),
                        new DungeonTraversalSource(DungeonTraversalSourceKind.STAIR, stair.stairId(), stair.name()),
                        stairEndpoint(map, left),
                        stairEndpoint(map, right)));
            }
        }
    }

    private static DungeonTraversalEndpoint traversalEndpoint(DungeonMapFacts map, DungeonCell tile) {
        DungeonAreaFacts area = areaAt(map, tile);
        return new DungeonTraversalEndpoint(tile, area == null ? 0L : area.id(), area == null ? "" : area.label());
    }

    private static DungeonTraversalEndpoint stairEndpoint(DungeonMapFacts map, DungeonStairExit exit) {
        DungeonAreaFacts area = areaAt(map, exit.position());
        return new DungeonTraversalEndpoint(exit.position(), area == null ? 0L : area.id(), exit.label());
    }

    private static @Nullable DungeonAreaFacts areaAt(DungeonMapFacts map, DungeonCell tile) {
        for (DungeonAreaFacts area : map.areas()) {
            if (area != null && area.cells().contains(tile)) {
                return area;
            }
        }
        return null;
    }

    private static String traversalKey(
            DungeonTraversalSourceKind sourceKind,
            long sourceId,
            DungeonCell first,
            DungeonCell second
    ) {
        String left = cellKey(first);
        String right = cellKey(second);
        String ordered = left.compareTo(right) <= 0 ? left + ":" + right : right + ":" + left;
        return sourceKind.name().toLowerCase(Locale.ROOT) + ":" + sourceId + ":" + ordered;
    }

    private static String cellKey(DungeonCell cell) {
        DungeonCell safeCell = cell == null ? new DungeonCell(0, 0, 0) : cell;
        return safeCell.q() + "," + safeCell.r() + "," + safeCell.level();
    }
}
