package src.domain.dungeon.map.service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import src.domain.dungeon.map.aggregate.DungeonMap;
import src.domain.dungeon.map.entity.DungeonCorridor;
import src.domain.dungeon.map.entity.DungeonRoom;
import src.domain.dungeon.map.entity.DungeonRoomCluster;
import src.domain.dungeon.map.policy.DungeonCorridorAnchorPruningPolicy;
import src.domain.dungeon.map.value.ConnectionCatalog;
import src.domain.dungeon.map.value.DungeonCell;
import src.domain.dungeon.map.value.DungeonCorridorAnchorBinding;

/**
 * Owns normalized corridor-connection rebuilding for authored mutations.
 */
public final class DungeonCorridorConnectionNormalizationService {

    private static final DungeonCorridorAnchorPruningPolicy ANCHOR_PRUNING_POLICY = new DungeonCorridorAnchorPruningPolicy();

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
        DungeonCorridorReadProjector.Result projection = new DungeonCorridorReadProjector().project(
                corridors,
                clustersById,
                roomsById,
                roomCellsByRoom,
                0L,
                Map.of());
        Map<Long, List<DungeonCell>> result = new LinkedHashMap<>();
        projection.areas().stream()
                .filter(area -> area.isCorridor())
                .forEach(area -> result.put(area.id(), area.cells()));
        return Map.copyOf(result);
    }

    DungeonCell snapToHostCorridorCell(DungeonCell desired, List<DungeonCell> candidates) {
        if (desired == null || candidates == null || candidates.isEmpty()) {
            return desired == null ? new DungeonCell(0, 0, 0) : desired;
        }
        return candidates.stream()
                .min(Comparator
                        .comparingInt((DungeonCell candidate) -> manhattan(desired, candidate))
                        .thenComparingInt(DungeonCell::level)
                        .thenComparingInt(DungeonCell::r)
                        .thenComparingInt(DungeonCell::q))
                .orElse(desired);
    }

    private List<DungeonCorridor> snapOwnedAnchors(DungeonMap dungeonMap, List<DungeonCorridor> corridors) {
        Map<Long, List<DungeonCell>> cellsByCorridor = corridorCellsByCorridor(dungeonMap, corridors);
        List<DungeonCorridor> result = new ArrayList<>();
        for (DungeonCorridor corridor : corridors == null ? List.<DungeonCorridor>of() : corridors) {
            List<DungeonCorridorAnchorBinding> snapped = corridor.bindings().anchorBindings().stream()
                    .filter(Objects::nonNull)
                    .map(binding -> binding.withAbsoluteCell(
                            snapToHostCorridorCell(
                                    binding.absoluteCell(),
                                    cellsByCorridor.getOrDefault(binding.hostCorridorId(), List.of(binding.absoluteCell())))))
                    .toList();
            result.add(DungeonCorridorOps.withBindings(corridor, corridor.bindings().replaceAnchorBindings(snapped)));
        }
        return List.copyOf(result);
    }

    private static Map<Long, List<DungeonCell>> roomCellsByRoom(DungeonMap dungeonMap) {
        DungeonRoomCellProjector projector = new DungeonRoomCellProjector();
        Map<Long, List<DungeonCell>> result = new LinkedHashMap<>();
        for (DungeonRoomCluster cluster : dungeonMap.topology().roomClusters()) {
            List<DungeonRoom> clusterRooms = dungeonMap.rooms().rooms().stream()
                    .filter(room -> room.clusterId() == cluster.clusterId())
                    .toList();
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
}
