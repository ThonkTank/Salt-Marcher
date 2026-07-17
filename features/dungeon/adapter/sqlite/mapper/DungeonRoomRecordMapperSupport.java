package features.dungeon.adapter.sqlite.mapper;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import features.dungeon.adapter.sqlite.model.DungeonRoomExitDescriptionRecord;
import features.dungeon.adapter.sqlite.model.DungeonRoomFloorRecord;
import features.dungeon.adapter.sqlite.model.DungeonRoomRecord;
import features.dungeon.adapter.sqlite.model.DungeonRoomClusterRecord;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Direction;
import features.dungeon.domain.core.structure.room.RoomRegion;
import features.dungeon.domain.core.structure.room.RoomCluster;
import features.dungeon.domain.core.structure.room.RoomClusterRoomPartition;
import features.dungeon.domain.core.structure.room.RoomClusterGeometry;
import features.dungeon.domain.core.structure.room.DungeonRoomExitDescription;
import features.dungeon.domain.core.structure.room.DungeonRoomNarration;

final class DungeonRoomRecordMapperSupport {

    private DungeonRoomRecordMapperSupport() {
    }

    static List<RoomRegion> toRooms(List<DungeonRoomRecord> records) {
        List<RoomRegion> result = new ArrayList<>();
        for (DungeonRoomRecord record : records == null ? List.<DungeonRoomRecord>of() : records) {
            result.add(new RoomRegion(
                    record.roomId(),
                    record.mapId(),
                    record.clusterId(),
                    record.name(),
                    floorAnchors(record),
                    new DungeonRoomNarration(
                            record.visualDescription(),
                            exitDescriptions(record.levelZ(), record.exitDescriptions()))));
        }
        return List.copyOf(result);
    }

    static List<RoomRegion> assignLegacyClusterFloorCells(
            List<RoomRegion> roomSeeds,
            List<RoomCluster> clusters,
            List<DungeonRoomClusterRecord> clusterRecords
    ) {
        List<RoomRegion> result = new ArrayList<>();
        for (RoomCluster cluster : clusters == null ? List.<RoomCluster>of() : clusters) {
            List<RoomRegion> clusterRooms = (roomSeeds == null ? List.<RoomRegion>of() : roomSeeds).stream()
                    .filter(room -> room.clusterId() == cluster.clusterId())
                    .toList();
            DungeonRoomClusterRecord clusterRecord = (clusterRecords == null
                    ? List.<DungeonRoomClusterRecord>of()
                    : clusterRecords).stream()
                    .filter(record -> record.clusterId() == cluster.clusterId())
                    .findFirst()
                    .orElse(null);
            RoomClusterGeometry legacyGeometry = clusterRecord == null
                    ? RoomClusterGeometry.fromCells(cluster.clusterId(), cluster.mapId(), Set.of(cluster.center()))
                    : new RoomClusterGeometry(
                            cluster.clusterId(),
                            cluster.mapId(),
                            cluster.center(),
                            DungeonClusterFloorCellRecordMapperSupport.floorMap(clusterRecord));
            Map<Long, List<Cell>> cellsByRoom = RoomClusterRoomPartition.cellsByRoom(
                    legacyGeometry,
                    clusterRooms,
                    cluster.closedBoundaryEdgesByLevel());
            for (RoomRegion room : clusterRooms) {
                result.add(room.withFloorCells(cellsByRoom.getOrDefault(
                        room.roomId(),
                        List.copyOf(room.floorCells()))));
            }
        }
        Set<Long> assignedIds = result.stream().map(RoomRegion::roomId)
                .collect(java.util.stream.Collectors.toSet());
        for (RoomRegion room : roomSeeds == null ? List.<RoomRegion>of() : roomSeeds) {
            if (!assignedIds.contains(room.roomId())) {
                result.add(room);
            }
        }
        return List.copyOf(result);
    }

    static List<DungeonRoomRecord> toRoomRecords(
            List<RoomRegion> rooms,
            List<RoomCluster> clusters
    ) {
        List<DungeonRoomRecord> result = new ArrayList<>();
        for (RoomRegion room : rooms == null ? List.<RoomRegion>of() : rooms) {
            Map<Integer, Cell> storageAnchors = storageAnchors(room, clusters);
            int primaryLevel = primaryLevel(storageAnchors);
            Cell primaryAnchor = storageAnchors.getOrDefault(primaryLevel, new Cell(0, 0, 0));
            result.add(new DungeonRoomRecord(
                    room.roomId(),
                    room.mapId(),
                    room.clusterId(),
                    room.name(),
                    room.narration().visualDescription(),
                    primaryAnchor.q(),
                    primaryAnchor.r(),
                    primaryLevel,
                    toFloorRecords(room.roomId(), storageAnchors, primaryLevel),
                    toExitDescriptionRecords(room.roomId(), room.narration().exitDescriptions())));
        }
        return List.copyOf(result);
    }

    private static Map<Integer, Cell> storageAnchors(
            RoomRegion room,
            List<RoomCluster> clusters
    ) {
        Map<Integer, Cell> result = new LinkedHashMap<>(room.floorAnchors());
        for (RoomCluster cluster : clusters == null ? List.<RoomCluster>of() : clusters) {
            if (cluster.clusterId() == room.clusterId() && room.floorCells().contains(cluster.center())) {
                result.put(cluster.center().level(), cluster.center());
                break;
            }
        }
        return Map.copyOf(result);
    }

    private static int primaryLevel(Map<Integer, Cell> anchors) {
        return anchors.keySet().stream().mapToInt(Integer::intValue).min().orElse(0);
    }

    private static List<DungeonRoomFloorRecord> toFloorRecords(
            long roomId,
            Map<Integer, Cell> floorAnchors,
            int primaryLevel
    ) {
        List<DungeonRoomFloorRecord> result = new ArrayList<>();
        for (Map.Entry<Integer, Cell> entry : floorAnchors.entrySet()) {
            if (entry.getKey() == primaryLevel) {
                continue;
            }
            Cell anchor = entry.getValue();
            result.add(new DungeonRoomFloorRecord(roomId, entry.getKey(), anchor.q(), anchor.r()));
        }
        return List.copyOf(result);
    }

    private static List<DungeonRoomExitDescriptionRecord> toExitDescriptionRecords(
            long roomId,
            List<DungeonRoomExitDescription> exitDescriptions
    ) {
        List<DungeonRoomExitDescriptionRecord> result = new ArrayList<>();
        for (DungeonRoomExitDescription exitDescription
                : exitDescriptions == null ? List.<DungeonRoomExitDescription>of() : exitDescriptions) {
            result.add(new DungeonRoomExitDescriptionRecord(
                    roomId,
                    exitDescription.roomCell().q(),
                    exitDescription.roomCell().r(),
                    exitDescription.direction().name(),
                    exitDescription.description()));
        }
        return List.copyOf(result);
    }

    private static Map<Integer, Cell> floorAnchors(DungeonRoomRecord room) {
        Map<Integer, Cell> result = new LinkedHashMap<>();
        result.put(room.levelZ(), new Cell(room.componentX(), room.componentY(), room.levelZ()));
        for (DungeonRoomFloorRecord floor : room.floors()) {
            result.put(floor.levelZ(), new Cell(floor.anchorX(), floor.anchorY(), floor.levelZ()));
        }
        return Collections.unmodifiableMap(result);
    }

    private static List<DungeonRoomExitDescription> exitDescriptions(
            int level,
            List<DungeonRoomExitDescriptionRecord> records
    ) {
        List<DungeonRoomExitDescription> result = new ArrayList<>();
        for (DungeonRoomExitDescriptionRecord record
                : records == null ? List.<DungeonRoomExitDescriptionRecord>of() : records) {
            result.add(new DungeonRoomExitDescription(
                    new Cell(record.cellX(), record.cellY(), level),
                    Direction.parse(record.edgeDirection()),
                    record.description()));
        }
        return List.copyOf(result);
    }
}
