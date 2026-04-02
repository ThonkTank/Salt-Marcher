package features.world.dungeonmap.application.runtime;

import features.world.dungeonmap.application.room.DoorExitCatalog;
import features.world.dungeonmap.application.room.RoomExitCatalog;
import features.world.dungeonmap.application.room.RoomExitDescriptor;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.structures.connection.Connection;
import features.world.dungeonmap.model.structures.connection.ConnectionEndpoint;
import features.world.dungeonmap.model.structures.connection.ConnectionEndpointType;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.stair.DungeonStair;
import features.world.dungeonmap.model.structures.stair.DungeonStairExit;
import features.world.dungeonmap.model.structures.transition.DungeonTransition;
import features.world.dungeonmap.model.structures.transition.DungeonTransitionDestination;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.function.BiFunction;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Owns the runtime action list so surfaces read one capability instead of stitching door, stair,
 * and transition catalogs together at every caller.
 */
public final class DungeonRuntimeActionCatalog {

    private DungeonRuntimeActionCatalog() {
        throw new AssertionError("No instances");
    }

    public static List<DungeonRuntimeAction> describe(
            DungeonLayout layout,
            Room room,
            CardinalDirection heading,
            CellCoord activeCell,
            int activeLevelZ
    ) {
        if (layout == null || room == null || room.roomId() == null) {
            return List.of();
        }
        ArrayList<DungeonRuntimeAction> actions = new ArrayList<>();
        actions.addAll(describeDoors(layout, room, heading));
        actions.addAll(describeStairs(layout, room, activeCell, activeLevelZ));
        actions.addAll(describeTransitions(layout, room, activeCell, activeLevelZ));
        return List.copyOf(actions);
    }

    public static List<DungeonRuntimeAction> describe(
            DungeonLayout layout,
            Corridor corridor,
            CardinalDirection heading,
            CellCoord activeCell,
            int activeLevelZ
    ) {
        if (layout == null || corridor == null || corridor.corridorId() == null) {
            return List.of();
        }
        ArrayList<DungeonRuntimeAction> actions = new ArrayList<>();
        actions.addAll(describeDoors(layout, corridor, heading));
        actions.addAll(describeStairs(layout, corridor, activeCell, activeLevelZ));
        actions.addAll(describeTransitions(layout, corridor, activeCell, activeLevelZ));
        return List.copyOf(actions);
    }

    public static List<DungeonRuntimeAction> describe(
            DungeonLayout layout,
            DungeonStair stair,
            CellCoord activeCell,
            int activeLevelZ
    ) {
        if (layout == null || stair == null || stair.stairId() == null) {
            return List.of();
        }
        ArrayList<DungeonRuntimeAction> actions = new ArrayList<>();
        actions.addAll(describeStairsAtCells(
                layout,
                stair.occupiedPositions().stream()
                        .filter(position -> position != null && position.z() == activeLevelZ)
                        .map(position -> position.projectedCell())
                        .collect(Collectors.toSet()),
                activeLevelZ,
                activeCell,
                activeLevelZ));
        actions.addAll(describeTransitionsAtCell(layout, activeCell, activeLevelZ));
        return List.copyOf(actions);
    }

    public static List<DungeonRuntimeAction> describe(
            DungeonLayout layout,
            DungeonTransition transition,
            CellCoord activeCell,
            int activeLevelZ
    ) {
        if (layout == null || transition == null || transition.transitionId() == null) {
            return List.of();
        }
        return List.copyOf(describeTransitionsAtCell(layout, activeCell, activeLevelZ));
    }

    private static List<DungeonRuntimeDoorDescriptor> describeDoors(
            DungeonLayout layout,
            Room room,
            CardinalDirection heading
    ) {
        return RoomExitCatalog.describe(layout, room).stream()
                .map(exit -> toDoorDescriptor(layout, room, exit, heading))
                .toList();
    }

    private static List<DungeonRuntimeDoorDescriptor> describeDoors(
            DungeonLayout layout,
            Corridor corridor,
            CardinalDirection heading
    ) {
        return describeDoors(
                corridor.structure().cellCoordsAtLevel(corridor.levelZ()),
                corridor.levelZ(),
                layout.connectionsForCorridor(corridor.corridorId()),
                heading,
                (cell, direction) -> "",
                exit -> doorContext(layout, layout.connectionAt(exit.levelZ(), exit.anchorSegment2x()),
                        ConnectionEndpoint.corridor(corridor.corridorId())));
    }

    private static List<DungeonRuntimeDoorDescriptor> describeDoors(
            Set<CellCoord> cells,
            int levelZ,
            List<? extends Connection> connections,
            CardinalDirection heading,
            BiFunction<CellCoord, CardinalDirection, String> narrationLookup,
            Function<RoomExitDescriptor, DoorContext> contextLookup
    ) {
        return DoorExitCatalog.describe(cells, levelZ, connections).stream()
                .map(exit -> {
                    DoorContext context = contextLookup.apply(exit);
                    return DungeonRuntimeDoorDescriptor.from(
                            exit,
                            heading,
                            context.activeEndpoint(),
                            context.destinationEndpoint(),
                            context.destinationLabel(),
                            narrationLookup.apply(exit.roomCell(), exit.direction()));
                })
                .toList();
    }

    private static DungeonRuntimeDoorDescriptor toDoorDescriptor(
            DungeonLayout layout,
            Room room,
            RoomExitDescriptor exit,
            CardinalDirection heading
    ) {
        String narration = room.narration().exitDescription(exit.levelZ(), exit.roomCell(), exit.direction());
        DoorContext context = doorContext(layout, layout.connectionAt(exit.levelZ(), exit.anchorSegment2x()),
                ConnectionEndpoint.room(room.roomId()));
        return DungeonRuntimeDoorDescriptor.from(
                exit,
                heading,
                context.activeEndpoint(),
                context.destinationEndpoint(),
                context.destinationLabel(),
                narration);
    }

    private static DoorContext doorContext(
            DungeonLayout layout,
            Connection connection,
            ConnectionEndpoint activeEndpoint
    ) {
        if (layout == null || connection == null) {
            return new DoorContext(activeEndpoint, null, "");
        }
        ConnectionEndpoint destination = activeEndpoint == null ? null : connection.oppositeOf(activeEndpoint);
        return new DoorContext(activeEndpoint, destination, endpointLabel(layout, destination, activeEndpoint));
    }

    private static String endpointLabel(
            DungeonLayout layout,
            ConnectionEndpoint destination,
            ConnectionEndpoint activeEndpoint
    ) {
        if (layout == null || destination == null) {
            return "";
        }
        if (destination.type() == ConnectionEndpointType.ROOM && destination.id() != null) {
            return DungeonRuntimeLabels.roomLabel(layout, destination.id());
        }
        if (destination.type() == ConnectionEndpointType.CORRIDOR && destination.id() != null) {
            Corridor corridor = layout.findCorridor(destination.id());
            if (corridor == null) {
                return "";
            }
            return corridor.connectedRoomIds().stream()
                    .filter(roomId -> roomId != null && (activeEndpoint == null || !roomId.equals(activeEndpoint.id())))
                    .map(roomId -> DungeonRuntimeLabels.roomLabel(layout, roomId))
                    .filter(label -> label != null && !label.isBlank())
                    .distinct()
                    .reduce((left, right) -> left + ", " + right)
                    .orElse("");
        }
        if (destination.type() == ConnectionEndpointType.CLUSTER && destination.id() != null) {
            return "Raumverbund " + destination.id();
        }
        if (destination.type() == ConnectionEndpointType.STAIR && destination.id() != null) {
            var stair = layout.findStair(destination.id());
            return stair == null ? "Treppe" : stair.label();
        }
        if (destination.type() == ConnectionEndpointType.TRANSITION && destination.id() != null) {
            var transition = layout.findTransition(destination.id());
            return transition == null ? "Übergang" : transition.label();
        }
        return "";
    }

    private static List<DungeonRuntimeStairDescriptor> describeStairs(
            DungeonLayout layout,
            Room room,
            CellCoord activeCell,
            int activeLevelZ
    ) {
        return room.structure().relevantLevels(activeCell, activeLevelZ).stream()
                .flatMap(levelZ -> describeStairs(layout, room.structure().cellCoordsAtLevel(levelZ), levelZ, activeCell, activeLevelZ)
                        .stream())
                .toList();
    }

    private static List<DungeonRuntimeStairDescriptor> describeStairs(
            DungeonLayout layout,
            Corridor corridor,
            CellCoord activeCell,
            int activeLevelZ
    ) {
        return describeStairs(layout, corridor.structure().cellCoordsAtLevel(corridor.levelZ()), corridor.levelZ(), activeCell,
                activeLevelZ);
    }

    private static List<DungeonRuntimeStairDescriptor> describeStairsAtCells(
            DungeonLayout layout,
            Set<CellCoord> surfaceCells,
            int levelZ,
            CellCoord activeCell,
            int activeLevelZ
    ) {
        return describeStairs(layout, surfaceCells, levelZ, activeCell, activeLevelZ);
    }

    private static List<DungeonRuntimeStairDescriptor> describeStairs(
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
                .map(stair -> toStairDescriptors(stair, levelZ, resolvedCells, activeCell, activeLevelZ))
                .flatMap(List::stream)
                .toList();
    }

    private static List<DungeonRuntimeStairDescriptor> toStairDescriptors(
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
                        stairDestinationLabel(exit),
                        stairDescription(stair, exit),
                        DungeonRuntimeLocation.stairExit(stair.stairId(), exit.position().projectedCell(), exit.position().z())))
                .toList();
    }

    private static String stairDestinationLabel(DungeonStairExit exit) {
        if (exit == null) {
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

    private static List<DungeonRuntimeTransitionDescriptor> describeTransitions(
            DungeonLayout layout,
            Room room,
            CellCoord activeCell,
            int activeLevelZ
    ) {
        return room.structure().relevantLevels(activeCell, activeLevelZ).stream()
                .flatMap(levelZ -> describeTransitions(layout, room.structure().cellCoordsAtLevel(levelZ), levelZ).stream())
                .toList();
    }

    private static List<DungeonRuntimeTransitionDescriptor> describeTransitions(
            DungeonLayout layout,
            Corridor corridor,
            CellCoord activeCell,
            int activeLevelZ
    ) {
        return describeTransitions(layout, corridor.structure().cellCoordsAtLevel(corridor.levelZ()), corridor.levelZ());
    }

    private static List<DungeonRuntimeTransitionDescriptor> describeTransitionsAtCell(
            DungeonLayout layout,
            CellCoord cell,
            int levelZ
    ) {
        if (layout == null || cell == null) {
            return List.of();
        }
        return layout.transitionsAtCell(cell, levelZ).stream()
                .filter(transition -> transition != null && transition.transitionId() != null)
                .sorted(Comparator.comparing(DungeonTransition::transitionId))
                .map(transition -> new DungeonRuntimeTransitionDescriptor(
                        transition.transitionId(),
                        transition.label(),
                        transitionDestinationLabel(transition.destination()),
                        transitionDescription(transition)))
                .toList();
    }

    private static List<DungeonRuntimeTransitionDescriptor> describeTransitions(
            DungeonLayout layout,
            Set<CellCoord> cells,
            int levelZ
    ) {
        if (layout == null || cells == null || cells.isEmpty()) {
            return List.of();
        }
        return layout.transitionsAtLevel(levelZ).stream()
                .filter(transition -> transition.anchor() != null && cells.contains(transition.anchor().projectedCell()))
                .sorted(Comparator.comparing(DungeonTransition::transitionId))
                .map(transition -> new DungeonRuntimeTransitionDescriptor(
                        transition.transitionId(),
                        transition.label(),
                        transitionDestinationLabel(transition.destination()),
                        transitionDescription(transition)))
                .toList();
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

    private record DoorContext(
            ConnectionEndpoint activeEndpoint,
            ConnectionEndpoint destinationEndpoint,
            String destinationLabel
    ) {
    }
}
