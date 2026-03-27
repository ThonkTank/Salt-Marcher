package features.world.dungeonmap.model.structures.stair;

import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.Point2i;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public record StairGeometry(
        List<CubePoint> pathNodes,
        List<DungeonStairExit> exits
) {

    public StairGeometry {
        pathNodes = pathNodes == null ? List.of() : List.copyOf(pathNodes);
        exits = exits == null ? List.of() : List.copyOf(exits);
    }

    public static StairGeometry fromExitLevels(
            StairShape shape,
            Point2i anchor,
            CardinalDirection direction,
            int dimension1,
            int dimension2,
            List<Integer> exitLevels
    ) {
        List<Integer> sortedExitLevels = validateAndSortExitLevels(exitLevels);
        List<CubePoint> pathNodes = StairPathGenerator.generatePath(
                requireShape(shape),
                anchor,
                requireDirection(direction),
                sortedExitLevels.getFirst(),
                sortedExitLevels.getLast(),
                dimension1,
                dimension2);
        Map<Integer, CubePoint> pathPointByLevel = new LinkedHashMap<>();
        for (CubePoint node : pathNodes) {
            pathPointByLevel.put(node.z(), node);
        }
        ArrayList<DungeonStairExit> exits = new ArrayList<>();
        for (Integer level : sortedExitLevels) {
            CubePoint exitPoint = pathPointByLevel.get(level);
            if (exitPoint == null) {
                throw new IllegalArgumentException("Treppenpfad deckt Ebene z=" + level + " nicht ab");
            }
            exits.add(new DungeonStairExit(0L, exitPoint, "Ebene z=" + level));
        }
        return new StairGeometry(List.copyOf(pathNodes), List.copyOf(exits));
    }

    public Set<CubePoint> occupiedPositions() {
        LinkedHashSet<CubePoint> occupied = new LinkedHashSet<>(pathNodes);
        for (DungeonStairExit exit : exits) {
            if (exit != null && exit.position() != null) {
                occupied.add(exit.position());
            }
        }
        return Set.copyOf(occupied);
    }

    private static List<Integer> validateAndSortExitLevels(List<Integer> exitLevels) {
        ArrayList<Integer> result = new ArrayList<>();
        for (Integer level : exitLevels == null ? List.<Integer>of() : exitLevels) {
            if (level != null) {
                result.add(level);
            }
        }
        if (result.size() < 2) {
            throw new IllegalArgumentException("Mindestens zwei verschiedene Ebenen");
        }
        if (result.stream().distinct().count() != result.size()) {
            throw new IllegalArgumentException("Ausgänge dürfen nicht doppelt sein");
        }
        result.sort(Integer::compareTo);
        return List.copyOf(result);
    }

    private static StairShape requireShape(StairShape shape) {
        if (shape == null) {
            throw new IllegalArgumentException("Treppenform fehlt");
        }
        return shape;
    }

    private static CardinalDirection requireDirection(CardinalDirection direction) {
        if (direction == null) {
            throw new IllegalArgumentException("Treppenrichtung fehlt");
        }
        return direction;
    }
}
