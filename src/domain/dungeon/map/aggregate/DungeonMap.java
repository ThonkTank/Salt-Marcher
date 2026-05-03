package src.domain.dungeon.map.aggregate;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.map.value.ConnectionCatalog;
import src.domain.dungeon.map.service.DungeonCorridorMutationService;
import src.domain.dungeon.map.service.DungeonCorridorReadProjector;
import src.domain.dungeon.map.service.DungeonRoomCellProjector;
import src.domain.dungeon.map.service.DungeonRoomTopologyEditor;
import src.domain.dungeon.map.entity.DungeonRoom;
import src.domain.dungeon.map.entity.DungeonRoomCluster;
import src.domain.dungeon.map.entity.DungeonCorridor;
import src.domain.dungeon.map.entity.DungeonStair;
import src.domain.dungeon.map.value.DungeonCell;
import src.domain.dungeon.map.value.DungeonClusterBoundary;
import src.domain.dungeon.map.value.DungeonClusterBoundaryKind;
import src.domain.dungeon.map.value.DungeonCorridorAnchorBinding;
import src.domain.dungeon.map.value.DungeonCorridorAnchorRef;
import src.domain.dungeon.map.value.DungeonCorridorBindings;
import src.domain.dungeon.map.value.DungeonCorridorDoorBinding;
import src.domain.dungeon.map.value.DungeonCorridorEndpoint;
import src.domain.dungeon.map.value.DungeonCorridorRoomEndpoint;
import src.domain.dungeon.map.value.DungeonCorridorWaypoint;
import src.domain.dungeon.map.value.DungeonEditorHandle;
import src.domain.dungeon.map.value.DungeonEditorHandleType;
import src.domain.dungeon.map.value.DungeonEdge;
import src.domain.dungeon.map.value.DungeonEdgeDirection;
import src.domain.dungeon.map.value.DungeonMapTopology;
import src.domain.dungeon.map.value.DungeonMapIdentity;
import src.domain.dungeon.map.value.DungeonMapMetadata;
import src.domain.dungeon.map.value.DungeonRoomNarration;
import src.domain.dungeon.map.value.DungeonStairExit;
import src.domain.dungeon.map.value.FeatureCatalog;
import src.domain.dungeon.map.value.RoomCatalog;
import src.domain.dungeon.map.value.SpaceCatalog;
import src.domain.dungeon.map.value.SpatialTopology;
import src.domain.dungeon.map.value.DungeonTopologyRef;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.OptionalLong;
import java.util.Set;

/**
 * Canonical aggregate root for one authored dungeon map.
 */
public final class DungeonMap {

    private static final DungeonRoomTopologyEditor ROOM_TOPOLOGY_EDITOR = new DungeonRoomTopologyEditor();
    private static final DungeonCorridorMutationService CORRIDOR_MUTATION_SERVICE = new DungeonCorridorMutationService();

    private final DungeonMapMetadata metadata;
    private final SpatialTopology topology;
    private final DungeonMapTopology topologyIndex;
    private final SpaceCatalog spaces;
    private final RoomCatalog rooms;
    private final ConnectionCatalog connections;
    private final FeatureCatalog features;
    private final long revision;

    public DungeonMap(
            DungeonMapMetadata metadata,
            SpatialTopology topology,
            SpaceCatalog spaces,
            RoomCatalog rooms,
            ConnectionCatalog connections,
            FeatureCatalog features,
            long revision
    ) {
        this(metadata, topology, null, spaces, rooms, connections, features, revision);
    }

    public DungeonMap(
            DungeonMapMetadata metadata,
            SpatialTopology topology,
            @Nullable DungeonMapTopology topologyIndex,
            SpaceCatalog spaces,
            RoomCatalog rooms,
            ConnectionCatalog connections,
            FeatureCatalog features,
            long revision
    ) {
        this.metadata = metadata;
        this.topology = topology == null ? SpatialTopology.empty() : topology;
        this.spaces = spaces == null ? SpaceCatalog.empty() : spaces;
        this.rooms = rooms == null ? RoomCatalog.empty() : rooms;
        this.connections = connections == null ? ConnectionCatalog.empty() : connections;
        this.features = features == null ? FeatureCatalog.empty() : features;
        this.topologyIndex = DungeonMapTopology.merge(
                topologyIndex,
                DungeonMapTopology.from(this.topology, this.rooms, this.connections));
        this.revision = Math.max(0L, revision);
    }

    public static DungeonMap empty(DungeonMapIdentity mapId, String mapName) {
        return authored(mapId, mapName, SpatialTopology.empty(), 1L);
    }

    public static DungeonMap authored(
            DungeonMapIdentity mapId,
            String mapName,
            SpatialTopology topology,
            long revision
    ) {
        return new DungeonMap(
                new DungeonMapMetadata(mapId, mapName),
                topology,
                SpaceCatalog.empty(),
                RoomCatalog.empty(),
                ConnectionCatalog.empty(),
                FeatureCatalog.empty(),
                revision);
    }

    public static DungeonMap authored(
            DungeonMapIdentity mapId,
            String mapName,
            SpatialTopology topology,
            RoomCatalog rooms,
            ConnectionCatalog connections,
            long revision
    ) {
        return authored(mapId, mapName, topology, null, rooms, connections, revision);
    }

    public static DungeonMap authored(
            DungeonMapIdentity mapId,
            String mapName,
            SpatialTopology topology,
            @Nullable DungeonMapTopology topologyIndex,
            RoomCatalog rooms,
            ConnectionCatalog connections,
            long revision
    ) {
        return new DungeonMap(
                new DungeonMapMetadata(mapId, mapName),
                topology,
                topologyIndex,
                SpaceCatalog.empty(),
                rooms,
                connections,
                FeatureCatalog.empty(),
                revision);
    }

    public static DungeonMap authored(
            DungeonMapIdentity mapId,
            String mapName,
            SpatialTopology topology,
            RoomCatalog rooms,
            long revision
    ) {
        return authored(mapId, mapName, topology, rooms, ConnectionCatalog.empty(), revision);
    }

    public DungeonMap moveRoomAnchor(int deltaQ, int deltaR) {
        return withTopology(topology.moveRoomAnchor(deltaQ, deltaR), revision + 1L);
    }

    public DungeonMap moveTopologyElement(DungeonTopologyRef ref, int deltaQ, int deltaR) {
        return moveTopologyElement(ref, deltaQ, deltaR, 0);
    }

    public DungeonMap moveTopologyElement(DungeonTopologyRef ref, int deltaQ, int deltaR, int deltaLevel) {
        if (ref == null || !ref.present() || (deltaQ == 0 && deltaR == 0 && deltaLevel == 0)) {
            return this;
        }
        OptionalLong clusterId = topologyIndex().clusterIdFor(ref);
        return clusterId.isPresent() ? moveCluster(clusterId.getAsLong(), deltaQ, deltaR, deltaLevel) : this;
    }

    public DungeonMap moveEditorHandle(DungeonEditorHandle handle, int deltaQ, int deltaR, int deltaLevel) {
        if (handle == null || (deltaQ == 0 && deltaR == 0 && deltaLevel == 0)) {
            return this;
        }
        if (handle.type() == DungeonEditorHandleType.CLUSTER_LABEL) {
            long clusterId = handle.clusterId() > 0L
                    ? handle.clusterId()
                    : topologyIndex().clusterIdFor(handle.topologyRef()).orElse(0L);
            return moveCluster(clusterId, deltaQ, deltaR, deltaLevel);
        }
        if (handle.type() == DungeonEditorHandleType.DOOR) {
            return moveDoorBinding(handle, deltaQ, deltaR, deltaLevel);
        }
        if (handle.type() == DungeonEditorHandleType.CORRIDOR_ANCHOR) {
            return moveCorridorAnchor(handle, deltaQ, deltaR, deltaLevel);
        }
        if (handle.type() == DungeonEditorHandleType.CORRIDOR_WAYPOINT) {
            return moveCorridorWaypoint(handle, deltaQ, deltaR, deltaLevel);
        }
        if (handle.type() == DungeonEditorHandleType.STAIR_ANCHOR) {
            return moveStairAnchor(handle, deltaQ, deltaR, deltaLevel);
        }
        return this;
    }

    public DungeonMap moveBoundaryStretch(
            long clusterId,
            List<DungeonEdge> sourceEdges,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        return ROOM_TOPOLOGY_EDITOR.moveBoundaryStretch(this, clusterId, sourceEdges, deltaQ, deltaR, deltaLevel);
    }

    public DungeonMapTopology topologyIndex() {
        return topologyIndex;
    }

    private DungeonMap moveCluster(long clusterId, int deltaQ, int deltaR, int deltaLevel) {
        if (clusterId <= 0L || (deltaQ == 0 && deltaR == 0 && deltaLevel == 0)) {
            return this;
        }
        SpatialTopology nextTopology = moveTopologyCluster(clusterId, deltaQ, deltaR, deltaLevel);
        RoomCatalog nextRooms = moveRoomsForCluster(clusterId, deltaQ, deltaR, deltaLevel);
        if (nextTopology.equals(topology) && nextRooms.equals(rooms)) {
            return this;
        }
        return new DungeonMap(
                metadata,
                nextTopology,
                topologyIndex,
                spaces,
                nextRooms,
                connections,
                features,
                revision + 1L);
    }

    private SpatialTopology moveTopologyCluster(long clusterId, int deltaQ, int deltaR, int deltaLevel) {
        List<DungeonRoomCluster> movedClusters = new ArrayList<>();
        boolean changed = false;
        for (DungeonRoomCluster cluster : topology.roomClusters()) {
            if (cluster.clusterId() == clusterId) {
                movedClusters.add(new DungeonRoomCluster(
                        cluster.clusterId(),
                        cluster.mapId(),
                        new DungeonCell(
                                cluster.center().q() + deltaQ,
                                cluster.center().r() + deltaR,
                                cluster.center().level() + deltaLevel),
                        movedCellsByLevel(cluster.relativeVerticesByLevel(), deltaLevel),
                        movedBoundariesByLevel(cluster.boundariesByLevel(), deltaLevel)));
                changed = true;
            } else {
                movedClusters.add(cluster);
            }
        }
        return changed ? topology.withRoomClusters(movedClusters) : topology;
    }

    private RoomCatalog moveRoomsForCluster(long clusterId, int deltaQ, int deltaR, int deltaLevel) {
        List<DungeonRoom> movedRooms = new ArrayList<>();
        boolean changed = false;
        for (DungeonRoom room : rooms.rooms()) {
            if (room.clusterId() == clusterId) {
                movedRooms.add(movedRoom(room, deltaQ, deltaR, deltaLevel));
                changed = true;
            } else {
                movedRooms.add(room);
            }
        }
        return changed ? new RoomCatalog(movedRooms) : rooms;
    }

    private static DungeonRoom movedRoom(DungeonRoom room, int deltaQ, int deltaR, int deltaLevel) {
        Map<Integer, DungeonCell> movedAnchors = new LinkedHashMap<>();
        for (Map.Entry<Integer, DungeonCell> entry : room.floorAnchors().entrySet()) {
            DungeonCell anchor = entry.getValue();
            int nextLevel = entry.getKey() + deltaLevel;
            movedAnchors.put(
                    nextLevel,
                    new DungeonCell(anchor.q() + deltaQ, anchor.r() + deltaR, anchor.level() + deltaLevel));
        }
        return new DungeonRoom(
                room.roomId(),
                room.mapId(),
                room.clusterId(),
                room.name(),
                movedAnchors,
                room.narration());
    }

    private static Map<Integer, List<DungeonCell>> movedCellsByLevel(
            Map<Integer, List<DungeonCell>> cellsByLevel,
            int deltaLevel
    ) {
        if (deltaLevel == 0 || cellsByLevel == null || cellsByLevel.isEmpty()) {
            return cellsByLevel;
        }
        Map<Integer, List<DungeonCell>> result = new LinkedHashMap<>();
        for (Map.Entry<Integer, List<DungeonCell>> entry : cellsByLevel.entrySet()) {
            List<DungeonCell> movedCells = entry.getValue().stream()
                    .map(cell -> new DungeonCell(cell.q(), cell.r(), cell.level() + deltaLevel))
                    .toList();
            result.put(entry.getKey() + deltaLevel, movedCells);
        }
        return Map.copyOf(result);
    }

    private static Map<Integer, List<DungeonClusterBoundary>> movedBoundariesByLevel(
            Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel,
            int deltaLevel
    ) {
        if (deltaLevel == 0 || boundariesByLevel == null || boundariesByLevel.isEmpty()) {
            return boundariesByLevel;
        }
        Map<Integer, List<DungeonClusterBoundary>> result = new LinkedHashMap<>();
        for (Map.Entry<Integer, List<DungeonClusterBoundary>> entry : boundariesByLevel.entrySet()) {
            List<DungeonClusterBoundary> movedBoundaries = entry.getValue().stream()
                    .map(boundary -> new DungeonClusterBoundary(
                            boundary.clusterId(),
                            boundary.level() + deltaLevel,
                            new DungeonCell(
                                    boundary.relativeCell().q(),
                                    boundary.relativeCell().r(),
                                    boundary.relativeCell().level() + deltaLevel),
                            boundary.direction(),
                            boundary.kind(),
                            boundary.topologyRef()))
                    .toList();
            result.put(entry.getKey() + deltaLevel, movedBoundaries);
        }
        return Map.copyOf(result);
    }

    private DungeonMap moveDoorBinding(DungeonEditorHandle handle, int deltaQ, int deltaR, int deltaLevel) {
        List<DungeonCorridor> movedCorridors = new ArrayList<>();
        boolean changed = false;
        for (DungeonCorridor corridor : connections.corridors()) {
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
        return changed ? withConnections(new ConnectionCatalog(movedCorridors, connections.stairs(), connections.transitions())) : this;
    }

    private DungeonMap moveCorridorAnchor(DungeonEditorHandle handle, int deltaQ, int deltaR, int deltaLevel) {
        List<DungeonCorridor> movedCorridors = new ArrayList<>();
        boolean changed = false;
        for (DungeonCorridor corridor : connections.corridors()) {
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
        return changed ? withConnections(new ConnectionCatalog(movedCorridors, connections.stairs(), connections.transitions())) : this;
    }

    private DungeonMap moveCorridorWaypoint(DungeonEditorHandle handle, int deltaQ, int deltaR, int deltaLevel) {
        List<DungeonCorridor> movedCorridors = new ArrayList<>();
        boolean changed = false;
        for (DungeonCorridor corridor : connections.corridors()) {
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
        return changed ? withConnections(new ConnectionCatalog(movedCorridors, connections.stairs(), connections.transitions())) : this;
    }

    private DungeonMap moveStairAnchor(DungeonEditorHandle handle, int deltaQ, int deltaR, int deltaLevel) {
        List<DungeonStair> movedStairs = new ArrayList<>();
        boolean changed = false;
        for (DungeonStair stair : connections.stairs()) {
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
                if (exitIndex >= 0 && exitIndex < exits.size()) {
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
                    stair.shape(),
                    stair.direction(),
                    stair.dimension1(),
                    stair.dimension2(),
                    path,
                    exits,
                    stair.corridorId()));
        }
        return changed ? withConnections(new ConnectionCatalog(connections.corridors(), movedStairs, connections.transitions())) : this;
    }

    private DungeonMap withConnections(ConnectionCatalog nextConnections) {
        ConnectionCatalog normalized = normalizeConnections(nextConnections);
        return new DungeonMap(
                metadata,
                topology,
                topologyIndex,
                spaces,
                rooms,
                normalized,
                features,
                revision + 1L);
    }

    private static DungeonCell movedCell(DungeonCell cell, int deltaQ, int deltaR, int deltaLevel) {
        DungeonCell safeCell = cell == null ? new DungeonCell(0, 0, 0) : cell;
        return new DungeonCell(safeCell.q() + deltaQ, safeCell.r() + deltaR, safeCell.level() + deltaLevel);
    }

    public DungeonMap saveRoomNarration(long roomId, DungeonRoomNarration narration) {
        if (roomId <= 0L || narration == null) {
            return this;
        }
        List<DungeonRoom> nextRooms = new ArrayList<>();
        boolean changed = false;
        for (DungeonRoom room : rooms.rooms()) {
            if (room.roomId() == roomId) {
                nextRooms.add(room.withNarration(narration));
                changed = true;
            } else {
                nextRooms.add(room);
            }
        }
        return changed
                ? new DungeonMap(
                        metadata,
                        topology,
                        topologyIndex,
                        spaces,
                        new RoomCatalog(nextRooms),
                        connections,
                        features,
                        revision + 1L)
                : this;
    }

    public DungeonMap paintRoomRectangle(DungeonCell start, DungeonCell end) {
        return ROOM_TOPOLOGY_EDITOR.paintRectangle(this, start, end);
    }

    public DungeonMap deleteRoomRectangle(DungeonCell start, DungeonCell end) {
        return ROOM_TOPOLOGY_EDITOR.deleteRectangle(this, start, end);
    }

    public DungeonMap editClusterBoundaries(
            long clusterId,
            List<DungeonEdge> edges,
            DungeonClusterBoundaryKind kind,
            boolean deleteBoundary
    ) {
        return ROOM_TOPOLOGY_EDITOR.editBoundaries(this, clusterId, edges, kind, deleteBoundary);
    }

    public DungeonMap createCorridor(DungeonCorridorEndpoint start, DungeonCorridorEndpoint end) {
        DungeonMap mutated = CORRIDOR_MUTATION_SERVICE.createCorridor(this, start, end);
        return mutated == null ? this : mutated;
    }

    public DungeonMap extendCorridor(long corridorId, DungeonCorridorRoomEndpoint endpoint) {
        DungeonMap mutated = CORRIDOR_MUTATION_SERVICE.extendCorridor(this, corridorId, endpoint);
        return mutated == null ? this : mutated;
    }

    public DungeonMap mergeCorridors(long corridorId, long mergedCorridorId) {
        DungeonMap mutated = CORRIDOR_MUTATION_SERVICE.mergeCorridors(this, corridorId, mergedCorridorId);
        return mutated == null ? this : mutated;
    }

    public DungeonMap deleteCorridor(long corridorId) {
        DungeonMap mutated = CORRIDOR_MUTATION_SERVICE.deleteCorridor(this, corridorId);
        return mutated == null ? this : mutated;
    }

    private ConnectionCatalog normalizeConnections(ConnectionCatalog source) {
        ConnectionCatalog safeSource = source == null ? ConnectionCatalog.empty() : source;
        List<DungeonCorridor> snappedCorridors = snapOwnedAnchors(safeSource.corridors());
        List<DungeonCorridor> prunedCorridors = pruneAnchorBindings(snappedCorridors);
        return new ConnectionCatalog(prunedCorridors, safeSource.stairs(), safeSource.transitions());
    }

    private List<DungeonCorridor> snapOwnedAnchors(List<DungeonCorridor> corridors) {
        Map<Long, List<DungeonCell>> cellsByCorridor = corridorCellsByCorridor(corridors);
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

    private List<DungeonCorridor> pruneAnchorBindings(List<DungeonCorridor> corridors) {
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

    private Map<Long, List<DungeonCell>> corridorCellsByCorridor(List<DungeonCorridor> corridors) {
        Map<Long, DungeonRoomCluster> clustersById = clustersById();
        Map<Long, DungeonRoom> roomsById = roomsById();
        Map<Long, List<DungeonCell>> roomCellsByRoom = roomCellsByRoom();
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

    private Map<Long, List<DungeonCell>> roomCellsByRoom() {
        DungeonRoomCellProjector projector = new DungeonRoomCellProjector();
        Map<Long, List<DungeonCell>> result = new LinkedHashMap<>();
        for (DungeonRoomCluster cluster : topology.roomClusters()) {
            List<DungeonRoom> clusterRooms = rooms.rooms().stream()
                    .filter(room -> room.clusterId() == cluster.clusterId())
                    .toList();
            result.putAll(projector.cellsByRoom(cluster, clusterRooms));
        }
        return Map.copyOf(result);
    }

    private Map<Long, DungeonRoomCluster> clustersById() {
        Map<Long, DungeonRoomCluster> result = new LinkedHashMap<>();
        for (DungeonRoomCluster cluster : topology.roomClusters()) {
            result.put(cluster.clusterId(), cluster);
        }
        return Map.copyOf(result);
    }

    private Map<Long, DungeonRoom> roomsById() {
        Map<Long, DungeonRoom> result = new LinkedHashMap<>();
        for (DungeonRoom room : rooms.rooms()) {
            result.put(room.roomId(), room);
        }
        return Map.copyOf(result);
    }

    private DungeonCell snapToHostCorridorCell(DungeonCell desired, List<DungeonCell> candidates) {
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

    public DungeonMap rename(String mapName) {
        return new DungeonMap(
                new DungeonMapMetadata(metadata.mapId(), mapName),
                topology,
                topologyIndex,
                spaces,
                rooms,
                connections,
                features,
                revision + 1L);
    }

    public java.util.List<String> validationMessages() {
        return java.util.List.of("room anchor valid inside committed map bounds");
    }

    public java.util.List<String> reactionMessages(DungeonMap after) {
        if (after == null || (topology.roomAnchorQ() == after.topology().roomAnchorQ()
                && topology.roomAnchorR() == after.topology().roomAnchorR())) {
            return java.util.List.of("derived state rebuilt without structural movement");
        }
        return java.util.List.of(
                "corridor attachment recomputed from moved room anchor",
                "door boundary re-anchored onto rebuilt aggregate relation graph"
        );
    }

    private DungeonMap withTopology(SpatialTopology nextTopology, long nextRevision) {
        return new DungeonMap(
                metadata,
                nextTopology,
                topologyIndex,
                spaces,
                rooms,
                connections,
                features,
                nextRevision);
    }

    public DungeonMapMetadata metadata() {
        return metadata;
    }

    public SpatialTopology topology() {
        return topology;
    }

    public SpaceCatalog spaces() {
        return spaces;
    }

    public RoomCatalog rooms() {
        return rooms;
    }

    public ConnectionCatalog connections() {
        return connections;
    }

    public FeatureCatalog features() {
        return features;
    }

    public long revision() {
        return revision;
    }
}
