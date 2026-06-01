package src.domain.dungeon.model.worldspace.model;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.jspecify.annotations.Nullable;

final class DungeonStairGeometryValues {
    private DungeonStairGeometryValues() {
    }

    static @Nullable DungeonStairShape supportedShape(String value) {
        DungeonStairShape shape = parseShape(value);
        if (shape == null || !shape.supportedEditorShape()) {
            return null;
        }
        return shape;
    }

    static @Nullable Long positiveCorridorId(@Nullable Long corridorId) {
        if (corridorId == null || corridorId <= 0L) {
            return null;
        }
        return corridorId;
    }

    static List<DungeonCell> sortedUniquePath(List<DungeonCell> source) {
        return DungeonCellOrdering.sortedCells(source);
    }

    static List<DungeonStairExit> sortedExits(List<DungeonStairExit> source) {
        List<DungeonStairExit> result = new ArrayList<>();
        for (DungeonStairExit exit : source == null ? List.<DungeonStairExit>of() : source) {
            if (exit != null) {
                result.add(exit);
            }
        }
        result.sort(DungeonStairGeometryValues::compareStairExits);
        return List.copyOf(result);
    }

    static List<DungeonCell> generatedPath(
            DungeonStairShape shape,
            DungeonCell anchor,
            DungeonEdgeDirection direction,
            int dimension1
    ) {
        if (shape == null || anchor == null || direction == null) {
            return List.of();
        }
        int normalizedDimension1 = shape.normalizedEditorDimension1(dimension1);
        return DungeonStairPathGenerator.path(shape, anchor, direction, normalizedDimension1);
    }

    static List<DungeonStairExit> generatedExits(
            DungeonStairShape shape,
            DungeonCell anchor,
            DungeonEdgeDirection direction,
            int dimension1,
            int dimension2,
            List<DungeonStairExit> existingExits
    ) {
        List<DungeonCell> path = generatedPath(shape, anchor, direction, dimension1);
        if (path.isEmpty()) {
            return List.of();
        }
        Map<Integer, Long> exitIdsByLevel = existingExitIdsByLevel(anchor.level(), existingExits);
        List<DungeonStairExit> exits = new ArrayList<>();
        for (int levelOffset = 0; levelOffset <= dimension2; levelOffset++) {
            int pathStep = (int) Math.round((double) (path.size() - 1) * levelOffset / dimension2);
            DungeonCell pathCell = path.get(pathStep);
            DungeonCell exitCell = new DungeonCell(pathCell.q(), pathCell.r(), anchor.level() + levelOffset);
            exits.add(new DungeonStairExit(exitIdsByLevel.getOrDefault(levelOffset, 0L), exitCell, ""));
        }
        return List.copyOf(exits);
    }

    private static int compareStairExits(DungeonStairExit left, DungeonStairExit right) {
        int levelComparison = Integer.compare(left.position().level(), right.position().level());
        if (levelComparison != 0) {
            return levelComparison;
        }
        int rowComparison = Integer.compare(left.position().r(), right.position().r());
        if (rowComparison != 0) {
            return rowComparison;
        }
        int columnComparison = Integer.compare(left.position().q(), right.position().q());
        if (columnComparison != 0) {
            return columnComparison;
        }
        return Long.compare(left.exitId(), right.exitId());
    }

    private static @Nullable DungeonStairShape parseShape(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return DungeonStairShape.parse(value);
    }

    private static Map<Integer, Long> existingExitIdsByLevel(
            int anchorLevel,
            List<DungeonStairExit> existingExits
    ) {
        Map<Integer, Long> result = new HashMap<>();
        for (DungeonStairExit exit : existingExits == null ? List.<DungeonStairExit>of() : existingExits) {
            if (exit != null && exit.exitId() > 0L) {
                result.putIfAbsent(exit.position().level() - anchorLevel, exit.exitId());
            }
        }
        return Map.copyOf(result);
    }
}
