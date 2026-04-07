package features.world.dungeonmap.application.runtime;

import features.world.dungeonmap.application.runtime.description.DungeonRuntimeExit;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.structures.connection.ConnectionTraversalTarget;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.stair.DungeonStair;
import features.world.dungeonmap.model.structures.stair.StairExit;
import features.world.dungeonmap.model.structures.transition.DungeonTransition;
import features.world.dungeonmap.model.structures.transition.DungeonTransitionDestination;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Runtime actions are assembled from the shared parsed location plus resolved exit data.
 *
 * <p>Door actions derive from the resolved runtime exits. Stair and transition actions derive from the same parsed
 * location instead of forcing the description branch to carry executable workflow state or description copy.
 */
public final class DungeonRuntimeActionResolver {

    private DungeonRuntimeActionResolver() {
        throw new AssertionError("No instances");
    }

    public static List<DungeonRuntimeAction> resolve(
            DungeonRuntimeLocation location,
            List<DungeonRuntimeExit> exits
    ) {
        if (location == null) {
            return List.of();
        }
        List<DungeonRuntimeExit> resolvedExits = exits == null ? List.of() : exits;
        ArrayList<DungeonRuntimeAction> actions = new ArrayList<>(resolvedExits.size() + 4);
        resolvedExits.stream()
                .map(exit -> doorAction(location, exit))
                .filter(Objects::nonNull)
                .forEach(actions::add);
        switch (location.structure()) {
            case DungeonLayout.CellStructure.RoomStructure ignored -> appendRoomActions(location, actions);
            case DungeonLayout.CellStructure.CorridorStructure ignored -> appendCorridorActions(location, actions);
            case DungeonLayout.CellStructure.StairStructure ignored -> appendStairActions(location, actions);
            case DungeonLayout.CellStructure.TransitionStructure ignored -> appendActiveTransitionAction(location, actions);
        }
        return List.copyOf(actions);
    }

    private static DungeonRuntimeAction doorAction(DungeonRuntimeLocation location, DungeonRuntimeExit exit) {
        if (location == null || exit == null || location.layout() == null) {
            return null;
        }
        var connection = location.layout().connectionForDoor(exit.doorRef());
        if (connection == null) {
            return null;
        }
        ConnectionTraversalTarget target = connection.resolveTraversalTarget(location.layout(), location.activeEndpoint());
        if (target == null) {
            return null;
        }
        if (target.transitionId() != null && target.transitionId() > 0) {
            return new DungeonRuntimeAction(
                    doorActionLabel(exit.label(), exit.destinationLabel()),
                    "",
                    "Übergang konnte nicht benutzt werden",
                    new DungeonRuntimeAction.TransitionTarget(target.transitionId()));
        }
        return new DungeonRuntimeAction(
                doorActionLabel(exit.label(), exit.destinationLabel()),
                "",
                "Verbindung konnte nicht benutzt werden",
                new DungeonRuntimeAction.DoorTarget(exit.doorRef()));
    }

    private static void appendRoomActions(
            DungeonRuntimeLocation location,
            List<DungeonRuntimeAction> actions
    ) {
        Room room = location.room();
        if (room == null) {
            return;
        }
        for (int levelZ : location.layout().roomRelevantLevels(room, location.activeCell(), location.activeLevelZ())) {
            Set<CellCoord> roomFloorCells = location.layout().roomStructure(room).surfaceAtLevel(levelZ).floor().cellCoords();
            appendStructureStairs(
                    location.layout(),
                    roomFloorCells,
                    levelZ,
                    location.activeCell(),
                    location.activeLevelZ(),
                    actions);
            appendStructureTransitions(
                    location.layout(),
                    roomFloorCells,
                    levelZ,
                    actions);
        }
    }

    private static void appendCorridorActions(
            DungeonRuntimeLocation location,
            List<DungeonRuntimeAction> actions
    ) {
        var corridor = location.corridor();
        if (corridor == null) {
            return;
        }
        // Runtime exits must terminate on explicit floor truth instead of assuming corridor surface implies walkable area.
        Set<CellCoord> corridorFloorCells = corridor.structure().surfaceAtLevel(corridor.levelZ()).floor().cellCoords();
        appendStructureStairs(
                location.layout(),
                corridorFloorCells,
                corridor.levelZ(),
                location.activeCell(),
                location.activeLevelZ(),
                actions);
        appendStructureTransitions(
                location.layout(),
                corridorFloorCells,
                corridor.levelZ(),
                actions);
    }

    private static void appendStairActions(
            DungeonRuntimeLocation location,
            List<DungeonRuntimeAction> actions
    ) {
        DungeonStair stair = location.stair();
        if (stair == null) {
            return;
        }
        appendStairActions(
                stair,
                stairOriginPositions(stair, location.activeCell(), location.activeLevelZ()),
                location.activeCell(),
                location.activeLevelZ(),
                actions);
        appendTransitionActionsAtCell(location.layout(), location.activeCell(), location.activeLevelZ(), actions);
    }

    private static void appendActiveTransitionAction(
            DungeonRuntimeLocation location,
            List<DungeonRuntimeAction> actions
    ) {
        DungeonTransition transition = location.transition();
        if (transition == null || transition.transitionId() == null) {
            return;
        }
        actions.add(transitionAction(transition));
    }

    private static void appendStructureStairs(
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
                        .map(StairExit::position)
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
                .sorted(Comparator.comparingInt((StairExit exit) -> exit.position().z())
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
                .map(StairExit::position)
                .filter(Objects::nonNull)
                .filter(position -> position.z() == activeLevelZ)
                .filter(position -> activeCell == null || activeCell.equals(position.projectedCell()))
                .collect(Collectors.toCollection(LinkedHashSet::new));
        if (!activeOrigins.isEmpty()) {
            return activeOrigins;
        }
        Set<CubePoint> sameLevelOrigins = stair.exits().stream()
                .map(StairExit::position)
                .filter(Objects::nonNull)
                .filter(position -> position.z() == activeLevelZ)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        if (!sameLevelOrigins.isEmpty()) {
            return sameLevelOrigins;
        }
        return stair.exits().stream()
                .map(StairExit::position)
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
                .map(StairExit::position)
                .filter(position -> position != null && surfaceCells.contains(position.projectedCell()))
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private static void appendStructureTransitions(
            DungeonLayout layout,
            Set<CellCoord> cells,
            int levelZ,
            List<DungeonRuntimeAction> actions
    ) {
        if (layout == null || cells == null || cells.isEmpty()) {
            return;
        }
        layout.transitionsAtLevel(levelZ).stream()
                .filter(transition -> transition != null)
                .map(transition -> transition.localConnection() == null ? null : java.util.Map.entry(transition, transition.localConnection()))
                .filter(Objects::nonNull)
                .filter(entry -> entry.getValue().occupiedPositions(layout).stream()
                        .filter(point -> point != null && point.z() == levelZ)
                        .map(CubePoint::projectedCell)
                        .anyMatch(cells::contains))
                .sorted(Comparator.comparing(entry -> entry.getKey().transitionId()))
                .map(entry -> transitionAction(entry.getKey()))
                .forEach(actions::add);
    }

    private static void appendTransitionActionsAtCell(
            DungeonLayout layout,
            CellCoord cell,
            int levelZ,
            List<DungeonRuntimeAction> actions
    ) {
        if (layout == null || cell == null) {
            return;
        }
        layout.transitionsAtCell(cell, levelZ).stream()
                .filter(transition -> transition != null && transition.transitionId() != null)
                .sorted(Comparator.comparing(DungeonTransition::transitionId))
                .map(DungeonRuntimeActionResolver::transitionAction)
                .forEach(actions::add);
    }

    private static DungeonRuntimeAction transitionAction(DungeonTransition transition) {
        return new DungeonRuntimeAction(
                transitionActionLabel(transition),
                transitionDescription(transition),
                "Übergang konnte nicht benutzt werden",
                new DungeonRuntimeAction.TransitionTarget(transition.transitionId()));
    }

    private static String doorActionLabel(String label, String destinationLabel) {
        String resolvedLabel = label == null || label.isBlank() ? "Tür" : label.trim();
        return destinationLabel == null || destinationLabel.isBlank()
                ? resolvedLabel
                : resolvedLabel + ": " + destinationLabel;
    }

    private static String stairActionLabel(DungeonStair stair, StairExit exit) {
        String stairLabel = stair == null ? "Treppe" : stair.label();
        String destinationLabel = stairDestinationLabel(exit);
        return destinationLabel.isBlank() ? stairLabel : stairLabel + ": " + destinationLabel;
    }

    private static String stairDestinationLabel(StairExit exit) {
        if (exit == null || exit.position() == null) {
            return "";
        }
        String label = exit.label();
        return label == null || label.isBlank() ? "z=" + exit.position().z() : label;
    }

    private static String stairDescription(DungeonStair stair, StairExit exit) {
        String stairName = stair == null ? "die Treppe" : stair.label();
        String target = stairDestinationLabel(exit);
        return "Über " + stairName + " gelangt ihr zu " + target + ".";
    }

    private static String transitionActionLabel(DungeonTransition transition) {
        if (transition == null) {
            return "Übergang";
        }
        String destinationLabel = transitionDestinationLabel(transition.destination());
        return destinationLabel.isBlank() ? transition.label() : transition.label() + ": " + destinationLabel;
    }

    private static String transitionDestinationLabel(DungeonTransitionDestination destination) {
        if (destination instanceof DungeonTransitionDestination.OverworldTileDestination overworld) {
            return "Overworld-Feld " + overworld.tileId();
        }
        if (destination instanceof DungeonTransitionDestination.DungeonMapDestination dungeon) {
            if (dungeon.transitionId() == null) {
                return "Dungeon " + dungeon.mapId();
            }
            return "Dungeon " + dungeon.mapId() + " · Übergang " + dungeon.transitionId();
        }
        return "";
    }

    private static String transitionDescription(DungeonTransition transition) {
        if (transition == null) {
            return "";
        }
        if (transition.description() != null && !transition.description().isBlank()) {
            return transition.description();
        }
        if (transition.destination() instanceof DungeonTransitionDestination.OverworldTileDestination overworld) {
            return transition.label() + " führt zum Overworld-Feld " + overworld.tileId() + ".";
        }
        if (transition.destination() instanceof DungeonTransitionDestination.DungeonMapDestination dungeon) {
            if (dungeon.transitionId() == null) {
                return transition.label() + " führt zu Dungeon " + dungeon.mapId() + ".";
            }
            return transition.label() + " führt zu Übergang " + dungeon.transitionId() + " auf Dungeon " + dungeon.mapId() + ".";
        }
        return transition.label();
    }
}
