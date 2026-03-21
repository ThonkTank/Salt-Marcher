package features.world.dungeonmap.model;

import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.corridor.CorridorNetwork;
import features.world.dungeonmap.model.structures.corridor.CorridorPlanningInput;
import features.world.dungeonmap.model.structures.room.Room;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class DungeonLayout {

    private static final DungeonLayout EMPTY = new DungeonLayout(0L, "Kein Dungeon", List.of(), List.of());

    private final long mapId;
    private final String name;
    private final List<Corridor> corridors;
    private final List<RoomCluster> clusters;
    // Layout is only the global aggregation/query surface over self-managed structures.
    private final List<CorridorNetwork> corridorNetworks;
    private final Map<Long, Room> roomsById;
    private final Map<Long, Corridor> corridorsById;
    private final Map<Long, RoomCluster> clustersById;
    private final Map<String, CorridorNetwork> corridorNetworksById;
    private final Map<Long, String> corridorNetworkIdByCorridorId;
    private final Map<Point2i, List<Long>> corridorIdsByCell;
    private final Map<Point2i, String> corridorNetworkIdByCell;

    public DungeonLayout(
            long mapId,
            String name,
            List<Corridor> corridors,
            List<RoomCluster> clusters
    ) {
        this.mapId = mapId;
        this.name = name == null || name.isBlank() ? "Dungeon " + mapId : name;
        this.corridors = corridors == null ? List.of() : List.copyOf(corridors);
        this.clusters = clusters == null ? List.of() : List.copyOf(clusters);
        this.corridorNetworks = CorridorNetwork.buildNetworks(mapId, this.corridors);
        this.roomsById = indexRooms(this.clusters);
        this.corridorsById = indexCorridors(this.corridors);
        this.clustersById = indexClusters(this.clusters);
        this.corridorNetworksById = indexCorridorNetworks(this.corridorNetworks);
        this.corridorNetworkIdByCorridorId = indexCorridorNetworkIdsByCorridorId(this.corridorNetworks);
        this.corridorIdsByCell = indexCorridorIdsByCell(this.corridors);
        this.corridorNetworkIdByCell = indexCorridorNetworkIdsByCell(this.corridorNetworks);
    }

    public static DungeonLayout empty() {
        return EMPTY;
    }

    public long mapId() {
        return mapId;
    }

    public String name() {
        return name;
    }

    public List<Room> rooms() {
        return clusters.stream()
                .flatMap(cluster -> cluster.rooms().stream())
                .toList();
    }

    public List<Corridor> corridors() {
        return corridors;
    }

    public List<RoomCluster> clusters() {
        return clusters;
    }

    public List<RoomCluster> overlappingClusters(features.world.dungeonmap.model.geometry.TileShape shape) {
        if (shape == null || shape.size() == 0) {
            return List.of();
        }
        return clusters.stream()
                .filter(cluster -> cluster != null && cluster.overlaps(shape))
                .toList();
    }

    public List<CorridorNetwork> corridorNetworks() {
        return corridorNetworks;
    }

    public Room findRoom(Long roomId) {
        return roomId == null ? null : roomsById.get(roomId);
    }

    public Corridor findCorridor(Long corridorId) {
        return corridorId == null ? null : corridorsById.get(corridorId);
    }

    public RoomCluster findCluster(Long clusterId) {
        return clusterId == null ? null : clustersById.get(clusterId);
    }

    public CorridorNetwork corridorNetworkForCorridor(Long corridorId) {
        String networkId = corridorId == null ? null : corridorNetworkIdByCorridorId.get(corridorId);
        return networkId == null ? null : corridorNetworksById.get(networkId);
    }

    public RoomCluster clusterForRoom(Long roomId) {
        Room room = findRoom(roomId);
        return room == null ? null : findCluster(room.clusterId());
    }

    public Room roomAtCell(Point2i cell) {
        for (RoomCluster cluster : clusters) {
            if (cluster.contains(cell)) {
                return cluster.roomAt(cell);
            }
        }
        return null;
    }

    public RoomCluster clusterAtCell(Point2i cell) {
        for (RoomCluster cluster : clusters) {
            if (cluster.contains(cell)) {
                return cluster;
            }
        }
        return null;
    }

    public List<Corridor> corridorsAtCell(Point2i cell) {
        List<Long> corridorIds = cell == null ? List.of() : corridorIdsByCell.getOrDefault(cell, List.of());
        return corridorIds.stream()
                .map(this::findCorridor)
                .filter(corridor -> corridor != null)
                .toList();
    }

    public CorridorNetwork corridorNetworkAtCell(Point2i cell) {
        String networkId = cell == null ? null : corridorNetworkIdByCell.get(cell);
        return networkId == null ? null : corridorNetworksById.get(networkId);
    }

    public boolean hasDependentCorridors(RoomCluster cluster) {
        if (cluster == null || cluster.clusterId() == null) {
            return false;
        }
        return corridors.stream()
                .anyMatch(corridor -> corridor.dependsOnCluster(cluster.clusterId())
                        || corridor.dependsOnAnyRoom(cluster.roomIds()));
    }

    public CorridorPlanningInput corridorPlanningInput() {
        Map<Long, Point2i> clusterCenters = new LinkedHashMap<>();
        for (RoomCluster cluster : clusters) {
            if (cluster != null && cluster.clusterId() != null) {
                clusterCenters.put(cluster.clusterId(), cluster.center());
            }
        }
        return new CorridorPlanningInput(roomsById, clusterCenters);
    }

    public DungeonLayout withReplacedCluster(RoomCluster cluster) {
        if (cluster == null || cluster.clusterId() == null) {
            return this;
        }
        List<RoomCluster> updatedClusters = clusters.stream()
                .map(existing -> cluster.clusterId().equals(existing.clusterId()) ? cluster : existing)
                .toList();
        return new DungeonLayout(mapId, name, corridors, updatedClusters);
    }

    public DungeonLayout withTranslatedCluster(Long clusterId, Point2i delta) {
        if (clusterId == null || delta == null || (delta.x() == 0 && delta.y() == 0)) {
            return this;
        }
        RoomCluster cluster = findCluster(clusterId);
        if (cluster == null) {
            return this;
        }
        RoomCluster movedCluster = cluster.movedBy(delta);
        DungeonLayout movedLayout = withReplacedCluster(movedCluster);
        List<Corridor> updatedCorridors = corridors.stream()
                .map(corridor -> corridor.dependsOnCluster(clusterId) || corridor.dependsOnAnyRoom(movedCluster.roomIds())
                        ? corridor.replanned(movedLayout.corridorPlanningInput())
                        : corridor)
                .toList();
        return new DungeonLayout(mapId, name, updatedCorridors, movedLayout.clusters());
    }

    private static Map<Long, Room> indexRooms(List<RoomCluster> clusters) {
        Map<Long, Room> result = new LinkedHashMap<>();
        for (RoomCluster cluster : clusters) {
            if (cluster == null) {
                continue;
            }
            for (Room room : cluster.rooms()) {
                if (room != null && room.roomId() != null) {
                    result.put(room.roomId(), room);
                }
            }
        }
        return Map.copyOf(result);
    }

    private static Map<Long, RoomCluster> indexClusters(List<RoomCluster> clusters) {
        Map<Long, RoomCluster> result = new LinkedHashMap<>();
        for (RoomCluster cluster : clusters) {
            if (cluster != null && cluster.clusterId() != null) {
                result.put(cluster.clusterId(), cluster);
            }
        }
        return Map.copyOf(result);
    }

    private static Map<Long, Corridor> indexCorridors(List<Corridor> corridors) {
        Map<Long, Corridor> result = new LinkedHashMap<>();
        for (Corridor corridor : corridors) {
            if (corridor != null && corridor.corridorId() != null) {
                result.put(corridor.corridorId(), corridor);
            }
        }
        return Map.copyOf(result);
    }

    private static Map<String, CorridorNetwork> indexCorridorNetworks(List<CorridorNetwork> networks) {
        Map<String, CorridorNetwork> result = new LinkedHashMap<>();
        for (CorridorNetwork network : networks) {
            if (network != null && network.networkId() != null) {
                result.put(network.networkId(), network);
            }
        }
        return Map.copyOf(result);
    }

    private static Map<Long, String> indexCorridorNetworkIdsByCorridorId(List<CorridorNetwork> networks) {
        Map<Long, String> result = new LinkedHashMap<>();
        for (CorridorNetwork network : networks) {
            if (network == null || network.networkId() == null) {
                continue;
            }
            for (Long corridorId : network.corridorIds()) {
                if (corridorId != null) {
                    result.put(corridorId, network.networkId());
                }
            }
        }
        return Map.copyOf(result);
    }

    private static Map<Point2i, List<Long>> indexCorridorIdsByCell(List<Corridor> corridors) {
        Map<Point2i, List<Long>> mutable = new LinkedHashMap<>();
        for (Corridor corridor : corridors) {
            if (corridor == null || corridor.corridorId() == null || corridor.path() == null) {
                continue;
            }
            for (Point2i cell : corridor.path().floor().shape().absoluteCells()) {
                mutable.computeIfAbsent(cell, ignored -> new java.util.ArrayList<>()).add(corridor.corridorId());
            }
        }
        Map<Point2i, List<Long>> result = new LinkedHashMap<>();
        for (Map.Entry<Point2i, List<Long>> entry : mutable.entrySet()) {
            result.put(entry.getKey(), List.copyOf(entry.getValue()));
        }
        return Map.copyOf(result);
    }

    private static Map<Point2i, String> indexCorridorNetworkIdsByCell(List<CorridorNetwork> networks) {
        Map<Point2i, String> result = new LinkedHashMap<>();
        for (CorridorNetwork network : networks) {
            if (network == null || network.networkId() == null) {
                continue;
            }
            for (Point2i cell : network.floor().shape().absoluteCells()) {
                result.put(cell, network.networkId());
            }
        }
        return Map.copyOf(result);
    }
}
