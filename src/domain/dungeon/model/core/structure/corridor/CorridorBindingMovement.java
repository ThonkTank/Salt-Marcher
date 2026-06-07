package src.domain.dungeon.model.core.structure.corridor;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import src.domain.dungeon.model.core.component.CorridorWaypoint;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;
import src.domain.dungeon.model.core.structure.DungeonMap;
import src.domain.dungeon.model.core.structure.stair.StairCollection;

/**
 * Owns authored movement of corridor door, anchor, and waypoint bindings.
 */
public final class CorridorBindingMovement {
    private static final CorridorConnectionNormalization CONNECTION_NORMALIZATION =
            new CorridorConnectionNormalization();

    public DungeonMap moveDoorBinding(
            DungeonMap dungeonMap,
            long corridorId,
            int bindingIndex,
            long roomId,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        Objects.requireNonNull(dungeonMap, "dungeonMap");
        if (stationary(deltaQ, deltaR, deltaLevel)) {
            return dungeonMap;
        }
        List<Corridor> movedCorridors = new ArrayList<>();
        boolean changed = false;
        for (Corridor corridor : dungeonMap.corridors()) {
            if (corridor.corridorId() != corridorId) {
                movedCorridors.add(corridor);
                continue;
            }
            changed = addDoorMovedCorridor(movedCorridors, corridor, bindingIndex, roomId, deltaQ, deltaR, deltaLevel)
                    || changed;
        }
        return changed ? copyWithConnections(dungeonMap, movedCorridors, dungeonMap.stairs()) : dungeonMap;
    }

    public DungeonMap moveAnchorBinding(
            DungeonMap dungeonMap,
            long corridorId,
            int bindingIndex,
            DungeonTopologyRef topologyRef,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        Objects.requireNonNull(dungeonMap, "dungeonMap");
        if (stationary(deltaQ, deltaR, deltaLevel)) {
            return dungeonMap;
        }
        DungeonTopologyRef safeTopologyRef = topologyRef == null ? DungeonTopologyRef.empty() : topologyRef;
        List<Corridor> movedCorridors = new ArrayList<>();
        boolean changed = false;
        for (Corridor corridor : dungeonMap.corridors()) {
            if (corridor.corridorId() != corridorId) {
                movedCorridors.add(corridor);
                continue;
            }
            changed = addAnchorMovedCorridor(
                    movedCorridors,
                    corridor,
                    bindingIndex,
                    safeTopologyRef,
                    deltaQ,
                    deltaR,
                    deltaLevel) || changed;
        }
        return changed ? copyWithConnections(dungeonMap, movedCorridors, dungeonMap.stairs()) : dungeonMap;
    }

    public DungeonMap moveWaypoint(
            DungeonMap dungeonMap,
            long corridorId,
            int waypointIndex,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        Objects.requireNonNull(dungeonMap, "dungeonMap");
        if (stationary(deltaQ, deltaR, deltaLevel)) {
            return dungeonMap;
        }
        List<Corridor> movedCorridors = new ArrayList<>();
        boolean changed = false;
        for (Corridor corridor : dungeonMap.corridors()) {
            if (corridor.corridorId() != corridorId) {
                movedCorridors.add(corridor);
                continue;
            }
            changed = addWaypointMovedCorridor(
                    movedCorridors,
                    corridor,
                    waypointIndex,
                    deltaQ,
                    deltaR,
                    deltaLevel) || changed;
        }
        return changed ? copyWithConnections(dungeonMap, movedCorridors, dungeonMap.stairs()) : dungeonMap;
    }

    private static boolean addDoorMovedCorridor(
            List<Corridor> movedCorridors,
            Corridor corridor,
            int bindingIndex,
            long roomId,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        List<CorridorDoorBindingState> bindings = new ArrayList<>();
        boolean changed = false;
        for (int index = 0; index < corridor.stateBindings().doorBindings().size(); index++) {
            CorridorDoorBindingState binding = corridor.stateBindings().doorBindings().get(index);
            if (index == bindingIndex && binding.roomId() == roomId) {
                bindings.add(new CorridorDoorBindingState(
                        binding.roomId(),
                        binding.clusterId(),
                        movedCell(binding.relativeCell(), deltaQ, deltaR, deltaLevel),
                        binding.direction(),
                        binding.topologyRef()));
                changed = true;
            } else {
                bindings.add(binding);
            }
        }
        movedCorridors.add(new Corridor(
                corridor.corridorId(),
                corridor.mapId(),
                corridor.level(),
                corridor.roomIds(),
                new CorridorBindingState(
                        corridor.stateBindings().waypoints(),
                        bindings,
                        corridor.stateBindings().anchorBindings(),
                        corridor.stateBindings().anchorRefs())));
        return changed;
    }

    private static boolean addAnchorMovedCorridor(
            List<Corridor> movedCorridors,
            Corridor corridor,
            int bindingIndex,
            DungeonTopologyRef topologyRef,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        List<CorridorAnchorBinding> anchors = new ArrayList<>();
        boolean changed = false;
        for (int index = 0; index < corridor.stateBindings().anchorBindings().size(); index++) {
            CorridorAnchorBinding anchor = corridor.stateBindings().anchorBindings().get(index);
            if (index == bindingIndex || anchor.topologyRef().equals(topologyRef)) {
                anchors.add(anchor.withAbsoluteCell(movedCell(anchor.absoluteCell(), deltaQ, deltaR, deltaLevel)));
                changed = true;
            } else {
                anchors.add(anchor);
            }
        }
        movedCorridors.add(corridor.withStateBindings(corridor.stateBindings().replaceAnchorBindings(anchors)));
        return changed;
    }

    private static boolean addWaypointMovedCorridor(
            List<Corridor> movedCorridors,
            Corridor corridor,
            int waypointIndex,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        List<CorridorWaypoint> waypoints = new ArrayList<>();
        boolean changed = false;
        for (int index = 0; index < corridor.stateBindings().waypoints().size(); index++) {
            CorridorWaypoint waypoint = corridor.stateBindings().waypoints().get(index);
            if (index == waypointIndex) {
                Cell moved = movedCell(waypoint.relativeCell(), deltaQ, deltaR, deltaLevel);
                waypoints.add(new CorridorWaypoint(waypoint.clusterId(), moved, waypoint.level() + deltaLevel));
                changed = true;
            } else {
                waypoints.add(waypoint);
            }
        }
        movedCorridors.add(new Corridor(
                corridor.corridorId(),
                corridor.mapId(),
                corridor.level(),
                corridor.roomIds(),
                new CorridorBindingState(
                        waypoints,
                        corridor.stateBindings().doorBindings(),
                        corridor.stateBindings().anchorBindings(),
                        corridor.stateBindings().anchorRefs())));
        return changed;
    }

    private DungeonMap copyWithConnections(
            DungeonMap dungeonMap,
            List<Corridor> nextCorridors,
            StairCollection nextStairs
    ) {
        return CONNECTION_NORMALIZATION.copyWithConnections(
                dungeonMap,
                nextCorridors,
                nextStairs,
                dungeonMap.transitionCatalog());
    }

    private static Cell movedCell(Cell cell, int deltaQ, int deltaR, int deltaLevel) {
        Cell safeCell = cell == null ? new Cell(0, 0, 0) : cell;
        return new Cell(safeCell.q() + deltaQ, safeCell.r() + deltaR, safeCell.level() + deltaLevel);
    }

    private static boolean stationary(int deltaQ, int deltaR, int deltaLevel) {
        return deltaQ == 0 && deltaR == 0 && deltaLevel == 0;
    }
}
