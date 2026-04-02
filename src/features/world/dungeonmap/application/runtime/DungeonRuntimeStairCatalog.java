package features.world.dungeonmap.application.runtime;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.CubePoint;
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
            CellCoord activeCell,
            int activeLevelZ
    ) {
        if (layout == null || room == null || room.roomId() == null) {
            return List.of();
        }
        return levelsForRoomSurface(room.structure(), activeCell, activeLevelZ).stream()
                .flatMap(levelZ -> describe(layout, room.structure().cellCoordsAtLevel(levelZ), levelZ, activeCell, activeLevelZ).stream())
                .toList();
    }

    public static List<DungeonRuntimeStairDescriptor> describe(
            DungeonLayout layout,
            Corridor corridor,
            CellCoord activeCell,
            int activeLevelZ
    ) {
        if (layout == null || corridor == null || corridor.corridorId() == null) {
            return List.of();
        }
        return describe(layout, corridor.structure().cellCoordsAtLevel(corridor.levelZ()), corridor.levelZ(), activeCell, activeLevelZ);
    }

    public static List<DungeonRuntimeStairDescriptor> describeAtCells(
            DungeonLayout layout,
            Set<CellCoord> surfaceCells,
            int levelZ,
            CellCoord activeCell,
            int activeLevelZ
    ) {
        return describe(layout, surfaceCells, levelZ, activeCell, activeLevelZ);
    }

    private static List<DungeonRuntimeStairDescriptor> describe(
            DungeonLayout layout,
            Set<CellCoord> surfaceCells,
            int levelZ,
            CellCoord activeCell,
            int activeLevelZ
    ) {
        if (layout == null || surfaceCells == null || surfaceCells.isEmpty()) {
            return List.of();
        }
        Set<CellCoord> resolvedCells = Set.copyOf(surfaceCells);
        return layout.stairsAtLevel(levelZ).stream()
                .filter(stair -> stair != null && stair.stairId() != null)
                .filter(stair -> stair.exitsAtLevel(levelZ).stream()
                        .map(DungeonStairExit::position)
                        .map(CubePoint::projectedCell)
                        .anyMatch(resolvedCells::contains))
                .sorted(Comparator.comparing(DungeonStair::label, String.CASE_INSENSITIVE_ORDER)
                        .thenComparing(DungeonStair::stairId))
                .map(stair -> toDescriptor(stair, levelZ, resolvedCells, activeCell, activeLevelZ))
                .flatMap(List::stream)
                .toList();
    }

    private static List<DungeonRuntimeStairDescriptor> toDescriptor(
            DungeonStair stair,
            int levelZ,
            Set<CellCoord> surfaceCells,
            CellCoord activeCell,
            int activeLevelZ
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
                .filter(exit -> activeCell == null
                        || exit.position().z() != activeLevelZ
                        || !activeCell.equals(exit.position().projectedCell()))
                .sorted(Comparator.comparingInt((DungeonStairExit exit) -> exit.position().z())
                        .thenComparing(exit -> exit.position(), CubePoint.POINT_ORDER))
                .map(exit -> new DungeonRuntimeStairDescriptor(
                        stair.label(),
                        exit.label(),
                        destinationLabel(exit),
                        description(stair, exit),
                        DungeonRuntimeLocation.stairExit(stair.stairId(), exit.position().projectedCell(), exit.position().z())))
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

    private static List<Integer> levelsForRoomSurface(
            features.world.dungeonmap.model.objects.StructureObject structure,
            CellCoord activeCell,
            int activeLevelZ
    ) {
        if (structure == null) {
            return List.of();
        }
        if (activeCell != null && structure.contains(activeCell, activeLevelZ)) {
            return List.of(activeLevelZ);
        }
        return structure.levels().stream()
                .sorted()
                .toList();
    }
}
