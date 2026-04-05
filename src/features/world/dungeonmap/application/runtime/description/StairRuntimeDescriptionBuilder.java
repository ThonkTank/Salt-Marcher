package features.world.dungeonmap.application.runtime.description;

import features.world.dungeonmap.application.runtime.DungeonRuntimeAction;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.structures.stair.DungeonStair;
import features.world.dungeonmap.model.structures.stair.DungeonStairExit;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

final class StairRuntimeDescriptionBuilder {

    private StairRuntimeDescriptionBuilder() {
        throw new AssertionError("No instances");
    }

    static DungeonRuntimeDescription build(
            DungeonLayout layout,
            DungeonStair stair,
            CellCoord activeCell,
            int activeLevelZ
    ) {
        if (layout == null || stair == null || stair.stairId() == null) {
            return null;
        }
        ArrayList<DungeonRuntimeAction> actions = new ArrayList<>();
        appendStairActions(stair, stairOriginPositions(stair, activeCell, activeLevelZ), activeCell, activeLevelZ, actions);
        TransitionRuntimeDescriptionBuilder.appendTransitionActionsAtCell(layout, activeCell, activeLevelZ, actions);
        return new DungeonRuntimeDescription(
                stair.label(),
                DungeonRuntimeDescriptionRef.stair(layout.mapId(), stair.stairId()),
                "Eine Treppe verbindet mehrere erschlossene Höhenstufen.",
                List.of(),
                actions);
    }

    static void appendStructureStairs(
            DungeonLayout layout,
            Set<CellCoord> cells,
            int levelZ,
            CellCoord activeCell,
            int activeLevelZ,
            List<DungeonRuntimeAction> actions
    ) {
        if (layout == null || cells == null || cells.isEmpty()) {
            return;
        }
        Set<CellCoord> surfaceCells = Set.copyOf(cells);
        layout.stairsAtLevel(levelZ).stream()
                .filter(stair -> stair != null && stair.stairId() != null)
                .filter(stair -> stair.exitsAtLevel(levelZ).stream()
                        .map(DungeonStairExit::position)
                        .map(CubePoint::projectedCell)
                        .anyMatch(surfaceCells::contains))
                .sorted(Comparator.comparing(DungeonStair::label, String.CASE_INSENSITIVE_ORDER)
                        .thenComparing(DungeonStair::stairId))
                .forEach(stair -> appendStairActions(
                        stair,
                        stairOriginPositions(stair, surfaceCells, levelZ),
                        activeCell,
                        activeLevelZ,
                        actions));
    }

    private static void appendStairActions(
            DungeonStair stair,
            Set<CubePoint> originPositions,
            CellCoord activeCell,
            int activeLevelZ,
            List<DungeonRuntimeAction> actions
    ) {
        if (stair == null || originPositions == null || originPositions.isEmpty()) {
            return;
        }
        stair.exits().stream()
                .filter(exit -> exit != null && exit.position() != null)
                .filter(exit -> !originPositions.contains(exit.position()))
                .filter(exit -> activeCell == null
                        || exit.position().z() != activeLevelZ
                        || !activeCell.equals(exit.position().projectedCell()))
                .sorted(Comparator.comparingInt((DungeonStairExit exit) -> exit.position().z())
                        .thenComparing(exit -> exit.position(), CubePoint.POINT_ORDER))
                .forEach(exit -> actions.add(new DungeonRuntimeAction(
                        stairActionLabel(stair, exit),
                        stairDescription(stair, exit),
                        "Treppe konnte nicht benutzt werden",
                        new DungeonRuntimeAction.CellTarget(
                                exit.position().projectedCell(),
                                exit.position().z(),
                                null))));
    }

    private static Set<CubePoint> stairOriginPositions(
            DungeonStair stair,
            CellCoord activeCell,
            int activeLevelZ
    ) {
        if (stair == null) {
            return Set.of();
        }
        Set<CubePoint> activeOrigins = stair.exits().stream()
                .map(DungeonStairExit::position)
                .filter(Objects::nonNull)
                .filter(position -> position.z() == activeLevelZ)
                .filter(position -> activeCell == null || activeCell.equals(position.projectedCell()))
                .collect(Collectors.toCollection(LinkedHashSet::new));
        if (!activeOrigins.isEmpty()) {
            return activeOrigins;
        }
        Set<CubePoint> sameLevelOrigins = stair.exits().stream()
                .map(DungeonStairExit::position)
                .filter(Objects::nonNull)
                .filter(position -> position.z() == activeLevelZ)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        if (!sameLevelOrigins.isEmpty()) {
            return sameLevelOrigins;
        }
        return stair.exits().stream()
                .map(DungeonStairExit::position)
                .filter(Objects::nonNull)
                .limit(1)
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private static Set<CubePoint> stairOriginPositions(
            DungeonStair stair,
            Set<CellCoord> surfaceCells,
            int levelZ
    ) {
        if (stair == null || surfaceCells == null || surfaceCells.isEmpty()) {
            return Set.of();
        }
        return stair.exitsAtLevel(levelZ).stream()
                .map(DungeonStairExit::position)
                .filter(position -> position != null && surfaceCells.contains(position.projectedCell()))
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private static String stairActionLabel(DungeonStair stair, DungeonStairExit exit) {
        String stairLabel = stair == null ? "Treppe" : stair.label();
        String destinationLabel = stairDestinationLabel(exit);
        return destinationLabel.isBlank() ? stairLabel : stairLabel + ": " + destinationLabel;
    }

    private static String stairDestinationLabel(DungeonStairExit exit) {
        if (exit == null || exit.position() == null) {
            return "";
        }
        String label = exit.label();
        return label == null || label.isBlank() ? "z=" + exit.position().z() : label;
    }

    private static String stairDescription(DungeonStair stair, DungeonStairExit exit) {
        String stairName = stair == null ? "die Treppe" : stair.label();
        String target = stairDestinationLabel(exit);
        return "Über " + stairName + " gelangt ihr zu " + target + ".";
    }
}
