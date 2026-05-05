package src.domain.dungeon.map.service;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.map.aggregate.DungeonMap;
import src.domain.dungeon.map.entity.DungeonCorridor;
import src.domain.dungeon.map.entity.DungeonRoom;
import src.domain.dungeon.map.entity.DungeonRoomCluster;
import src.domain.dungeon.map.entity.DungeonStair;
import src.domain.dungeon.map.policy.DungeonCorridorAnchorPruningPolicy;
import src.domain.dungeon.map.policy.DungeonCorridorSemanticsPolicy;
import src.domain.dungeon.map.value.ConnectionCatalog;
import src.domain.dungeon.map.value.DungeonCorridorBindings;
import src.domain.dungeon.map.value.DungeonCorridorDoorEndpoint;
import src.domain.dungeon.map.value.DungeonCorridorEndpoint;
import src.domain.dungeon.map.value.DungeonCorridorRoomEndpoint;

/**
 * Owns corridor mutation mechanics while the aggregate remains the public
 * mutation boundary.
 */
public final class DungeonCorridorMutationService {

    private static final DungeonCorridorConnectionNormalizationService CONNECTION_NORMALIZATION_SERVICE =
            new DungeonCorridorConnectionNormalizationService();
    private static final DungeonCorridorEndpointResolutionService ENDPOINT_RESOLUTION_SERVICE =
            new DungeonCorridorEndpointResolutionService();
    private static final DungeonCorridorAnchorPruningPolicy ANCHOR_PRUNING_POLICY =
            new DungeonCorridorAnchorPruningPolicy();
    private static final DungeonCorridorSemanticsPolicy CORRIDOR_SEMANTICS_POLICY =
            new DungeonCorridorSemanticsPolicy();

    public DungeonMap createCorridor(
            DungeonMap dungeonMap,
            DungeonCorridorEndpoint start,
            DungeonCorridorEndpoint end
    ) {
        Objects.requireNonNull(dungeonMap, "dungeonMap");
        if (!validCreateEndpoints(start, end) || sameClusterOnly(dungeonMap, start, end)) {
            return dungeonMap;
        }
        DungeonCorridorEndpointResolutionService.ResolvedEndpointResult startResolved =
                ENDPOINT_RESOLUTION_SERVICE.resolve(dungeonMap, start);
        if (startResolved == null) {
            return dungeonMap;
        }
        DungeonCorridorEndpointResolutionService.ResolvedEndpointResult endResolved =
                ENDPOINT_RESOLUTION_SERVICE.resolve(startResolved.map(), end);
        if (endResolved == null || CORRIDOR_SEMANTICS_POLICY.sameEndpoint(startResolved.endpoint(), endResolved.endpoint())) {
            return dungeonMap;
        }
        if (CORRIDOR_SEMANTICS_POLICY.matchingCorridorExists(
                endResolved.map().connections().corridors(),
                startResolved.endpoint(),
                endResolved.endpoint())) {
            return dungeonMap;
        }
        List<Long> roomIds = new ArrayList<>();
        Long startRoomId = startResolved.endpoint().roomId();
        if (hasPersistedRoomId(startRoomId)) {
            roomIds.add(startRoomId);
        }
        Long endRoomId = endResolved.endpoint().roomId();
        if (hasPersistedRoomId(endRoomId) && !roomIds.contains(endRoomId)) {
            roomIds.add(endRoomId);
        }
        DungeonCorridor corridor = new DungeonCorridor(
                nextCorridorId(endResolved.map()),
                endResolved.map().metadata().mapId().value(),
                start.level(),
                roomIds,
                DungeonCorridorBindings.empty());
        corridor = startResolved.endpoint().applyTo(corridor);
        corridor = endResolved.endpoint().applyTo(corridor);
        List<DungeonCorridor> nextCorridors = new ArrayList<>(endResolved.map().connections().corridors());
        nextCorridors.add(corridor);
        return CONNECTION_NORMALIZATION_SERVICE.copyWithConnections(
                endResolved.map(),
                new ConnectionCatalog(
                        List.copyOf(nextCorridors),
                        endResolved.map().connections().stairs(),
                        endResolved.map().connections().transitions()));
    }

    public DungeonMap extendCorridor(
            DungeonMap dungeonMap,
            long corridorId,
            DungeonCorridorRoomEndpoint endpoint
    ) {
        Objects.requireNonNull(dungeonMap, "dungeonMap");
        if (invalidCorridorId(corridorId) || endpoint == null || !endpoint.present()) {
            return dungeonMap;
        }
        List<DungeonCorridor> nextCorridors = new ArrayList<>();
        boolean changed = false;
        for (DungeonCorridor corridor : dungeonMap.connections().corridors()) {
            if (corridor.corridorId() != corridorId) {
                nextCorridors.add(corridor);
                continue;
            }
            if (corridor.level() != endpoint.roomCell().level()) {
                nextCorridors.add(corridor);
                continue;
            }
            DungeonCorridor updated = applyEndpointBinding(dungeonMap, corridor, endpoint);
            if (sameClusterOnly(dungeonMap, updated.roomIds()) || CORRIDOR_SEMANTICS_POLICY.equivalent(corridor, updated)) {
                nextCorridors.add(corridor);
                continue;
            }
            nextCorridors.add(updated);
            changed = true;
        }
        return changed
                ? CONNECTION_NORMALIZATION_SERVICE.copyWithConnections(
                dungeonMap,
                new ConnectionCatalog(
                        List.copyOf(nextCorridors),
                        dungeonMap.connections().stairs(),
                        dungeonMap.connections().transitions()))
                : dungeonMap;
    }

    public DungeonMap mergeCorridors(DungeonMap dungeonMap, long corridorId, long mergedCorridorId) {
        Objects.requireNonNull(dungeonMap, "dungeonMap");
        if (invalidCorridorId(corridorId)
                || invalidCorridorId(mergedCorridorId)
                || corridorId == mergedCorridorId) {
            return dungeonMap;
        }
        DungeonCorridor kept = corridor(dungeonMap, corridorId);
        DungeonCorridor merged = corridor(dungeonMap, mergedCorridorId);
        if (kept == null || merged == null) {
            return dungeonMap;
        }
        DungeonCorridor updated = kept.mergeKeepingThis(merged);
        List<DungeonCorridor> nextCorridors = new ArrayList<>();
        for (DungeonCorridor corridor : dungeonMap.connections().corridors()) {
            if (corridor.corridorId() == mergedCorridorId) {
                continue;
            }
            nextCorridors.add(corridor.corridorId() == corridorId ? updated : corridor);
        }
        List<DungeonStair> nextStairs = dungeonMap.connections().stairs().stream()
                .map(stair -> stair.corridorId() != null && stair.corridorId() == mergedCorridorId
                        ? stair.withCorridorId(corridorId)
                        : stair)
                .toList();
        return CONNECTION_NORMALIZATION_SERVICE.copyWithConnections(
                dungeonMap,
                new ConnectionCatalog(
                        List.copyOf(nextCorridors),
                        nextStairs,
                        dungeonMap.connections().transitions()));
    }

    public DungeonMap deleteCorridor(DungeonMap dungeonMap, long corridorId) {
        Objects.requireNonNull(dungeonMap, "dungeonMap");
        if (invalidCorridorId(corridorId)) {
            return dungeonMap;
        }
        DungeonCorridor existing = corridor(dungeonMap, corridorId);
        if (existing == null || ANCHOR_PRUNING_POLICY.ownedAnchorStillReferenced(dungeonMap.connections().corridors(), existing)) {
            return dungeonMap;
        }
        List<DungeonCorridor> nextCorridors = dungeonMap.connections().corridors().stream()
                .filter(corridor -> corridor.corridorId() != corridorId)
                .toList();
        List<DungeonStair> nextStairs = dungeonMap.connections().stairs().stream()
                .filter(stair -> stair.corridorId() == null || stair.corridorId() != corridorId)
                .toList();
        return CONNECTION_NORMALIZATION_SERVICE.copyWithConnections(
                dungeonMap,
                new ConnectionCatalog(
                        nextCorridors,
                        nextStairs,
                        dungeonMap.connections().transitions()));
    }

    public ConnectionCatalog normalizeConnections(DungeonMap dungeonMap, ConnectionCatalog source) {
        Objects.requireNonNull(dungeonMap, "dungeonMap");
        return CONNECTION_NORMALIZATION_SERVICE.normalizeConnections(dungeonMap, source);
    }

    private static boolean validCreateEndpoints(DungeonCorridorEndpoint start, DungeonCorridorEndpoint end) {
        return start != null && end != null && start.present() && end.present() && start.sameLevelAs(end);
    }

    private static DungeonCorridor applyEndpointBinding(
            DungeonMap dungeonMap,
            DungeonCorridor corridor,
            DungeonCorridorRoomEndpoint endpoint
    ) {
        DungeonCorridor updated = corridor.withAddedRoom(endpoint.roomId());
        if (!endpoint.fixedDoor()) {
            return updated;
        }
        DungeonRoomCluster cluster = cluster(dungeonMap, endpoint.clusterId());
        return cluster == null ? updated : updated.withDoorBinding(endpoint.toDoorBinding(cluster.center()));
    }

    private static boolean sameClusterOnly(DungeonMap dungeonMap, DungeonCorridorEndpoint start, DungeonCorridorEndpoint end) {
        if (!(start instanceof DungeonCorridorDoorEndpoint startDoor)
                || !(end instanceof DungeonCorridorDoorEndpoint endDoor)) {
            return false;
        }
        DungeonRoom left = room(dungeonMap, startDoor.roomId());
        DungeonRoom right = room(dungeonMap, endDoor.roomId());
        return left != null && right != null && left.clusterId() == right.clusterId();
    }

    private static boolean sameClusterOnly(DungeonMap dungeonMap, List<Long> roomIds) {
        Set<Long> clusterIds = new LinkedHashSet<>();
        for (Long roomId : roomIds == null ? List.<Long>of() : roomIds) {
            DungeonRoom room = roomId == null ? null : room(dungeonMap, roomId);
            if (room != null) {
                clusterIds.add(room.clusterId());
                if (spansMultipleClusters(clusterIds)) {
                    return false;
                }
            }
        }
        return clusterIds.size() <= 1;
    }

    private static boolean hasPersistedRoomId(@Nullable Long roomId) {
        return roomId != null && roomId > 0L;
    }

    private static boolean invalidCorridorId(long corridorId) {
        return corridorId <= 0L;
    }

    private static boolean spansMultipleClusters(Set<Long> clusterIds) {
        return clusterIds.size() > 1;
    }

    private static long nextCorridorId(DungeonMap dungeonMap) {
        return dungeonMap.connections().corridors().stream()
                .mapToLong(DungeonCorridor::corridorId)
                .max()
                .orElse(0L) + 1L;
    }

    @Nullable
    private static DungeonRoom room(DungeonMap dungeonMap, long roomId) {
        return dungeonMap.rooms().rooms().stream()
                .filter(room -> room.roomId() == roomId)
                .findFirst()
                .orElse(null);
    }

    @Nullable
    private static DungeonRoomCluster cluster(DungeonMap dungeonMap, long clusterId) {
        return dungeonMap.topology().roomClusters().stream()
                .filter(cluster -> cluster.clusterId() == clusterId)
                .findFirst()
                .orElse(null);
    }

    @Nullable
    private static DungeonCorridor corridor(DungeonMap dungeonMap, long corridorId) {
        return dungeonMap.connections().corridors().stream()
                .filter(candidate -> candidate.corridorId() == corridorId)
                .findFirst()
                .orElse(null);
    }
}
