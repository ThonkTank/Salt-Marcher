package features.dungeon.domain.core.graph;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import features.dungeon.domain.core.component.StairExit;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Edge;
import features.dungeon.domain.core.projection.DungeonAreaFacts;
import features.dungeon.domain.core.projection.DungeonBoundaryFacts;
import features.dungeon.domain.core.projection.DungeonFeatureFacts;
import features.dungeon.domain.core.projection.DungeonMapFacts;
import features.dungeon.domain.core.structure.stair.Stair;
import features.dungeon.domain.core.structure.DungeonMap;

public final class DungeonTraversalLinkProjection {

    private static final String DOOR_KIND = "door";
    private static final DungeonCorridorTraversalLinkProjection CORRIDOR_LINKS =
            new DungeonCorridorTraversalLinkProjection();

    public List<DungeonTraversalLink> project(@Nullable DungeonMap dungeonMap, DungeonMapFacts map) {
        CellAreaIndex index = CellAreaIndex.from(map);
        List<DungeonTraversalLink> result = new ArrayList<>();
        result.addAll(doorTraversalLinks(map, index));
        result.addAll(CORRIDOR_LINKS.project(map));
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
            Edge edge = boundary.edge();
            List<Cell> touchingCells = edge == null ? List.of() : edge.touchingCells();
            if (doorLinkUnavailable(boundary, touchingCells, index)) {
                continue;
            }
            Cell first = touchingCells.get(0);
            Cell second = touchingCells.get(1);
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
            List<Cell> touchingCells,
            CellAreaIndex index
    ) {
        return !DOOR_KIND.equalsIgnoreCase(boundary.kind())
                || touchingCells.size() != 2
                || !index.contains(touchingCells.get(0))
                || !index.contains(touchingCells.get(1));
    }

    private static List<DungeonTraversalLink> stairTraversalLinks(DungeonMap dungeonMap, CellAreaIndex index) {
        List<DungeonTraversalLink> result = new ArrayList<>();
        for (Stair stair : dungeonMap.stairs().stairs()) {
            appendStairLinks(result, index, stair);
        }
        return List.copyOf(result);
    }

    private static void appendStairLinks(List<DungeonTraversalLink> result, CellAreaIndex index, Stair stair) {
        List<StairExit> exits = stair.exits();
        for (int leftIndex = 0; leftIndex < exits.size(); leftIndex++) {
            for (int rightIndex = leftIndex + 1; rightIndex < exits.size(); rightIndex++) {
                StairExit left = exits.get(leftIndex);
                StairExit right = exits.get(rightIndex);
                result.add(new DungeonTraversalLink(
                        traversalKey(DungeonTraversalSourceKind.STAIR, stair.stairId(), left.position(), right.position()),
                        new DungeonTraversalSource(DungeonTraversalSourceKind.STAIR, stair.stairId(), stair.name()),
                        stairEndpoint(index, left),
                        stairEndpoint(index, right)));
            }
        }
    }

    private static DungeonTraversalEndpoint traversalEndpoint(CellAreaIndex index, Cell tile) {
        DungeonAreaFacts area = index.areaAt(tile);
        return new DungeonTraversalEndpoint(tile, area == null ? 0L : area.id(), area == null ? "" : area.label());
    }

    private static DungeonTraversalEndpoint stairEndpoint(CellAreaIndex index, StairExit exit) {
        DungeonAreaFacts area = index.areaAt(exit.position());
        return new DungeonTraversalEndpoint(exit.position(), area == null ? 0L : area.id(), exit.label());
    }

    private static String traversalKey(
            DungeonTraversalSourceKind sourceKind,
            long sourceId,
            Cell first,
            Cell second
    ) {
        String left = cellKey(first);
        String right = cellKey(second);
        String ordered = left.compareTo(right) <= 0 ? left + ":" + right : right + ":" + left;
        return sourceKind.name().toLowerCase(Locale.ROOT) + ":" + sourceId + ":" + ordered;
    }

    private static String cellKey(Cell cell) {
        Cell safeCell = cell == null ? new Cell(0, 0, 0) : cell;
        return safeCell.q() + "," + safeCell.r() + "," + safeCell.level();
    }

    private record CellAreaIndex(
            Set<Cell> traversableCells,
            Map<Cell, DungeonAreaFacts> areasByCell
    ) {
        static CellAreaIndex from(DungeonMapFacts map) {
            Set<Cell> cells = new LinkedHashSet<>();
            Map<Cell, DungeonAreaFacts> areas = new LinkedHashMap<>();
            if (map != null) {
                appendAreas(cells, areas, map.areas());
                appendFeatureCells(cells, map.features());
            }
            return new CellAreaIndex(Set.copyOf(cells), Map.copyOf(areas));
        }

        boolean contains(Cell cell) {
            return traversableCells.contains(cell);
        }

        @Nullable DungeonAreaFacts areaAt(Cell cell) {
            return areasByCell.get(cell);
        }

        private static void appendAreas(
                Set<Cell> cells,
                Map<Cell, DungeonAreaFacts> areas,
                List<DungeonAreaFacts> areaFacts
        ) {
            for (DungeonAreaFacts area : areaFacts == null ? List.<DungeonAreaFacts>of() : areaFacts) {
                if (area == null) {
                    continue;
                }
                for (Cell cell : area.cells()) {
                    if (cell != null) {
                        cells.add(cell);
                        areas.putIfAbsent(cell, area);
                    }
                }
            }
        }

        private static void appendFeatureCells(Set<Cell> cells, List<DungeonFeatureFacts> features) {
            for (DungeonFeatureFacts feature : features == null ? List.<DungeonFeatureFacts>of() : features) {
                if (feature == null) {
                    continue;
                }
                for (Cell cell : feature.cells()) {
                    if (cell != null) {
                        cells.add(cell);
                    }
                }
            }
        }
    }
}
