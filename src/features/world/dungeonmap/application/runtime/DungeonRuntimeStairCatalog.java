package features.world.dungeonmap.application.runtime;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.corridor.CorridorNetwork;
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
        int levelZ = layout.levelForRoom(room.roomId());
        return describe(layout, room.cells(), levelZ, activeTile);
    }

    public static List<DungeonRuntimeStairDescriptor> describe(
            DungeonLayout layout,
            Corridor corridor,
            CubePoint activeTile
    ) {
        if (layout == null || corridor == null || corridor.corridorId() == null || corridor.path() == null) {
            return List.of();
        }
        int levelZ = layout.levelForCorridor(corridor.corridorId());
        return describe(layout, corridor.path().floor().shape().absoluteCells(), levelZ, activeTile);
    }

    public static List<DungeonRuntimeStairDescriptor> describe(
            DungeonLayout layout,
            CorridorNetwork network,
            CubePoint activeTile
    ) {
        if (layout == null || network == null || network.floor() == null) {
            return List.of();
        }
        Integer levelZ = network.corridorIds().stream()
                .filter(id -> id != null)
                .map(layout::levelForCorridor)
                .findFirst()
                .orElse(null);
        if (levelZ == null) {
            return List.of();
        }
        return describe(layout, network.floor().shape().absoluteCells(), levelZ, activeTile);
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
                .sorted(Comparator.comparing(DungeonStair::name, String.CASE_INSENSITIVE_ORDER)
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
                        stair.name(),
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
        String stairName = stair == null || stair.name() == null || stair.name().isBlank() ? "die Treppe" : stair.name();
        String target = destinationLabel(exit);
        return "Über " + stairName + " gelangt ihr zu " + target + ".";
    }
}
