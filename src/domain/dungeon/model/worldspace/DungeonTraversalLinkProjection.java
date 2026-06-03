package src.domain.dungeon.model.worldspace;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.jspecify.annotations.Nullable;

public final class DungeonTraversalLinkProjection {

    private static final String DOOR_KIND = "door";

    public List<DungeonTraversalLink> project(@Nullable DungeonMap dungeonMap, DungeonMapFacts map) {
        CellAreaIndex index = CellAreaIndex.from(map);
        List<DungeonTraversalLink> result = new ArrayList<>();
        result.addAll(doorTraversalLinks(map, index));
        if (dungeonMap != null) {
            result.addAll(stairTraversalLinks(dungeonMap, index));
        }
        return List.copyOf(result);
    }

    private static List<DungeonTraversalLink> doorTraversalLinks(DungeonMapFacts map, CellAreaIndex index) {
        if (map == null) {
            return List.of();
        }
        List<DungeonTraversalLink> result = new ArrayList<>();
        for (DungeonBoundaryFacts boundary : map.boundaries()) {
            if (boundary == null) {
                continue;
            }
            DungeonEdge edge = boundary.edge();
            List<DungeonCell> touchingCells = edge == null ? List.of() : edge.touchingCells();
            if (doorLinkUnavailable(boundary, touchingCells, index)) {
                continue;
            }
            DungeonCell first = touchingCells.get(0);
            DungeonCell second = touchingCells.get(1);
            result.add(new DungeonTraversalLink(
                    traversalKey(DungeonTraversalSourceKind.DOOR, boundary.id(), first, second),
                    new DungeonTraversalSource(DungeonTraversalSourceKind.DOOR, boundary.id(), boundary.label()),
                    traversalEndpoint(index, first),
                    traversalEndpoint(index, second)));
        }
        return List.copyOf(result);
    }

    private static boolean doorLinkUnavailable(
            DungeonBoundaryFacts boundary,
            List<DungeonCell> touchingCells,
            CellAreaIndex index
    ) {
        return !DOOR_KIND.equalsIgnoreCase(boundary.kind())
                || touchingCells.size() != 2
                || !index.contains(touchingCells.get(0))
                || !index.contains(touchingCells.get(1));
    }

    private static List<DungeonTraversalLink> stairTraversalLinks(DungeonMap dungeonMap, CellAreaIndex index) {
        List<DungeonTraversalLink> result = new ArrayList<>();
        for (DungeonStair stair : dungeonMap.connections().stairs()) {
            appendStairLinks(result, index, stair);
        }
        return List.copyOf(result);
    }

    private static void appendStairLinks(List<DungeonTraversalLink> result, CellAreaIndex index, DungeonStair stair) {
        List<DungeonStairExit> exits = stair.exits();
        for (int leftIndex = 0; leftIndex < exits.size(); leftIndex++) {
            for (int rightIndex = leftIndex + 1; rightIndex < exits.size(); rightIndex++) {
                DungeonStairExit left = exits.get(leftIndex);
                DungeonStairExit right = exits.get(rightIndex);
                result.add(new DungeonTraversalLink(
                        traversalKey(DungeonTraversalSourceKind.STAIR, stair.stairId(), left.position(), right.position()),
                        new DungeonTraversalSource(DungeonTraversalSourceKind.STAIR, stair.stairId(), stair.name()),
                        stairEndpoint(index, left),
                        stairEndpoint(index, right)));
            }
        }
    }

    private static DungeonTraversalEndpoint traversalEndpoint(CellAreaIndex index, DungeonCell tile) {
        DungeonAreaFacts area = index.areaAt(tile);
        return new DungeonTraversalEndpoint(tile, area == null ? 0L : area.id(), area == null ? "" : area.label());
    }

    private static DungeonTraversalEndpoint stairEndpoint(CellAreaIndex index, DungeonStairExit exit) {
        DungeonAreaFacts area = index.areaAt(exit.position());
        return new DungeonTraversalEndpoint(exit.position(), area == null ? 0L : area.id(), exit.label());
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

    private record CellAreaIndex(
            Set<DungeonCell> traversableCells,
            Map<DungeonCell, DungeonAreaFacts> areasByCell
    ) {
        static CellAreaIndex from(DungeonMapFacts map) {
            Set<DungeonCell> cells = new LinkedHashSet<>();
            Map<DungeonCell, DungeonAreaFacts> areas = new LinkedHashMap<>();
            if (map != null) {
                appendAreas(cells, areas, map.areas());
                appendFeatureCells(cells, map.features());
            }
            return new CellAreaIndex(Set.copyOf(cells), Map.copyOf(areas));
        }

        boolean contains(DungeonCell cell) {
            return traversableCells.contains(cell);
        }

        @Nullable DungeonAreaFacts areaAt(DungeonCell cell) {
            return areasByCell.get(cell);
        }

        private static void appendAreas(
                Set<DungeonCell> cells,
                Map<DungeonCell, DungeonAreaFacts> areas,
                List<DungeonAreaFacts> areaFacts
        ) {
            for (DungeonAreaFacts area : areaFacts == null ? List.<DungeonAreaFacts>of() : areaFacts) {
                if (area == null) {
                    continue;
                }
                for (DungeonCell cell : area.cells()) {
                    if (cell != null) {
                        cells.add(cell);
                        areas.putIfAbsent(cell, area);
                    }
                }
            }
        }

        private static void appendFeatureCells(Set<DungeonCell> cells, List<DungeonFeatureFacts> features) {
            for (DungeonFeatureFacts feature : features == null ? List.<DungeonFeatureFacts>of() : features) {
                if (feature == null) {
                    continue;
                }
                for (DungeonCell cell : feature.cells()) {
                    if (cell != null) {
                        cells.add(cell);
                    }
                }
            }
        }
    }
}
