package src.domain.dungeon.model.map.model;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Owns normalized corridor-connection rebuilding for authored mutations.
 */
public final class DungeonCorridorConnectionNormalizationLogic {

    private static final DungeonCorridorAnchorPruningRules ANCHOR_PRUNING_POLICY = new DungeonCorridorAnchorPruningRules();

    public ConnectionCatalog normalizeConnections(DungeonMap dungeonMap, ConnectionCatalog source) {
        Objects.requireNonNull(dungeonMap, "dungeonMap");
        ConnectionCatalog safeSource = source == null ? ConnectionCatalog.empty() : source;
        List<DungeonCorridor> snappedCorridors = snapOwnedAnchors(dungeonMap, safeSource.corridors());
        List<DungeonCorridor> prunedCorridors = ANCHOR_PRUNING_POLICY.pruneDetachedAnchors(snappedCorridors);
        return new ConnectionCatalog(prunedCorridors, safeSource.stairs(), safeSource.transitions());
    }

    public DungeonMap copyWithConnections(DungeonMap dungeonMap, ConnectionCatalog nextConnections) {
        ConnectionCatalog normalized = normalizeConnections(dungeonMap, nextConnections);
        return new DungeonMap(
                dungeonMap.metadata(),
                dungeonMap.topology(),
                dungeonMap.topologyIndex(),
                dungeonMap.spaces(),
                dungeonMap.rooms(),
                normalized,
                dungeonMap.features(),
                dungeonMap.revision() + 1L);
    }

    Map<Long, List<DungeonCell>> corridorCellsByCorridor(DungeonMap dungeonMap, List<DungeonCorridor> corridors) {
        Map<Long, DungeonRoomCluster> clustersById = clustersById(dungeonMap);
        Map<Long, DungeonRoom> roomsById = roomsById(dungeonMap);
        Map<Long, List<DungeonCell>> roomCellsByRoom = roomCellsByRoom(dungeonMap);
        DungeonCorridorProjection projection = new DungeonCorridorReadProjection().project(
                corridors,
                clustersById,
                roomsById,
                roomCellsByRoom,
                0L,
                Map.of());
        Map<Long, List<DungeonCell>> result = new LinkedHashMap<>();
        for (DungeonAreaFacts area : projection.areas()) {
            if (area != null && area.isCorridor()) {
                result.put(area.id(), area.cells());
            }
        }
        return Map.copyOf(result);
    }

    DungeonCell snapToHostCorridorCell(DungeonCell desired, List<DungeonCell> candidates) {
        if (desired == null || candidates == null || candidates.isEmpty()) {
            return desired == null ? new DungeonCell(0, 0, 0) : desired;
        }
        DungeonCell result = desired;
        for (DungeonCell candidate : candidates) {
            if (candidate != null && betterSnapCandidate(candidate, result, desired)) {
                result = candidate;
            }
        }
        return result;
    }

    private List<DungeonCorridor> snapOwnedAnchors(DungeonMap dungeonMap, List<DungeonCorridor> corridors) {
        Map<Long, List<DungeonCell>> cellsByCorridor = corridorCellsByCorridor(dungeonMap, corridors);
        List<DungeonCorridor> result = new ArrayList<>();
        for (DungeonCorridor corridor : corridors == null ? List.<DungeonCorridor>of() : corridors) {
            List<DungeonCorridorAnchorBinding> snapped = new ArrayList<>();
            for (DungeonCorridorAnchorBinding binding : corridor.bindings().anchorBindings()) {
                if (binding != null) {
                    snapped.add(binding.withAbsoluteCell(
                            snapToHostCorridorCell(
                                    binding.absoluteCell(),
                                    cellsByCorridor.getOrDefault(binding.hostCorridorId(), List.of(binding.absoluteCell())))));
                }
            }
            result.add(DungeonCorridorOps.withBindings(corridor, corridor.bindings().replaceAnchorBindings(snapped)));
        }
        return List.copyOf(result);
    }

    private static Map<Long, List<DungeonCell>> roomCellsByRoom(DungeonMap dungeonMap) {
        DungeonRoomCellProjection projector = new DungeonRoomCellProjection();
        Map<Long, List<DungeonCell>> result = new LinkedHashMap<>();
        for (DungeonRoomCluster cluster : dungeonMap.topology().roomClusters()) {
            List<DungeonRoom> clusterRooms = new ArrayList<>();
            for (DungeonRoom room : dungeonMap.rooms().rooms()) {
                if (room != null && room.clusterId() == cluster.clusterId()) {
                    clusterRooms.add(room);
                }
            }
            result.putAll(projector.cellsByRoom(cluster, clusterRooms));
        }
        return Map.copyOf(result);
    }

    private static Map<Long, DungeonRoomCluster> clustersById(DungeonMap dungeonMap) {
        Map<Long, DungeonRoomCluster> result = new LinkedHashMap<>();
        for (DungeonRoomCluster cluster : dungeonMap.topology().roomClusters()) {
            result.put(cluster.clusterId(), cluster);
        }
        return Map.copyOf(result);
    }

    private static Map<Long, DungeonRoom> roomsById(DungeonMap dungeonMap) {
        Map<Long, DungeonRoom> result = new LinkedHashMap<>();
        for (DungeonRoom room : dungeonMap.rooms().rooms()) {
            result.put(room.roomId(), room);
        }
        return Map.copyOf(result);
    }

    private static int manhattan(DungeonCell left, DungeonCell right) {
        return Math.abs(left.q() - right.q())
                + Math.abs(left.r() - right.r())
                + Math.abs(left.level() - right.level());
    }

    private static boolean betterSnapCandidate(DungeonCell candidate, DungeonCell current, DungeonCell desired) {
        int distanceComparison = Integer.compare(manhattan(desired, candidate), manhattan(desired, current));
        if (distanceComparison != 0) {
            return distanceComparison < 0;
        }
        int levelComparison = Integer.compare(candidate.level(), current.level());
        if (levelComparison != 0) {
            return levelComparison < 0;
        }
        int rowComparison = Integer.compare(candidate.r(), current.r());
        if (rowComparison != 0) {
            return rowComparison < 0;
        }
        return candidate.q() < current.q();
    }
}
