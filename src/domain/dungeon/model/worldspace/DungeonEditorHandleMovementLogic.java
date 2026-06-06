package src.domain.dungeon.model.worldspace;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import src.domain.dungeon.model.core.component.CorridorWaypoint;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.structure.stair.Stair;
import src.domain.dungeon.model.core.structure.stair.StairCollection;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorHandleMovement;

/**
 * Owns editor-handle movement while the aggregate remains the public entrypoint.
 */
public final class DungeonEditorHandleMovementLogic {

    private static final DungeonCorridorConnectionNormalizationLogic CONNECTION_NORMALIZATION_SERVICE =
            new DungeonCorridorConnectionNormalizationLogic();
    private static final DungeonTopologyMovementLogic TOPOLOGY_MOVEMENT_SERVICE = new DungeonTopologyMovementLogic();
    private static final DungeonClusterCornerMoveLogic CLUSTER_CORNER_MOVEMENT_SERVICE =
            new DungeonClusterCornerMoveLogic();

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
            return CLUSTER_CORNER_MOVEMENT_SERVICE.moveCorner(dungeonMap, handle, deltaQ, deltaR, deltaLevel);
        }
        long clusterId = handle.clusterId() > 0L
                ? handle.clusterId()
                : dungeonMap.topologyIndex().clusterIdOrZero(handle.topologyRef());
        return TOPOLOGY_MOVEMENT_SERVICE.moveCluster(dungeonMap, clusterId, deltaQ, deltaR, deltaLevel);
    }

    private static DungeonMap moveDoorBinding(
            DungeonMap dungeonMap,
            DungeonEditorHandleMovement handle,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        List<DungeonCorridor> movedCorridors = new ArrayList<>();
        boolean changed = false;
        for (DungeonCorridor corridor : dungeonMap.corridors()) {
            if (corridor.corridorId() != handle.corridorId()) {
                movedCorridors.add(corridor);
                continue;
            }
            List<DungeonCorridorDoorBinding> bindings = new ArrayList<>();
            for (int index = 0; index < corridor.bindings().doorBindings().size(); index++) {
                DungeonCorridorDoorBinding binding = corridor.bindings().doorBindings().get(index);
                if (index == handle.index() && binding.roomId() == handle.roomId()) {
                    bindings.add(new DungeonCorridorDoorBinding(
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
            movedCorridors.add(new DungeonCorridor(
                    corridor.corridorId(),
                    corridor.mapId(),
                    corridor.level(),
                    corridor.roomIds(),
                    new DungeonCorridorBindings(
                            corridor.bindings().waypoints(),
                            bindings,
                            corridor.bindings().anchorBindings(),
                            corridor.bindings().anchorRefs())));
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
        List<DungeonCorridor> movedCorridors = new ArrayList<>();
        boolean changed = false;
        for (DungeonCorridor corridor : dungeonMap.corridors()) {
            if (corridor.corridorId() != handle.corridorId()) {
                movedCorridors.add(corridor);
                continue;
            }
            List<DungeonCorridorAnchorBinding> anchors = new ArrayList<>();
            for (int index = 0; index < corridor.bindings().anchorBindings().size(); index++) {
                DungeonCorridorAnchorBinding anchor = corridor.bindings().anchorBindings().get(index);
                if (index == handle.index() || anchor.topologyRef().equals(handle.topologyRef())) {
                    anchors.add(anchor.withAbsoluteCell(movedCell(anchor.absoluteCell(), deltaQ, deltaR, deltaLevel)));
                    changed = true;
                } else {
                    anchors.add(anchor);
                }
            }
            movedCorridors.add(corridor.withBindings(corridor.bindings().replaceAnchorBindings(anchors)));
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
        List<DungeonCorridor> movedCorridors = new ArrayList<>();
        boolean changed = false;
        for (DungeonCorridor corridor : dungeonMap.corridors()) {
            if (corridor.corridorId() != handle.corridorId()) {
                movedCorridors.add(corridor);
                continue;
            }
            List<CorridorWaypoint> waypoints = new ArrayList<>();
            for (int index = 0; index < corridor.bindings().waypoints().size(); index++) {
                CorridorWaypoint waypoint = corridor.bindings().waypoints().get(index);
                if (index == handle.index()) {
                    Cell moved = movedCell(waypoint.relativeCell(), deltaQ, deltaR, deltaLevel);
                    waypoints.add(new CorridorWaypoint(waypoint.clusterId(), moved, waypoint.level() + deltaLevel));
                    changed = true;
                } else {
                    waypoints.add(waypoint);
                }
            }
            movedCorridors.add(new DungeonCorridor(
                    corridor.corridorId(),
                    corridor.mapId(),
                    corridor.level(),
                    corridor.roomIds(),
                    new DungeonCorridorBindings(
                            waypoints,
                            corridor.bindings().doorBindings(),
                            corridor.bindings().anchorBindings(),
                            corridor.bindings().anchorRefs())));
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
            List<DungeonCorridor> nextCorridors,
            StairCollection nextStairs
    ) {
        return CONNECTION_NORMALIZATION_SERVICE.copyWithConnections(
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
