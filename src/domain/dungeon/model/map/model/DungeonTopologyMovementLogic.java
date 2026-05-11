package src.domain.dungeon.model.map.model;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.OptionalLong;
import src.domain.dungeon.model.map.model.DungeonMap;
import src.domain.dungeon.model.map.model.DungeonRoom;
import src.domain.dungeon.model.map.model.DungeonRoomCluster;
import src.domain.dungeon.model.map.model.DungeonCell;
import src.domain.dungeon.model.map.model.DungeonClusterBoundary;
import src.domain.dungeon.model.map.model.DungeonTopologyRef;
import src.domain.dungeon.model.map.model.RoomCatalog;
import src.domain.dungeon.model.map.model.SpatialTopology;

/**
 * Owns authored topology movement while the aggregate stays the public mutation
 * boundary.
 */
public final class DungeonTopologyMovementLogic {

    public DungeonMap moveRoomAnchor(DungeonMap dungeonMap, int deltaQ, int deltaR) {
        Objects.requireNonNull(dungeonMap, "dungeonMap");
        if (deltaQ == 0 && deltaR == 0) {
            return dungeonMap;
        }
        return copyWithTopology(dungeonMap, dungeonMap.topology().moveRoomAnchor(deltaQ, deltaR), dungeonMap.revision() + 1L);
    }

    public DungeonMap moveTopologyElement(
            DungeonMap dungeonMap,
            DungeonTopologyRef ref,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        Objects.requireNonNull(dungeonMap, "dungeonMap");
        if (ref == null || !ref.present() || (deltaQ == 0 && deltaR == 0 && deltaLevel == 0)) {
            return dungeonMap;
        }
        OptionalLong clusterId = dungeonMap.topologyIndex().clusterIdFor(ref);
        return clusterId.isPresent() ? moveCluster(dungeonMap, clusterId.getAsLong(), deltaQ, deltaR, deltaLevel) : dungeonMap;
    }

    public DungeonMap moveCluster(DungeonMap dungeonMap, long clusterId, int deltaQ, int deltaR, int deltaLevel) {
        Objects.requireNonNull(dungeonMap, "dungeonMap");
        if (clusterId <= 0L || (deltaQ == 0 && deltaR == 0 && deltaLevel == 0)) {
            return dungeonMap;
        }
        SpatialTopology nextTopology = moveTopologyCluster(dungeonMap.topology(), clusterId, deltaQ, deltaR, deltaLevel);
        RoomCatalog nextRooms = moveRoomsForCluster(dungeonMap.rooms(), clusterId, deltaQ, deltaR, deltaLevel);
        if (nextTopology.equals(dungeonMap.topology()) && nextRooms.equals(dungeonMap.rooms())) {
            return dungeonMap;
        }
        return new DungeonMap(
                dungeonMap.metadata(),
                nextTopology,
                dungeonMap.topologyIndex(),
                dungeonMap.spaces(),
                nextRooms,
                dungeonMap.connections(),
                dungeonMap.features(),
                dungeonMap.revision() + 1L);
    }

    private static SpatialTopology moveTopologyCluster(
            SpatialTopology topology,
            long clusterId,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
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

    private static RoomCatalog moveRoomsForCluster(
            RoomCatalog rooms,
            long clusterId,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
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

    private static DungeonMap copyWithTopology(DungeonMap dungeonMap, SpatialTopology nextTopology, long nextRevision) {
        return new DungeonMap(
                dungeonMap.metadata(),
                nextTopology,
                dungeonMap.topologyIndex(),
                dungeonMap.spaces(),
                dungeonMap.rooms(),
                dungeonMap.connections(),
                dungeonMap.features(),
                nextRevision);
    }
}
