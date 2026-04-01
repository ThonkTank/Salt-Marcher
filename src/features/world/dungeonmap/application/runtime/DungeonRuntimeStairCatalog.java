package features.world.dungeonmap.application.runtime;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.stair.DungeonStair;
import features.world.dungeonmap.model.structures.stair.DungeonStairExit;

import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

public final class DungeonRuntimeStairCatalog {

    private DungeonRuntimeStairCatalog() {
        throw new AssertionError("No instances");
    }

    public static List<DungeonRuntimeStairDescriptor> describe(
            DungeonLayout layout,
            Room room,
            CubePoint activeTile
    ) {
        if (layout == null || room == null || room.roomId() == null) {
            return List.of();
        }
        return levelsForRoomSurface(room.geometry(), activeTile).stream()
                .flatMap(levelZ -> describe(layout, room.geometry().cellsAtLevel(levelZ), levelZ, activeTile).stream())
                .toList();
    }

    public static List<DungeonRuntimeStairDescriptor> describe(
            DungeonLayout layout,
            Corridor corridor,
            CubePoint activeTile
    ) {
        if (layout == null || corridor == null || corridor.corridorId() == null) {
            return List.of();
        }
        return describe(layout, corridor.geometry().cellsAtLevel(corridor.levelZ()), corridor.levelZ(), activeTile);
    }

    public static List<DungeonRuntimeStairDescriptor> describeAtCells(
            DungeonLayout layout,
            Set<Point2i> surfaceCells,
            int levelZ,
            CubePoint activeTile
    ) {
        return describe(layout, surfaceCells, levelZ, activeTile);
    }

    private static List<DungeonRuntimeStairDescriptor> describe(
            DungeonLayout layout,
            Set<Point2i> surfaceCells,
            int levelZ,
            CubePoint activeTile
    ) {
        if (layout == null || surfaceCells == null || surfaceCells.isEmpty()) {
            return List.of();
        }
        Set<Point2i> resolvedCells = Set.copyOf(surfaceCells);
        return layout.stairsAtLevel(levelZ).stream()
                .filter(stair -> stair != null && stair.stairId() != null)
                .filter(stair -> stair.exitsAtLevel(levelZ).stream()
                        .map(DungeonStairExit::position)
                        .map(CubePoint::projectedCell)
                        .anyMatch(resolvedCells::contains))
                .sorted(Comparator.comparing(DungeonStair::label, String.CASE_INSENSITIVE_ORDER)
                        .thenComparing(DungeonStair::stairId))
                .map(stair -> toDescriptor(stair, levelZ, resolvedCells, activeTile))
                .flatMap(List::stream)
                .toList();
    }

    private static List<DungeonRuntimeStairDescriptor> toDescriptor(
            DungeonStair stair,
            int levelZ,
            Set<Point2i> surfaceCells,
            CubePoint activeTile
    ) {
        if (stair == null) {
            return List.of();
        }
        Set<CubePoint> originPositions = stair.exitsAtLevel(levelZ).stream()
                .map(DungeonStairExit::position)
                .filter(position -> position != null && surfaceCells.contains(position.projectedCell()))
                .collect(Collectors.toCollection(LinkedHashSet::new));
        if (originPositions.isEmpty()) {
            return List.of();
        }
        return stair.exits().stream()
                .filter(exit -> exit != null && exit.position() != null)
                .filter(exit -> !originPositions.contains(exit.position()))
                .filter(exit -> activeTile == null || !activeTile.equals(exit.position()))
                .sorted(Comparator.comparingInt((DungeonStairExit exit) -> exit.position().z())
                        .thenComparing(exit -> exit.position(), CubePoint.POINT_ORDER))
                .map(exit -> new DungeonRuntimeStairDescriptor(
                        stair.label(),
                        exit.label(),
                        destinationLabel(exit),
                        description(stair, exit),
                        DungeonRuntimeLocation.stairExit(stair.stairId(), exit.position())))
                .toList();
    }

    private static String destinationLabel(DungeonStairExit exit) {
        if (exit == null) {
            return "";
        }
        String label = exit.label();
        return label == null || label.isBlank() ? "z=" + exit.position().z() : label;
    }

    private static String description(DungeonStair stair, DungeonStairExit exit) {
        String stairName = stair == null ? "die Treppe" : stair.label();
        String target = destinationLabel(exit);
        return "Über " + stairName + " gelangt ihr zu " + target + ".";
    }

    private static List<Integer> levelsForRoomSurface(features.world.dungeonmap.model.objects.StructureGeometry geometry, CubePoint activeTile) {
        if (geometry == null) {
            return List.of();
        }
        if (activeTile != null && geometry.contains(activeTile)) {
            return List.of(activeTile.z());
        }
        return geometry.levels().stream()
                .sorted()
                .toList();
    }
}
