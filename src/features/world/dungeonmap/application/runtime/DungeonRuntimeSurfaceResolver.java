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
import ui.shell.DetailsNavigator;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.function.BiFunction;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Runtime surfaces should read from the same direct owners that the rest of the feature uses.
 *
 * <p>If the runtime needs extra meaning, add it at the owner seam instead of inventing a runtime-only structure
 * hierarchy here.
 */
public final class DungeonRuntimeSurfaceResolver {

    private DungeonRuntimeSurfaceResolver() {
        throw new AssertionError("No instances");
    }

    public static DungeonRuntimeSurface resolve(
            DungeonLayout layout,
            CellCoord activeCell,
            int activeLevelZ,
            CardinalDirection heading
    ) {
        if (layout == null || activeCell == null) {
            return null;
        }
        DungeonLayout.CellStructure structure = layout.structureAtCell(activeCell, activeLevelZ);
        if (structure instanceof DungeonLayout.CellStructure.RoomStructure roomStructure) {
            return roomSurface(layout, roomStructure.room(), heading, activeCell, activeLevelZ);
        }
        if (structure instanceof DungeonLayout.CellStructure.CorridorStructure corridorStructure) {
            return corridorSurface(layout, corridorStructure.corridor(), heading, activeCell, activeLevelZ);
        }
        if (structure instanceof DungeonLayout.CellStructure.StairStructure stairStructure) {
            return stairOnlySurface(layout, stairStructure.stair(), activeCell, activeLevelZ);
        }
        if (structure instanceof DungeonLayout.CellStructure.TransitionStructure transitionStructure) {
            return transitionOnlySurface(transitionStructure.transition());
        }
        return null;
    }

    private static DungeonRuntimeSurface roomSurface(
            DungeonLayout layout,
            Room room,
            CardinalDirection heading,
            CellCoord activeCell,
            int activeLevelZ
    ) {
        if (room == null || room.roomId() == null) {
            return null;
        }
        List<DoorBundle> doors = describeDoors(layout, room, heading);
        List<DungeonRuntimeAction> actions = new ArrayList<>();
        actions.addAll(doorActions(doors));
        actions.addAll(describeStairs(layout, room, activeCell, activeLevelZ));
        actions.addAll(describeTransitions(layout, room, activeCell, activeLevelZ));
        return new DungeonRuntimeSurface(
                DungeonRuntimeLabels.roomLabel(room),
                new DetailsNavigator.EntryKey("dungeon-room", layout.mapId() + ":" + room.roomId()),
                room.narration().visualDescription(),
                doorInfos(doors),
                List.copyOf(actions));
    }

    private static DungeonRuntimeSurface corridorSurface(
            DungeonLayout layout,
            Corridor corridor,
            CardinalDirection heading,
            CellCoord activeCell,
            int activeLevelZ
    ) {
        if (layout == null || corridor == null || corridor.corridorId() == null) {
            return null;
        }
        List<DoorBundle> doors = describeDoors(layout, corridor, heading);
        List<DungeonRuntimeAction> actions = new ArrayList<>();
        actions.addAll(doorActions(doors));
        actions.addAll(describeStairs(layout, corridor, activeCell, activeLevelZ));
        actions.addAll(describeTransitions(layout, corridor, activeCell, activeLevelZ));
        return new DungeonRuntimeSurface(
                DungeonRuntimeLabels.corridorLabel(layout, corridor),
                new DetailsNavigator.EntryKey("dungeon-corridor", layout.mapId() + ":" + corridor.corridorId()),
                "",
                doorInfos(doors),
                List.copyOf(actions));
    }

    private static DungeonRuntimeSurface stairOnlySurface(
            DungeonLayout layout,
            DungeonStair stair,
            CellCoord activeCell,
            int activeLevelZ
    ) {
        if (layout == null || stair == null || stair.stairId() == null) {
            return null;
        }
        ArrayList<DungeonRuntimeAction> actions = new ArrayList<>();
        actions.addAll(describeStair(stair, activeCell, activeLevelZ));
        actions.addAll(describeTransitionsAtCell(layout, activeCell, activeLevelZ));
        return new DungeonRuntimeSurface(
                stair.label(),
                new DetailsNavigator.EntryKey("dungeon-stair", layout.mapId() + ":" + stair.stairId()),
                "Eine Treppe verbindet mehrere erschlossene Höhenstufen.",
                List.of(),
                List.copyOf(actions));
    }

    private static DungeonRuntimeSurface transitionOnlySurface(DungeonTransition transition) {
        if (transition == null || transition.transitionId() == null) {
            return null;
        }
        return new DungeonRuntimeSurface(
                transition.label(),
                new DetailsNavigator.EntryKey("dungeon-transition", transition.mapId() + ":" + transition.transitionId()),
                transition.description().isBlank() ? transition.label() : transition.description(),
                List.of(),
                List.of(toTransitionAction(transition)));
    }

    private static List<DungeonRuntimeSurface.DoorInfo> doorInfos(List<DoorBundle> doors) {
        return doors.stream()
                .map(DoorBundle::doorInfo)
                .toList();
    }

    private static List<DungeonRuntimeAction> doorActions(List<DoorBundle> doors) {
        return doors.stream()
                .map(DoorBundle::action)
                .toList();
    }

    private static List<DoorBundle> describeDoors(
            DungeonLayout layout,
            Room room,
            CardinalDirection heading
    ) {
        return RoomExitCatalog.describe(layout, room).stream()
                .map(exit -> toDoorBundle(layout, room, exit, heading))
                .toList();
    }

    private static List<DoorBundle> describeDoors(
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
                exit -> doorContext(
                        layout,
                        layout.connectionAt(exit.levelZ(), exit.anchorSegment2x()),
                        ConnectionEndpoint.corridor(corridor.corridorId())));
    }

    private static List<DoorBundle> describeDoors(
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
                    return toDoorBundle(
                            exit,
                            heading,
                            context.destinationLabel(),
                            narrationLookup.apply(exit.roomCell(), exit.direction()));
                })
                .toList();
    }

    private static DoorBundle toDoorBundle(
            DungeonLayout layout,
            Room room,
            RoomExitDescriptor exit,
            CardinalDirection heading
    ) {
        String narration = room.narration().exitDescription(exit.levelZ(), exit.roomCell(), exit.direction());
        DoorContext context = doorContext(
                layout,
                layout.connectionAt(exit.levelZ(), exit.anchorSegment2x()),
                ConnectionEndpoint.room(room.roomId()));
        return toDoorBundle(exit, heading, context.destinationLabel(), narration);
    }

    private static DoorBundle toDoorBundle(
            RoomExitDescriptor exit,
            CardinalDirection heading,
            String destinationLabel,
            String narration
    ) {
        CardinalDirection resolvedHeading = heading == null ? CardinalDirection.defaultDirection() : heading;
        String relativeLabel = resolvedHeading.relativeLabel(exit.direction().delta());
        String resolvedNarration = narration == null ? "" : narration.trim();
        String description = relativeDescription(relativeLabel, resolvedNarration.isBlank() ? "eine Tür" : resolvedNarration);
        String resolvedDestination = destinationLabel == null ? "" : destinationLabel.trim();
        return new DoorBundle(
                new DungeonRuntimeSurface.DoorInfo(
                        exit.number(),
                        exit.anchorSegment2x(),
                        resolvedDestination,
                        description),
                new DungeonRuntimeAction(
                        doorActionLabel(exit.label(), resolvedDestination),
                        description,
                        "Verbindung konnte nicht benutzt werden",
                        new DungeonRuntimeAction.DoorTarget(
                                exit.levelZ(),
                                exit.anchorSegment2x(),
                                exit.outsideCell(),
                                exit.direction())));
    }

    private static DoorContext doorContext(
            DungeonLayout layout,
            Connection connection,
            ConnectionEndpoint activeEndpoint
    ) {
        if (layout == null || connection == null) {
            return new DoorContext("");
        }
        ConnectionEndpoint destination = activeEndpoint == null ? null : connection.oppositeOf(activeEndpoint);
        return new DoorContext(endpointLabel(layout, destination, activeEndpoint));
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
            DungeonStair stair = layout.findStair(destination.id());
            return stair == null ? "Treppe" : stair.label();
        }
        if (destination.type() == ConnectionEndpointType.TRANSITION && destination.id() != null) {
            DungeonTransition transition = layout.findTransition(destination.id());
            return transition == null ? "Übergang" : transition.label();
        }
        return "";
    }

    private static List<DungeonRuntimeAction> describeStairs(
            DungeonLayout layout,
            Room room,
            CellCoord activeCell,
            int activeLevelZ
    ) {
        return room.structure().relevantLevels(activeCell, activeLevelZ).stream()
                .flatMap(levelZ -> describeStairs(
                        layout,
                        room.structure().cellCoordsAtLevel(levelZ),
                        levelZ,
                        activeCell,
                        activeLevelZ).stream())
                .toList();
    }

    private static List<DungeonRuntimeAction> describeStairs(
            DungeonLayout layout,
            Corridor corridor,
            CellCoord activeCell,
            int activeLevelZ
    ) {
        return describeStairs(
                layout,
                corridor.structure().cellCoordsAtLevel(corridor.levelZ()),
                corridor.levelZ(),
                activeCell,
                activeLevelZ);
    }

    private static List<DungeonRuntimeAction> describeStair(
            DungeonStair stair,
            CellCoord activeCell,
            int activeLevelZ
    ) {
        if (stair == null) {
            return List.of();
        }
        Set<CubePoint> originPositions = stair.exits().stream()
                .map(DungeonStairExit::position)
                .filter(Objects::nonNull)
                .filter(position -> position.z() == activeLevelZ)
                .filter(position -> activeCell == null || activeCell.equals(position.projectedCell()))
                .collect(Collectors.toCollection(LinkedHashSet::new));
        if (originPositions.isEmpty()) {
            originPositions = stair.exits().stream()
                    .map(DungeonStairExit::position)
                    .filter(Objects::nonNull)
                    .filter(position -> position.z() == activeLevelZ)
                    .collect(Collectors.toCollection(LinkedHashSet::new));
        }
        if (originPositions.isEmpty()) {
            originPositions = stair.exits().stream()
                    .map(DungeonStairExit::position)
                    .filter(Objects::nonNull)
                    .limit(1)
                    .collect(Collectors.toCollection(LinkedHashSet::new));
        }
        return toStairActions(stair, originPositions, activeCell, activeLevelZ);
    }

    private static List<DungeonRuntimeAction> describeStairs(
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
                .map(stair -> toStairActions(stair, levelZ, resolvedCells, activeCell, activeLevelZ))
                .flatMap(List::stream)
                .toList();
    }

    private static List<DungeonRuntimeAction> toStairActions(
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
        return toStairActions(stair, originPositions, activeCell, activeLevelZ);
    }

    private static List<DungeonRuntimeAction> toStairActions(
            DungeonStair stair,
            Set<CubePoint> originPositions,
            CellCoord activeCell,
            int activeLevelZ
    ) {
        if (stair == null || originPositions == null || originPositions.isEmpty()) {
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
                .map(exit -> new DungeonRuntimeAction(
                        stairActionLabel(stair, exit),
                        stairDescription(stair, exit),
                        "Treppe konnte nicht benutzt werden",
                        new DungeonRuntimeAction.CellTarget(
                                exit.position().projectedCell(),
                                exit.position().z(),
                                null)))
                .toList();
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

    private static List<DungeonRuntimeAction> describeTransitions(
            DungeonLayout layout,
            Room room,
            CellCoord activeCell,
            int activeLevelZ
    ) {
        return room.structure().relevantLevels(activeCell, activeLevelZ).stream()
                .flatMap(levelZ -> describeTransitions(layout, room.structure().cellCoordsAtLevel(levelZ), levelZ).stream())
                .toList();
    }

    private static List<DungeonRuntimeAction> describeTransitions(
            DungeonLayout layout,
            Corridor corridor,
            CellCoord activeCell,
            int activeLevelZ
    ) {
        return describeTransitions(layout, corridor.structure().cellCoordsAtLevel(corridor.levelZ()), corridor.levelZ());
    }

    private static List<DungeonRuntimeAction> describeTransitionsAtCell(
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
                .map(DungeonRuntimeSurfaceResolver::toTransitionAction)
                .toList();
    }

    private static List<DungeonRuntimeAction> describeTransitions(
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
                .map(DungeonRuntimeSurfaceResolver::toTransitionAction)
                .toList();
    }

    private static DungeonRuntimeAction toTransitionAction(DungeonTransition transition) {
        return new DungeonRuntimeAction(
                transitionActionLabel(transition),
                transitionDescription(transition),
                "Übergang konnte nicht benutzt werden",
                new DungeonRuntimeAction.TransitionTarget(transition.transitionId()));
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

    private static String relativeDescription(String relativeLabel, String subject) {
        return relativeLabel + " ist " + subject;
    }

    private static String doorActionLabel(String label, String destinationLabel) {
        String resolvedLabel = label == null || label.isBlank() ? "Tür" : label.trim();
        return destinationLabel == null || destinationLabel.isBlank()
                ? resolvedLabel
                : resolvedLabel + ": " + destinationLabel;
    }

    private record DoorContext(String destinationLabel) {
    }

    private record DoorBundle(
            DungeonRuntimeSurface.DoorInfo doorInfo,
            DungeonRuntimeAction action
    ) {
    }
}
