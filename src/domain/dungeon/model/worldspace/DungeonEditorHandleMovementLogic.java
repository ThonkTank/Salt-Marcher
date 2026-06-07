package src.domain.dungeon.model.worldspace;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import src.domain.dungeon.model.core.component.CorridorWaypoint;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.structure.DungeonMap;
import src.domain.dungeon.model.core.structure.corridor.Corridor;
import src.domain.dungeon.model.core.structure.corridor.CorridorAnchorBinding;
import src.domain.dungeon.model.core.structure.corridor.CorridorBindingState;
import src.domain.dungeon.model.core.structure.corridor.CorridorDoorBindingState;
import src.domain.dungeon.model.core.structure.room.RoomClusterCornerMovement;
import src.domain.dungeon.model.core.structure.room.RoomTopologyRebuilder.RebuildResult;
import src.domain.dungeon.model.core.structure.stair.Stair;
import src.domain.dungeon.model.core.structure.stair.StairCollection;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorHandleMovement;

/**
 * Owns editor-handle movement while the aggregate remains the public entrypoint.
 */
public final class DungeonEditorHandleMovementLogic {

    private static final DungeonCorridorConnectionNormalizationLogic CONNECTION_NORMALIZATION =
            new DungeonCorridorConnectionNormalizationLogic();
    private static final DungeonTopologyMovementLogic TOPOLOGY_MOVEMENT = new DungeonTopologyMovementLogic();
    private static final RoomClusterCornerMovement CLUSTER_CORNER_MOVEMENT =
            new RoomClusterCornerMovement();

    public DungeonMap moveEditorHandle(
            DungeonMap dungeonMap,
            DungeonEditorHandleMovement handle,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        Objects.requireNonNull(dungeonMap, "dungeonMap");
        if (handle == null || isStationary(deltaQ, deltaR, deltaLevel)) {
            return dungeonMap;
        }
        if (handle.kind().isUnknown()) {
            return dungeonMap;
        }
        if (roomHandle(handle)) {
            return moveRoomHandle(dungeonMap, handle, deltaQ, deltaR, deltaLevel);
        }
        if (handle.kind().isDoor()) {
            return moveDoorBinding(dungeonMap, handle, deltaQ, deltaR, deltaLevel);
        }
        if (handle.kind().isCorridorAnchor()) {
            return moveCorridorAnchor(dungeonMap, handle, deltaQ, deltaR, deltaLevel);
        }
        if (handle.kind().isCorridorWaypoint()) {
            return moveCorridorWaypoint(dungeonMap, handle, deltaQ, deltaR, deltaLevel);
        }
        if (handle.kind().isStairAnchor()) {
            return moveStairAnchor(dungeonMap, handle, deltaQ, deltaR, deltaLevel);
        }
        return dungeonMap;
    }

    private static boolean roomHandle(DungeonEditorHandleMovement handle) {
        return handle.kind().isClusterLabel()
                || handle.kind().isClusterCorner();
    }

    private static DungeonMap moveRoomHandle(
            DungeonMap dungeonMap,
            DungeonEditorHandleMovement handle,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        if (handle.kind().isClusterCorner()) {
            Optional<RebuildResult> rebuild = CLUSTER_CORNER_MOVEMENT.moveCorner(
                    dungeonMap.topology(),
                    dungeonMap.rooms(),
                    dungeonMap.corridors(),
                    clusterId(dungeonMap, handle),
                    handle.cell(),
                    deltaQ,
                    deltaR,
                    deltaLevel);
            return rebuild.map(result -> DungeonRoomTopologyEditor.withRoomTopology(dungeonMap, result)).orElse(dungeonMap);
        }
        long clusterId = handle.clusterId() > 0L
                ? handle.clusterId()
                : dungeonMap.topologyIndex().clusterIdOrZero(handle.topologyRef());
        return TOPOLOGY_MOVEMENT.moveCluster(dungeonMap, clusterId, deltaQ, deltaR, deltaLevel);
    }

    private static long clusterId(DungeonMap dungeonMap, DungeonEditorHandleMovement handle) {
        return handle.clusterId() > 0L
                ? handle.clusterId()
                : dungeonMap.topologyIndex().clusterIdOrZero(handle.topologyRef());
    }

    private static DungeonMap moveDoorBinding(
            DungeonMap dungeonMap,
            DungeonEditorHandleMovement handle,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        List<Corridor> movedCorridors = new ArrayList<>();
        boolean changed = false;
        for (Corridor corridor : dungeonMap.corridors()) {
            if (corridor.corridorId() != handle.corridorId()) {
                movedCorridors.add(corridor);
                continue;
            }
            List<CorridorDoorBindingState> bindings = new ArrayList<>();
            for (int index = 0; index < corridor.stateBindings().doorBindings().size(); index++) {
                CorridorDoorBindingState binding = corridor.stateBindings().doorBindings().get(index);
                if (index == handle.index() && binding.roomId() == handle.roomId()) {
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
        }
        return changed
                ? copyWithConnections(
                        dungeonMap,
                        movedCorridors,
                        dungeonMap.stairs())
                : dungeonMap;
    }

    private static DungeonMap moveCorridorAnchor(
            DungeonMap dungeonMap,
            DungeonEditorHandleMovement handle,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        List<Corridor> movedCorridors = new ArrayList<>();
        boolean changed = false;
        for (Corridor corridor : dungeonMap.corridors()) {
            if (corridor.corridorId() != handle.corridorId()) {
                movedCorridors.add(corridor);
                continue;
            }
            List<CorridorAnchorBinding> anchors = new ArrayList<>();
            for (int index = 0; index < corridor.stateBindings().anchorBindings().size(); index++) {
                CorridorAnchorBinding anchor = corridor.stateBindings().anchorBindings().get(index);
                if (index == handle.index() || anchor.topologyRef().equals(handle.topologyRef())) {
                    anchors.add(anchor.withAbsoluteCell(movedCell(anchor.absoluteCell(), deltaQ, deltaR, deltaLevel)));
                    changed = true;
                } else {
                    anchors.add(anchor);
                }
            }
            movedCorridors.add(corridor.withStateBindings(corridor.stateBindings().replaceAnchorBindings(anchors)));
        }
        return changed
                ? copyWithConnections(
                        dungeonMap,
                        movedCorridors,
                        dungeonMap.stairs())
                : dungeonMap;
    }

    private static DungeonMap moveCorridorWaypoint(
            DungeonMap dungeonMap,
            DungeonEditorHandleMovement handle,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        List<Corridor> movedCorridors = new ArrayList<>();
        boolean changed = false;
        for (Corridor corridor : dungeonMap.corridors()) {
            if (corridor.corridorId() != handle.corridorId()) {
                movedCorridors.add(corridor);
                continue;
            }
            List<CorridorWaypoint> waypoints = new ArrayList<>();
            for (int index = 0; index < corridor.stateBindings().waypoints().size(); index++) {
                CorridorWaypoint waypoint = corridor.stateBindings().waypoints().get(index);
                if (index == handle.index()) {
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
        }
        return changed
                ? copyWithConnections(
                        dungeonMap,
                        movedCorridors,
                        dungeonMap.stairs())
                : dungeonMap;
    }

    private static DungeonMap moveStairAnchor(
            DungeonMap dungeonMap,
            DungeonEditorHandleMovement handle,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        List<Stair> movedStairs = new ArrayList<>();
        boolean changed = false;
        for (Stair stair : dungeonMap.stairs().stairs()) {
            if (stair.stairId() != handle.ownerId()) {
                movedStairs.add(stair);
                continue;
            }
            Stair movedStair = stair.withMovedHandle(handle.index(), deltaQ, deltaR, deltaLevel);
            changed = changed || !movedStair.equals(stair);
            movedStairs.add(movedStair);
        }
        return changed
                ? copyWithConnections(
                        dungeonMap,
                        dungeonMap.corridors(),
                        new StairCollection(movedStairs))
                : dungeonMap;
    }

    private static DungeonMap copyWithConnections(
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

    private static boolean isStationary(int deltaQ, int deltaR, int deltaLevel) {
        return deltaQ == 0 && deltaR == 0 && deltaLevel == 0;
    }
}
