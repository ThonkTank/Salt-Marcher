package src.domain.dungeon.map.service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.map.aggregate.DungeonMap;
import src.domain.dungeon.map.entity.DungeonCorridor;
import src.domain.dungeon.map.entity.DungeonRoom;
import src.domain.dungeon.map.entity.DungeonRoomCluster;
import src.domain.dungeon.map.entity.DungeonStair;
import src.domain.dungeon.map.value.ConnectionCatalog;
import src.domain.dungeon.map.value.DungeonBoundaryKey;
import src.domain.dungeon.map.value.DungeonCell;
import src.domain.dungeon.map.value.DungeonClusterBoundary;
import src.domain.dungeon.map.value.DungeonClusterBoundaryKind;
import src.domain.dungeon.map.value.DungeonCorridorAnchorBinding;
import src.domain.dungeon.map.value.DungeonCorridorAnchorEndpoint;
import src.domain.dungeon.map.value.DungeonCorridorAnchorRef;
import src.domain.dungeon.map.value.DungeonCorridorBindings;
import src.domain.dungeon.map.value.DungeonCorridorDoorBinding;
import src.domain.dungeon.map.value.DungeonCorridorDoorEndpoint;
import src.domain.dungeon.map.value.DungeonCorridorEndpoint;
import src.domain.dungeon.map.value.DungeonCorridorRoomEndpoint;
import src.domain.dungeon.map.value.DungeonEdge;
import src.domain.dungeon.map.value.DungeonEdgeDirection;
import src.domain.dungeon.map.value.DungeonMapIdentity;
import src.domain.dungeon.map.value.DungeonTopologyRef;

/**
 * Owns corridor mutation mechanics while the aggregate remains the public
 * mutation boundary.
 */
public final class DungeonCorridorMutationService {

    public @Nullable DungeonMap createCorridor(
            DungeonMap dungeonMap,
            DungeonCorridorEndpoint start,
            DungeonCorridorEndpoint end
    ) {
        if (dungeonMap == null || !validCreateEndpoints(start, end) || sameClusterOnly(dungeonMap, start, end)) {
            return null;
        }
        ResolvedEndpointResult startResolved = resolveEndpoint(dungeonMap, start);
        if (startResolved == null) {
            return null;
        }
        ResolvedEndpointResult endResolved = resolveEndpoint(startResolved.map(), end);
        if (endResolved == null || startResolved.endpoint().endpointKey().equals(endResolved.endpoint().endpointKey())) {
            return null;
        }
        if (matchingCorridorExists(endResolved.map(), startResolved.endpoint(), endResolved.endpoint())) {
            return null;
        }
        List<Long> roomIds = new ArrayList<>();
        Long startRoomId = startResolved.endpoint().roomId();
        if (startRoomId != null && startRoomId > 0L) {
            roomIds.add(startRoomId);
        }
        Long endRoomId = endResolved.endpoint().roomId();
        if (endRoomId != null && endRoomId > 0L && !roomIds.contains(endRoomId)) {
            roomIds.add(endRoomId);
        }
        DungeonCorridor corridor = new DungeonCorridor(
                nextCorridorId(endResolved.map()),
                endResolved.map().metadata().mapId().value(),
                start.level(),
                roomIds,
                DungeonCorridorBindings.empty());
        corridor = applyResolvedEndpoint(corridor, startResolved.endpoint());
        corridor = applyResolvedEndpoint(corridor, endResolved.endpoint());
        List<DungeonCorridor> nextCorridors = new ArrayList<>(endResolved.map().connections().corridors());
        nextCorridors.add(corridor);
        return copyWithConnections(endResolved.map(), new ConnectionCatalog(
                List.copyOf(nextCorridors),
                endResolved.map().connections().stairs(),
                endResolved.map().connections().transitions()));
    }

    public @Nullable DungeonMap extendCorridor(
            DungeonMap dungeonMap,
            long corridorId,
            DungeonCorridorRoomEndpoint endpoint
    ) {
        if (dungeonMap == null || corridorId <= 0L || endpoint == null || !endpoint.present()) {
            return null;
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
            if (sameClusterOnly(dungeonMap, updated.roomIds()) || corridorEquivalent(corridor, updated)) {
                nextCorridors.add(corridor);
                continue;
            }
            nextCorridors.add(updated);
            changed = true;
        }
        return changed
                ? copyWithConnections(dungeonMap, new ConnectionCatalog(
                List.copyOf(nextCorridors),
                dungeonMap.connections().stairs(),
                dungeonMap.connections().transitions()))
                : null;
    }

    public @Nullable DungeonMap mergeCorridors(DungeonMap dungeonMap, long corridorId, long mergedCorridorId) {
        if (dungeonMap == null || corridorId <= 0L || mergedCorridorId <= 0L || corridorId == mergedCorridorId) {
            return null;
        }
        DungeonCorridor kept = corridor(dungeonMap, corridorId);
        DungeonCorridor merged = corridor(dungeonMap, mergedCorridorId);
        if (kept == null || merged == null) {
            return null;
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
        return copyWithConnections(dungeonMap, new ConnectionCatalog(
                List.copyOf(nextCorridors),
                nextStairs,
                dungeonMap.connections().transitions()));
    }

    public @Nullable DungeonMap deleteCorridor(DungeonMap dungeonMap, long corridorId) {
        if (dungeonMap == null || corridorId <= 0L) {
            return null;
        }
        DungeonCorridor existing = corridor(dungeonMap, corridorId);
        if (existing == null || ownedAnchorStillReferenced(dungeonMap, existing)) {
            return null;
        }
        List<DungeonCorridor> nextCorridors = dungeonMap.connections().corridors().stream()
                .filter(corridor -> corridor.corridorId() != corridorId)
                .toList();
        List<DungeonStair> nextStairs = dungeonMap.connections().stairs().stream()
                .filter(stair -> stair.corridorId() == null || stair.corridorId() != corridorId)
                .toList();
        return copyWithConnections(dungeonMap, new ConnectionCatalog(
                nextCorridors,
                nextStairs,
                dungeonMap.connections().transitions()));
    }

    public ConnectionCatalog normalizeConnections(DungeonMap dungeonMap, ConnectionCatalog source) {
        return normalizeConnectionsInternal(dungeonMap, source);
    }

    private static DungeonMap copyWithConnections(DungeonMap dungeonMap, ConnectionCatalog nextConnections) {
        ConnectionCatalog normalized = normalizeConnectionsInternal(dungeonMap, nextConnections);
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

    private static ConnectionCatalog normalizeConnectionsInternal(DungeonMap dungeonMap, ConnectionCatalog source) {
        ConnectionCatalog safeSource = source == null ? ConnectionCatalog.empty() : source;
        List<DungeonCorridor> snappedCorridors = snapOwnedAnchors(dungeonMap, safeSource.corridors());
        List<DungeonCorridor> prunedCorridors = pruneAnchorBindings(snappedCorridors);
        return new ConnectionCatalog(prunedCorridors, safeSource.stairs(), safeSource.transitions());
    }

    private static List<DungeonCorridor> snapOwnedAnchors(DungeonMap dungeonMap, List<DungeonCorridor> corridors) {
        Map<Long, List<DungeonCell>> cellsByCorridor = corridorCellsByCorridor(dungeonMap, corridors);
        List<DungeonCorridor> result = new ArrayList<>();
        for (DungeonCorridor corridor : corridors == null ? List.<DungeonCorridor>of() : corridors) {
            List<DungeonCorridorAnchorBinding> snapped = corridor.bindings().anchorBindings().stream()
                    .filter(Objects::nonNull)
                    .map(binding -> binding.withAbsoluteCell(
                            snapToHostCorridorCell(binding.absoluteCell(), cellsByCorridor.getOrDefault(
                                    binding.hostCorridorId(),
                                    List.of(binding.absoluteCell())))))
                    .toList();
            result.add(corridor.withBindings(corridor.bindings().replaceAnchorBindings(snapped)));
        }
        return List.copyOf(result);
    }

    private static List<DungeonCorridor> pruneAnchorBindings(List<DungeonCorridor> corridors) {
        Set<DungeonTopologyRef> referenced = new LinkedHashSet<>();
        Map<DungeonTopologyRef, Long> hosts = new LinkedHashMap<>();
        for (DungeonCorridor corridor : corridors == null ? List.<DungeonCorridor>of() : corridors) {
            for (DungeonCorridorAnchorBinding binding : corridor.bindings().anchorBindings()) {
                if (binding != null && binding.topologyRef().present()) {
                    hosts.put(binding.topologyRef(), corridor.corridorId());
                }
            }
            for (DungeonCorridorAnchorRef ref : corridor.bindings().anchorRefs()) {
                if (ref != null && ref.present()) {
                    referenced.add(ref.topologyRef());
                }
            }
        }
        List<DungeonCorridor> result = new ArrayList<>();
        for (DungeonCorridor corridor : corridors == null ? List.<DungeonCorridor>of() : corridors) {
            List<DungeonCorridorAnchorBinding> keptBindings = corridor.bindings().anchorBindings().stream()
                    .filter(Objects::nonNull)
                    .filter(binding -> referenced.contains(binding.topologyRef()))
                    .toList();
            List<DungeonCorridorAnchorRef> keptRefs = corridor.bindings().anchorRefs().stream()
                    .filter(Objects::nonNull)
                    .filter(ref -> ref.present() && hosts.containsKey(ref.topologyRef()))
                    .toList();
            result.add(corridor.withBindings(
                    corridor.bindings()
                            .replaceAnchorBindings(keptBindings)
                            .replaceAnchorRefs(keptRefs)));
        }
        return List.copyOf(result);
    }

    private static Map<Long, List<DungeonCell>> corridorCellsByCorridor(DungeonMap dungeonMap, List<DungeonCorridor> corridors) {
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
                .filter(area -> area.kind() == src.domain.dungeon.map.value.DungeonAreaType.CORRIDOR)
                .forEach(area -> result.put(area.id(), area.cells()));
        return Map.copyOf(result);
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

    private static DungeonCell snapToHostCorridorCell(DungeonCell desired, List<DungeonCell> candidates) {
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

    private static int manhattan(DungeonCell left, DungeonCell right) {
        return Math.abs(left.q() - right.q())
                + Math.abs(left.r() - right.r())
                + Math.abs(left.level() - right.level());
    }

    private @Nullable ResolvedEndpointResult resolveEndpoint(DungeonMap dungeonMap, DungeonCorridorEndpoint endpoint) {
        if (endpoint instanceof DungeonCorridorDoorEndpoint doorEndpoint) {
            return resolveDoorEndpoint(dungeonMap, doorEndpoint);
        }
        if (endpoint instanceof DungeonCorridorAnchorEndpoint anchorEndpoint) {
            return resolveAnchorEndpoint(dungeonMap, anchorEndpoint);
        }
        return null;
    }

    private @Nullable ResolvedEndpointResult resolveDoorEndpoint(
            DungeonMap dungeonMap,
            DungeonCorridorDoorEndpoint endpoint
    ) {
        if (endpoint == null || !endpoint.present()) {
            return null;
        }
        DungeonRoomCluster cluster = cluster(dungeonMap, endpoint.clusterId());
        if (cluster == null) {
            return null;
        }
        DungeonEdge edge = DungeonEdge.sideOf(endpoint.roomCell(), endpoint.direction());
        DungeonMap mapped = ensureDoorBoundary(dungeonMap, endpoint.clusterId(), edge);
        DungeonRoomCluster mappedCluster = cluster(mapped, endpoint.clusterId());
        DungeonClusterBoundary boundary = boundaryAt(mapped, endpoint.clusterId(), edge);
        if (mappedCluster == null || boundary == null || boundary.kind() != DungeonClusterBoundaryKind.DOOR) {
            return null;
        }
        DungeonCorridorDoorBinding binding = new DungeonCorridorDoorBinding(
                endpoint.roomId(),
                endpoint.clusterId(),
                new DungeonCell(
                        endpoint.roomCell().q() - mappedCluster.center().q(),
                        endpoint.roomCell().r() - mappedCluster.center().r(),
                        endpoint.roomCell().level()),
                endpoint.direction(),
                boundary.resolvedTopologyRef(mappedCluster.center()));
        return new ResolvedEndpointResult(mapped, ResolvedCorridorEndpoint.forDoor(binding));
    }

    private @Nullable ResolvedEndpointResult resolveAnchorEndpoint(
            DungeonMap dungeonMap,
            DungeonCorridorAnchorEndpoint endpoint
    ) {
        if (endpoint == null || !endpoint.present()) {
            return null;
        }
        DungeonCorridor host = corridor(dungeonMap, endpoint.hostCorridorId());
        if (host == null) {
            return null;
        }
        Map<Long, List<DungeonCell>> cellsByCorridor = corridorCellsByCorridor(dungeonMap, dungeonMap.connections().corridors());
        List<DungeonCell> hostCells = cellsByCorridor.getOrDefault(host.corridorId(), List.of());
        if (hostCells.isEmpty()) {
            return null;
        }
        DungeonCell anchorCell = snapToHostCorridorCell(endpoint.anchorCell(), hostCells);
        DungeonCorridorAnchorBinding existing = findAnchorBinding(host, endpoint.topologyRef(), anchorCell);
        if (existing != null) {
            return new ResolvedEndpointResult(dungeonMap, ResolvedCorridorEndpoint.forAnchor(existing));
        }
        long anchorId = nextAnchorId(dungeonMap);
        DungeonCorridorAnchorBinding created = new DungeonCorridorAnchorBinding(
                anchorId,
                host.corridorId(),
                anchorCell,
                endpoint.topologyRef().present()
                        ? endpoint.topologyRef()
                        : new DungeonTopologyRef(src.domain.dungeon.map.value.DungeonTopologyElementKind.CORRIDOR_ANCHOR, anchorId));
        List<DungeonCorridor> updatedCorridors = new ArrayList<>();
        for (DungeonCorridor corridor : dungeonMap.connections().corridors()) {
            updatedCorridors.add(corridor.corridorId() == host.corridorId()
                    ? corridor.withAnchorBinding(created)
                    : corridor);
        }
        DungeonMap mapped = copyWithConnections(dungeonMap, new ConnectionCatalog(
                List.copyOf(updatedCorridors),
                dungeonMap.connections().stairs(),
                dungeonMap.connections().transitions()));
        DungeonCorridorAnchorBinding resolved = findAnchorBinding(
                corridor(mapped, host.corridorId()),
                created.topologyRef(),
                created.absoluteCell());
        return resolved == null ? null : new ResolvedEndpointResult(mapped, ResolvedCorridorEndpoint.forAnchor(resolved));
    }

    private static DungeonMap ensureDoorBoundary(DungeonMap dungeonMap, long clusterId, DungeonEdge edge) {
        DungeonClusterBoundary existing = boundaryAt(dungeonMap, clusterId, edge);
        if (existing != null && existing.kind() == DungeonClusterBoundaryKind.DOOR) {
            return dungeonMap;
        }
        return new DungeonRoomTopologyEditor().editBoundaries(
                dungeonMap,
                clusterId,
                List.of(edge),
                DungeonClusterBoundaryKind.DOOR,
                false);
    }

    private static @Nullable DungeonClusterBoundary boundaryAt(DungeonMap dungeonMap, long clusterId, DungeonEdge edge) {
        DungeonRoomCluster cluster = cluster(dungeonMap, clusterId);
        if (cluster == null || edge == null) {
            return null;
        }
        for (List<DungeonClusterBoundary> boundaries : cluster.boundariesByLevel().values()) {
            for (DungeonClusterBoundary boundary : boundaries) {
                if (DungeonBoundaryKey.from(boundary.absoluteEdge(cluster.center()))
                        .equals(DungeonBoundaryKey.from(edge))) {
                    return boundary;
                }
            }
        }
        return null;
    }

    private static @Nullable DungeonCorridorAnchorBinding findAnchorBinding(
            @Nullable DungeonCorridor host,
            DungeonTopologyRef topologyRef,
            DungeonCell anchorCell
    ) {
        if (host == null) {
            return null;
        }
        for (DungeonCorridorAnchorBinding binding : host.bindings().anchorBindings()) {
            if (binding == null) {
                continue;
            }
            if (topologyRef != null && topologyRef.present() && binding.topologyRef().equals(topologyRef)) {
                return binding;
            }
            if (binding.absoluteCell().equals(anchorCell)) {
                return binding;
            }
        }
        return null;
    }

    private static DungeonCorridor applyResolvedEndpoint(DungeonCorridor corridor, ResolvedCorridorEndpoint endpoint) {
        if (endpoint == null) {
            return corridor;
        }
        DungeonCorridor updated = corridor;
        if (endpoint.doorBinding() != null) {
            updated = updated.withDoorBinding(endpoint.doorBinding());
        }
        if (endpoint.anchorRef() != null && endpoint.anchorRef().present()) {
            updated = updated.withAnchorRef(endpoint.anchorRef());
        }
        return updated;
    }

    private static boolean ownedAnchorStillReferenced(DungeonMap dungeonMap, DungeonCorridor corridor) {
        Set<DungeonTopologyRef> ownedRefs = corridor.bindings().anchorBindings().stream()
                .filter(Objects::nonNull)
                .map(DungeonCorridorAnchorBinding::topologyRef)
                .collect(LinkedHashSet::new, Set::add, Set::addAll);
        if (ownedRefs.isEmpty()) {
            return false;
        }
        return dungeonMap.connections().corridors().stream()
                .filter(candidate -> candidate.corridorId() != corridor.corridorId())
                .flatMap(candidate -> candidate.bindings().anchorRefs().stream())
                .filter(Objects::nonNull)
                .map(DungeonCorridorAnchorRef::topologyRef)
                .anyMatch(ownedRefs::contains);
    }

    private static long nextAnchorId(DungeonMap dungeonMap) {
        return dungeonMap.connections().corridors().stream()
                .flatMap(corridor -> corridor.bindings().anchorBindings().stream())
                .filter(Objects::nonNull)
                .mapToLong(DungeonCorridorAnchorBinding::anchorId)
                .max()
                .orElse(0L) + 1L;
    }

    private static boolean validCreateEndpoints(DungeonCorridorEndpoint start, DungeonCorridorEndpoint end) {
        if (start == null || end == null) {
            return false;
        }
        if (start instanceof DungeonCorridorDoorEndpoint startDoor && !startDoor.present()) {
            return false;
        }
        if (start instanceof DungeonCorridorAnchorEndpoint startAnchor && !startAnchor.present()) {
            return false;
        }
        if (end instanceof DungeonCorridorDoorEndpoint endDoor && !endDoor.present()) {
            return false;
        }
        if (end instanceof DungeonCorridorAnchorEndpoint endAnchor && !endAnchor.present()) {
            return false;
        }
        return start.level() == end.level();
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
        if (!(start instanceof DungeonCorridorDoorEndpoint startDoor) || !(end instanceof DungeonCorridorDoorEndpoint endDoor)) {
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
                if (clusterIds.size() > 1) {
                    return false;
                }
            }
        }
        return clusterIds.size() <= 1;
    }

    private static boolean matchingCorridorExists(
            DungeonMap dungeonMap,
            ResolvedCorridorEndpoint start,
            ResolvedCorridorEndpoint end
    ) {
        Set<String> requested = Set.of(start.endpointKey(), end.endpointKey());
        return dungeonMap.connections().corridors().stream()
                .anyMatch(corridor -> explicitEndpointKeys(corridor).equals(requested));
    }

    private static Set<String> explicitEndpointKeys(DungeonCorridor corridor) {
        LinkedHashSet<String> result = new LinkedHashSet<>();
        for (DungeonCorridorDoorBinding binding : corridor.bindings().doorBindings()) {
            result.add(doorEndpointKey(binding));
        }
        for (DungeonCorridorAnchorRef ref : corridor.bindings().anchorRefs()) {
            if (ref.present()) {
                result.add(anchorEndpointKey(ref));
            }
        }
        return Set.copyOf(result);
    }

    private static String doorEndpointKey(DungeonCorridorDoorBinding binding) {
        DungeonTopologyRef topologyRef = binding.topologyRef();
        if (topologyRef.present()) {
            return "door:" + topologyRef.id();
        }
        return "door:" + binding.roomId()
                + ":" + binding.clusterId()
                + ":" + binding.relativeCell().q()
                + ":" + binding.relativeCell().r()
                + ":" + binding.relativeCell().level()
                + ":" + binding.direction().name();
    }

    private static String anchorEndpointKey(DungeonCorridorAnchorRef ref) {
        return "anchor:" + ref.hostCorridorId() + ":" + ref.topologyRef().id();
    }

    private static boolean corridorEquivalent(DungeonCorridor left, DungeonCorridor right) {
        return left != null
                && right != null
                && left.roomIds().equals(right.roomIds())
                && left.bindings().equals(right.bindings());
    }

    private static long nextCorridorId(DungeonMap dungeonMap) {
        return dungeonMap.connections().corridors().stream()
                .mapToLong(DungeonCorridor::corridorId)
                .max()
                .orElse(0L) + 1L;
    }

    private static @Nullable DungeonRoom room(DungeonMap dungeonMap, long roomId) {
        return dungeonMap.rooms().rooms().stream()
                .filter(room -> room.roomId() == roomId)
                .findFirst()
                .orElse(null);
    }

    private static @Nullable DungeonRoomCluster cluster(DungeonMap dungeonMap, long clusterId) {
        return dungeonMap.topology().roomClusters().stream()
                .filter(cluster -> cluster.clusterId() == clusterId)
                .findFirst()
                .orElse(null);
    }

    private static @Nullable DungeonCorridor corridor(DungeonMap dungeonMap, long corridorId) {
        return dungeonMap.connections().corridors().stream()
                .filter(candidate -> candidate.corridorId() == corridorId)
                .findFirst()
                .orElse(null);
    }

    private record ResolvedEndpointResult(DungeonMap map, ResolvedCorridorEndpoint endpoint) {
    }

    private record ResolvedCorridorEndpoint(
            @Nullable Long roomId,
            @Nullable DungeonCorridorDoorBinding doorBinding,
            @Nullable DungeonCorridorAnchorRef anchorRef
    ) {
        private static ResolvedCorridorEndpoint forDoor(DungeonCorridorDoorBinding binding) {
            return new ResolvedCorridorEndpoint(binding.roomId(), binding, null);
        }

        private static ResolvedCorridorEndpoint forAnchor(DungeonCorridorAnchorBinding binding) {
            return new ResolvedCorridorEndpoint(
                    null,
                    null,
                    new DungeonCorridorAnchorRef(binding.hostCorridorId(), binding.topologyRef()));
        }

        private String endpointKey() {
            if (doorBinding != null) {
                return doorEndpointKey(doorBinding);
            }
            if (anchorRef != null) {
                return anchorEndpointKey(anchorRef);
            }
            return "";
        }
    }
}
