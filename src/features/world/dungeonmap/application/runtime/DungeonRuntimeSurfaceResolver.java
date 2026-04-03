package features.world.dungeonmap.application.runtime;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.structures.connection.Connection;
import features.world.dungeonmap.model.structures.connection.DoorExitCatalog;
import features.world.dungeonmap.model.structures.connection.ConnectionEndpoint;
import features.world.dungeonmap.model.structures.connection.ConnectionEndpointType;
import features.world.dungeonmap.model.structures.connection.RoomExitDescriptor;
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
import java.util.Objects;
import java.util.Set;
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
            DungeonRuntimeNavigationSnapshot navigation
    ) {
        CellCoord activeCell = navigation == null ? null : navigation.cell();
        int activeLevelZ = navigation == null ? 0 : navigation.levelZ();
        CardinalDirection heading = navigation == null ? CardinalDirection.defaultDirection() : navigation.heading();
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
            return stairSurface(layout, stairStructure.stair(), activeCell, activeLevelZ);
        }
        if (structure instanceof DungeonLayout.CellStructure.TransitionStructure transitionStructure) {
            return transitionSurface(transitionStructure.transition());
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
        if (layout == null || room == null || room.roomId() == null) {
            return null;
        }
        ArrayList<DungeonRuntimeExit> exits = new ArrayList<>();
        ArrayList<DungeonRuntimeAction> actions = new ArrayList<>();
        appendRoomDoors(layout, room, heading, exits);
        for (int levelZ : room.structure().relevantLevels(activeCell, activeLevelZ)) {
            appendStructureStairs(layout, room.structure().cellCoordsAtLevel(levelZ), levelZ, activeCell, activeLevelZ, actions);
            appendStructureTransitions(layout, room.structure().cellCoordsAtLevel(levelZ), levelZ, actions);
        }
        return new DungeonRuntimeSurface(
                roomLabel(room),
                DungeonRuntimeSurfaceRef.room(layout.mapId(), room.roomId()),
                room.narration().visualDescription(),
                exits,
                actions);
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
        ArrayList<DungeonRuntimeExit> exits = new ArrayList<>();
        ArrayList<DungeonRuntimeAction> actions = new ArrayList<>();
        appendCorridorDoors(layout, corridor, heading, exits);
        appendStructureStairs(
                layout,
                corridor.structure().cellCoordsAtLevel(corridor.levelZ()),
                corridor.levelZ(),
                activeCell,
                activeLevelZ,
                actions);
        appendStructureTransitions(layout, corridor.structure().cellCoordsAtLevel(corridor.levelZ()), corridor.levelZ(), actions);
        return new DungeonRuntimeSurface(
                corridorLabel(layout, corridor),
                DungeonRuntimeSurfaceRef.corridor(layout.mapId(), corridor.corridorId()),
                "",
                exits,
                actions);
    }

    private static DungeonRuntimeSurface stairSurface(
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
        appendTransitionActionsAtCell(layout, activeCell, activeLevelZ, actions);
        return new DungeonRuntimeSurface(
                stair.label(),
                DungeonRuntimeSurfaceRef.stair(layout.mapId(), stair.stairId()),
                "Eine Treppe verbindet mehrere erschlossene Höhenstufen.",
                List.of(),
                actions);
    }

    private static DungeonRuntimeSurface transitionSurface(DungeonTransition transition) {
        if (transition == null || transition.transitionId() == null) {
            return null;
        }
        return new DungeonRuntimeSurface(
                transition.label(),
                DungeonRuntimeSurfaceRef.transition(transition.mapId(), transition.transitionId()),
                transition.description().isBlank() ? transition.label() : transition.description(),
                List.of(),
                List.of(transitionAction(transition)));
    }

    private static void appendRoomDoors(
            DungeonLayout layout,
            Room room,
            CardinalDirection heading,
            List<DungeonRuntimeExit> exits
    ) {
        for (RoomExitDescriptor exit : layout.describeRoomExits(room)) {
            String description = doorDescription(
                    heading,
                    exit.direction(),
                    room.narration().exitDescription(exit.levelZ(), exit.roomCell(), exit.direction()));
            String destinationLabel = doorDestinationLabel(
                    layout,
                    layout.connectionAt(exit.levelZ(), exit.anchorSegment2x()),
                    ConnectionEndpoint.room(room.roomId()));
            DungeonRuntimeAction action = new DungeonRuntimeAction(
                    doorActionLabel(exit.label(), destinationLabel),
                    "",
                    "Verbindung konnte nicht benutzt werden",
                    new DungeonRuntimeAction.DoorTarget(
                            exit.anchorSegment2x(),
                            new DungeonRuntimeAction.CellTarget(
                                    exit.outsideCell(),
                                    exit.levelZ(),
                                    exit.direction())));
            exits.add(new DungeonRuntimeExit(
                    exit.number(),
                    exit.anchorSegment2x(),
                    destinationLabel,
                    description,
                    action));
        }
    }

    private static void appendCorridorDoors(
            DungeonLayout layout,
            Corridor corridor,
            CardinalDirection heading,
            List<DungeonRuntimeExit> exits
    ) {
        for (RoomExitDescriptor exit : layout.describeCorridorExits(corridor)) {
            String description = doorDescription(heading, exit.direction(), "");
            String destinationLabel = doorDestinationLabel(
                    layout,
                    layout.connectionAt(exit.levelZ(), exit.anchorSegment2x()),
                    ConnectionEndpoint.corridor(corridor.corridorId()));
            DungeonRuntimeAction action = new DungeonRuntimeAction(
                    doorActionLabel(exit.label(), destinationLabel),
                    "",
                    "Verbindung konnte nicht benutzt werden",
                    new DungeonRuntimeAction.DoorTarget(
                            exit.anchorSegment2x(),
                            new DungeonRuntimeAction.CellTarget(
                                    exit.outsideCell(),
                                    exit.levelZ(),
                                    exit.direction())));
            exits.add(new DungeonRuntimeExit(
                    exit.number(),
                    exit.anchorSegment2x(),
                    destinationLabel,
                    description,
                    action));
        }
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
                .filter(transition -> transition.anchor() != null && cells.contains(transition.anchor().projectedCell()))
                .sorted(Comparator.comparing(DungeonTransition::transitionId))
                .map(DungeonRuntimeSurfaceResolver::transitionAction)
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
                .map(DungeonRuntimeSurfaceResolver::transitionAction)
                .forEach(actions::add);
    }

    private static DungeonRuntimeAction transitionAction(DungeonTransition transition) {
        return new DungeonRuntimeAction(
                transitionActionLabel(transition),
                transitionDescription(transition),
                "Übergang konnte nicht benutzt werden",
                new DungeonRuntimeAction.TransitionTarget(transition.transitionId()));
    }

    private static String doorDescription(
            CardinalDirection heading,
            CardinalDirection doorDirection,
            String narration
    ) {
        CardinalDirection resolvedHeading = heading == null ? CardinalDirection.defaultDirection() : heading;
        String relativeLabel = resolvedHeading.relativeLabel(doorDirection.delta());
        String resolvedNarration = narration == null || narration.isBlank() ? "eine Tür" : narration.trim();
        return relativeLabel + " ist " + resolvedNarration;
    }

    private static String doorDestinationLabel(
            DungeonLayout layout,
            Connection connection,
            ConnectionEndpoint activeEndpoint
    ) {
        if (layout == null || connection == null) {
            return "";
        }
        ConnectionEndpoint destination = connection.oppositeOf(activeEndpoint);
        if (destination == null) {
            return "";
        }
        if (destination.type() == ConnectionEndpointType.ROOM && destination.id() != null) {
            return roomLabel(layout, destination.id());
        }
        if (destination.type() == ConnectionEndpointType.CORRIDOR && destination.id() != null) {
            Corridor corridor = layout.findCorridor(destination.id());
            if (corridor == null) {
                return "";
            }
            return corridor.connectedRoomIds().stream()
                    .filter(roomId -> roomId != null && (activeEndpoint == null || !roomId.equals(activeEndpoint.id())))
                    .map(roomId -> roomLabel(layout, roomId))
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

    private static String doorActionLabel(String label, String destinationLabel) {
        String resolvedLabel = label == null || label.isBlank() ? "Tür" : label.trim();
        return destinationLabel == null || destinationLabel.isBlank()
                ? resolvedLabel
                : resolvedLabel + ": " + destinationLabel;
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

    private static String roomLabel(Room room) {
        if (room == null) {
            return "Raum";
        }
        return room.name() == null || room.name().isBlank() ? "Raum " + room.roomId() : room.name();
    }

    private static String roomLabel(DungeonLayout layout, Long roomId) {
        if (roomId == null) {
            return "Raum";
        }
        Room room = layout == null ? null : layout.findRoom(roomId);
        return room == null ? "Raum " + roomId : roomLabel(room);
    }

    private static String corridorLabel(DungeonLayout layout, Corridor corridor) {
        if (corridor == null) {
            return "Korridor";
        }
        String joinedRooms = corridor.connectedRoomIds().stream()
                .map(roomId -> roomLabel(layout, roomId))
                .distinct()
                .sorted(String::compareToIgnoreCase)
                .reduce((left, right) -> left + ", " + right)
                .orElse("Korridor");
        return "Korridor: " + joinedRooms;
    }
}
