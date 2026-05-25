package src.domain.dungeon.model.worldspace.model;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * Owns editor-handle movement while the aggregate remains the public entrypoint.
 */
public final class DungeonEditorHandleMovementLogic {

    private static final DungeonCorridorConnectionNormalizationLogic CONNECTION_NORMALIZATION_SERVICE =
            new DungeonCorridorConnectionNormalizationLogic();
    private static final DungeonTopologyMovementLogic TOPOLOGY_MOVEMENT_SERVICE = new DungeonTopologyMovementLogic();

    public DungeonMap moveEditorHandle(DungeonMap dungeonMap, DungeonEditorHandle handle, int deltaQ, int deltaR, int deltaLevel) {
        Objects.requireNonNull(dungeonMap, "dungeonMap");
        if (handle == null || isStationary(deltaQ, deltaR, deltaLevel)) {
            return dungeonMap;
        }
        if (handle.type() == DungeonEditorHandleType.CLUSTER_LABEL) {
            long clusterId = handle.clusterId() > 0L
                    ? handle.clusterId()
                    : dungeonMap.topologyIndex().clusterIdFor(handle.topologyRef()).orElse(0L);
            return TOPOLOGY_MOVEMENT_SERVICE.moveCluster(dungeonMap, clusterId, deltaQ, deltaR, deltaLevel);
        }
        if (handle.type() == DungeonEditorHandleType.DOOR) {
            return moveDoorBinding(dungeonMap, handle, deltaQ, deltaR, deltaLevel);
        }
        if (handle.type() == DungeonEditorHandleType.CORRIDOR_ANCHOR) {
            return moveCorridorAnchor(dungeonMap, handle, deltaQ, deltaR, deltaLevel);
        }
        if (handle.type() == DungeonEditorHandleType.CORRIDOR_WAYPOINT) {
            return moveCorridorWaypoint(dungeonMap, handle, deltaQ, deltaR, deltaLevel);
        }
        if (handle.type() == DungeonEditorHandleType.STAIR_ANCHOR) {
            return moveStairAnchor(dungeonMap, handle, deltaQ, deltaR, deltaLevel);
        }
        return dungeonMap;
    }

    private static DungeonMap moveDoorBinding(DungeonMap dungeonMap, DungeonEditorHandle handle, int deltaQ, int deltaR, int deltaLevel) {
        List<DungeonCorridor> movedCorridors = new ArrayList<>();
        boolean changed = false;
        for (DungeonCorridor corridor : dungeonMap.connections().corridors()) {
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
                new ConnectionCatalog(
                        movedCorridors,
                        dungeonMap.connections().stairs(),
                        dungeonMap.connections().transitions()))
                : dungeonMap;
    }

    private static DungeonMap moveCorridorAnchor(DungeonMap dungeonMap, DungeonEditorHandle handle, int deltaQ, int deltaR, int deltaLevel) {
        List<DungeonCorridor> movedCorridors = new ArrayList<>();
        boolean changed = false;
        for (DungeonCorridor corridor : dungeonMap.connections().corridors()) {
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
                new ConnectionCatalog(
                        movedCorridors,
                        dungeonMap.connections().stairs(),
                        dungeonMap.connections().transitions()))
                : dungeonMap;
    }

    private static DungeonMap moveCorridorWaypoint(DungeonMap dungeonMap, DungeonEditorHandle handle, int deltaQ, int deltaR, int deltaLevel) {
        List<DungeonCorridor> movedCorridors = new ArrayList<>();
        boolean changed = false;
        for (DungeonCorridor corridor : dungeonMap.connections().corridors()) {
            if (corridor.corridorId() != handle.corridorId()) {
                movedCorridors.add(corridor);
                continue;
            }
            List<DungeonCorridorWaypoint> waypoints = new ArrayList<>();
            for (int index = 0; index < corridor.bindings().waypoints().size(); index++) {
                DungeonCorridorWaypoint waypoint = corridor.bindings().waypoints().get(index);
                if (index == handle.index()) {
                    DungeonCell moved = movedCell(waypoint.relativeCell(), deltaQ, deltaR, deltaLevel);
                    waypoints.add(new DungeonCorridorWaypoint(waypoint.clusterId(), moved, waypoint.level() + deltaLevel));
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
                new ConnectionCatalog(
                        movedCorridors,
                        dungeonMap.connections().stairs(),
                        dungeonMap.connections().transitions()))
                : dungeonMap;
    }

    private static DungeonMap moveStairAnchor(DungeonMap dungeonMap, DungeonEditorHandle handle, int deltaQ, int deltaR, int deltaLevel) {
        List<DungeonStair> movedStairs = new ArrayList<>();
        boolean changed = false;
        for (DungeonStair stair : dungeonMap.connections().stairs()) {
            if (stair.stairId() != handle.ownerId()) {
                movedStairs.add(stair);
                continue;
            }
            int pathSize = stair.path().size();
            List<DungeonCell> path = new ArrayList<>(stair.path());
            List<DungeonStairExit> exits = new ArrayList<>(stair.exits());
            if (handle.index() < pathSize) {
                path.set(handle.index(), movedCell(path.get(handle.index()), deltaQ, deltaR, deltaLevel));
                changed = true;
            } else {
                int exitIndex = handle.index() - pathSize;
                if (validExitIndex(exitIndex, exits)) {
                    DungeonStairExit exit = exits.get(exitIndex);
                    exits.set(exitIndex, new DungeonStairExit(
                            exit.exitId(),
                            movedCell(exit.position(), deltaQ, deltaR, deltaLevel),
                            exit.label()));
                    changed = true;
                }
            }
            movedStairs.add(new DungeonStair(
                    stair.stairId(),
                    stair.mapId(),
                    stair.name(),
                    new DungeonStair.Geometry(
                            stair.shape(),
                            stair.direction(),
                            stair.dimension1(),
                            stair.dimension2(),
                            path,
                            exits,
                            stair.corridorId())));
        }
        return changed
                ? copyWithConnections(
                dungeonMap,
                new ConnectionCatalog(
                        dungeonMap.connections().corridors(),
                        movedStairs,
                        dungeonMap.connections().transitions()))
                : dungeonMap;
    }

    private static DungeonMap copyWithConnections(DungeonMap dungeonMap, ConnectionCatalog nextConnections) {
        return CONNECTION_NORMALIZATION_SERVICE.copyWithConnections(dungeonMap, nextConnections);
    }

    private static DungeonCell movedCell(DungeonCell cell, int deltaQ, int deltaR, int deltaLevel) {
        DungeonCell safeCell = cell == null ? new DungeonCell(0, 0, 0) : cell;
        return new DungeonCell(safeCell.q() + deltaQ, safeCell.r() + deltaR, safeCell.level() + deltaLevel);
    }

    private static boolean isStationary(int deltaQ, int deltaR, int deltaLevel) {
        return deltaQ == 0 && deltaR == 0 && deltaLevel == 0;
    }

    private static boolean validExitIndex(int exitIndex, List<DungeonStairExit> exits) {
        return exitIndex >= 0 && exitIndex < exits.size();
    }
}
