package src.data.dungeon.mapper;

import org.jspecify.annotations.Nullable;
import src.data.dungeon.model.DungeonClusterBoundaryRecord;
import src.data.dungeon.model.DungeonMapRecord;
import src.data.dungeon.model.DungeonRoomClusterRecord;
import src.data.dungeon.model.DungeonRoomClusterVertexRecord;
import src.data.dungeon.model.DungeonRoomExitDescriptionRecord;
import src.data.dungeon.model.DungeonRoomFloorRecord;
import src.data.dungeon.model.DungeonRoomRecord;
import src.data.dungeon.model.DungeonTopologyElementRecord;
import src.data.dungeon.model.DungeonTopologySeedRecord;
import src.domain.dungeon.map.aggregate.DungeonMap;
import src.domain.dungeon.map.entity.DungeonRoom;
import src.domain.dungeon.map.entity.DungeonRoomCluster;
import src.domain.dungeon.map.value.ConnectionCatalog;
import src.domain.dungeon.map.value.DungeonCell;
import src.domain.dungeon.map.value.DungeonClusterBoundary;
import src.domain.dungeon.map.value.DungeonClusterBoundaryKind;
import src.domain.dungeon.map.value.DungeonEdgeDirection;
import src.domain.dungeon.map.value.DungeonMapIdentity;
import src.domain.dungeon.map.value.DungeonMapTopology;
import src.domain.dungeon.map.value.DungeonRoomExitDescription;
import src.domain.dungeon.map.value.DungeonRoomNarration;
import src.domain.dungeon.map.value.DungeonTopology;
import src.domain.dungeon.map.value.DungeonTopologyElementKind;
import src.domain.dungeon.map.value.DungeonTopologyRef;
import src.domain.dungeon.map.value.RoomCatalog;
import src.domain.dungeon.map.value.SpatialTopology;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Maps source-local dungeon rows into the domain aggregate.
 */
public final class DungeonMapRecordMapper {

    private DungeonMapRecordMapper() {
    }

    public static DungeonMap toDomain(DungeonMapRecord record) {
        DungeonMapRecord resolvedRecord = record == null
                ? new DungeonMapRecord(1L, "Dungeon Bastion", 1L, DungeonTopologySeedRecord.demo())
                : record;
        DungeonTopologySeedRecord seed = resolvedRecord.topologySeed();
        List<DungeonRoomCluster> clusters = toClusters(resolvedRecord.roomClusters());
        RoomCatalog rooms = new RoomCatalog(toRooms(resolvedRecord.rooms()));
        ConnectionCatalog connections = DungeonConnectionRecordMapper.toConnectionCatalog(resolvedRecord);
        DungeonMapTopology topologyIndex = toTopologyIndex(resolvedRecord.topologyElements());
        return DungeonMap.authored(
                new DungeonMapIdentity(resolvedRecord.mapId()),
                resolvedRecord.name(),
                new SpatialTopology(
                        DungeonTopology.SQUARE,
                        seed.width(),
                        seed.height(),
                        seed.roomAnchorQ(),
                        seed.roomAnchorR(),
                        clusters),
                topologyIndex,
                rooms,
                connections,
                resolvedRecord.revision());
    }

    public static DungeonMapRecord toRecord(DungeonMap dungeonMap) {
        SpatialTopology topology = dungeonMap == null ? SpatialTopology.demo() : dungeonMap.topology();
        long mapId = dungeonMap == null ? 1L : dungeonMap.metadata().mapId().value();
        return new DungeonMapRecord(
                mapId,
                dungeonMap == null ? "Dungeon Bastion" : dungeonMap.metadata().mapName(),
                dungeonMap == null ? 1L : dungeonMap.revision(),
                new DungeonTopologySeedRecord(
                        topology.width(),
                        topology.height(),
                        topology.roomAnchorQ(),
                        topology.roomAnchorR()),
                toClusterRecords(topology.roomClusters()),
                toRoomRecords(dungeonMap == null ? List.of() : dungeonMap.rooms().rooms()),
                toTopologyElementRecords(mapId, dungeonMap == null
                        ? DungeonMapTopology.from(topology, RoomCatalog.empty(), ConnectionCatalog.empty())
                        : dungeonMap.topologyIndex()),
                DungeonConnectionRecordMapper.toCorridorRecords(dungeonMap == null
                        ? ConnectionCatalog.empty()
                        : dungeonMap.connections()),
                DungeonConnectionRecordMapper.toStairRecords(dungeonMap == null
                        ? ConnectionCatalog.empty()
                        : dungeonMap.connections()),
                DungeonConnectionRecordMapper.toTransitionRecords(dungeonMap == null
                        ? ConnectionCatalog.empty()
                        : dungeonMap.connections()));
    }

    private static List<DungeonRoomCluster> toClusters(List<DungeonRoomClusterRecord> records) {
        List<DungeonRoomCluster> result = new ArrayList<>();
        for (DungeonRoomClusterRecord record : records == null ? List.<DungeonRoomClusterRecord>of() : records) {
            result.add(new DungeonRoomCluster(
                    record.clusterId(),
                    record.mapId(),
                    new DungeonCell(record.centerX(), record.centerY(), record.levelZ()),
                    verticesByLevel(record.vertices()),
                    boundariesByLevel(record.boundaries())));
        }
        return List.copyOf(result);
    }

    private static Map<Integer, List<DungeonCell>> verticesByLevel(List<DungeonRoomClusterVertexRecord> records) {
        Map<Integer, List<DungeonCell>> result = new LinkedHashMap<>();
        for (DungeonRoomClusterVertexRecord record
                : records == null ? List.<DungeonRoomClusterVertexRecord>of() : records) {
            result.computeIfAbsent(record.levelZ(), ignored -> new ArrayList<>())
                    .add(new DungeonCell(record.relativeX(), record.relativeY(), record.levelZ()));
        }
        return copyNestedLists(result);
    }

    private static Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel(
            List<DungeonClusterBoundaryRecord> records
    ) {
        Map<Integer, List<DungeonClusterBoundary>> result = new LinkedHashMap<>();
        for (DungeonClusterBoundaryRecord record
                : records == null ? List.<DungeonClusterBoundaryRecord>of() : records) {
            result.computeIfAbsent(record.levelZ(), ignored -> new ArrayList<>())
                    .add(new DungeonClusterBoundary(
                            record.clusterId(),
                            record.levelZ(),
                            new DungeonCell(record.cellX(), record.cellY(), record.levelZ()),
                            DungeonEdgeDirection.parse(record.edgeDirection()),
                            DungeonClusterBoundaryKind.parse(record.edgeType()),
                            topologyRef(record.edgeType(), record.topologyElementId())));
        }
        return copyNestedLists(result);
    }

    private static List<DungeonRoom> toRooms(List<DungeonRoomRecord> records) {
        List<DungeonRoom> result = new ArrayList<>();
        for (DungeonRoomRecord record : records == null ? List.<DungeonRoomRecord>of() : records) {
            result.add(new DungeonRoom(
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

    private static List<DungeonRoomClusterRecord> toClusterRecords(List<DungeonRoomCluster> clusters) {
        List<DungeonRoomClusterRecord> result = new ArrayList<>();
        for (DungeonRoomCluster cluster : clusters == null ? List.<DungeonRoomCluster>of() : clusters) {
            result.add(new DungeonRoomClusterRecord(
                    cluster.clusterId(),
                    cluster.mapId(),
                    cluster.center().q(),
                    cluster.center().r(),
                    cluster.center().level(),
                    toVertexRecords(cluster.clusterId(), cluster.relativeVerticesByLevel()),
                    toBoundaryRecords(cluster, cluster.boundariesByLevel())));
        }
        return List.copyOf(result);
    }

    private static List<DungeonRoomClusterVertexRecord> toVertexRecords(
            long clusterId,
            Map<Integer, List<DungeonCell>> verticesByLevel
    ) {
        List<DungeonRoomClusterVertexRecord> result = new ArrayList<>();
        for (Map.Entry<Integer, List<DungeonCell>> entry
                : (verticesByLevel == null ? Map.<Integer, List<DungeonCell>>of() : verticesByLevel).entrySet()) {
            int index = 0;
            for (DungeonCell vertex : entry.getValue()) {
                result.add(new DungeonRoomClusterVertexRecord(
                        clusterId,
                        entry.getKey(),
                        index++,
                        vertex.q(),
                        vertex.r()));
            }
        }
        return List.copyOf(result);
    }

    private static List<DungeonClusterBoundaryRecord> toBoundaryRecords(
            DungeonRoomCluster cluster,
            Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel
    ) {
        List<DungeonClusterBoundaryRecord> result = new ArrayList<>();
        for (Map.Entry<Integer, List<DungeonClusterBoundary>> entry
                : (boundariesByLevel == null ? Map.<Integer, List<DungeonClusterBoundary>>of() : boundariesByLevel)
                        .entrySet()) {
            for (DungeonClusterBoundary boundary : entry.getValue()) {
                result.add(new DungeonClusterBoundaryRecord(
                        cluster.clusterId(),
                        entry.getKey(),
                        boundary.relativeCell().q(),
                        boundary.relativeCell().r(),
                        boundary.direction().name(),
                        boundary.kind().name(),
                        boundary.resolvedTopologyRef(cluster.center()).id()));
            }
        }
        return List.copyOf(result);
    }

    private static DungeonMapTopology toTopologyIndex(List<DungeonTopologyElementRecord> records) {
        List<DungeonMapTopology.DungeonTopologyBinding> bindings = new ArrayList<>();
        for (DungeonTopologyElementRecord record
                : records == null ? List.<DungeonTopologyElementRecord>of() : records) {
            DungeonTopologyElementKind kind = topologyKind(record.elementKind());
            if (kind == DungeonTopologyElementKind.EMPTY || record.elementId() <= 0L) {
                continue;
            }
            bindings.add(new DungeonMapTopology.DungeonTopologyBinding(
                    new DungeonTopologyRef(kind, record.elementId()),
                    record.clusterId() == null ? 0L : record.clusterId(),
                    record.corridorId() == null ? 0L : record.corridorId(),
                    record.label()));
        }
        return new DungeonMapTopology(bindings);
    }

    private static List<DungeonTopologyElementRecord> toTopologyElementRecords(
            long mapId,
            DungeonMapTopology topologyIndex
    ) {
        List<DungeonTopologyElementRecord> result = new ArrayList<>();
        Set<DungeonTopologyRef> seen = new LinkedHashSet<>();
        int sortOrder = 0;
        for (DungeonMapTopology.DungeonTopologyBinding binding
                : topologyIndex == null ? List.<DungeonMapTopology.DungeonTopologyBinding>of()
                        : topologyIndex.bindings()) {
            if (!binding.ref().present() || !seen.add(binding.ref())) {
                continue;
            }
            result.add(new DungeonTopologyElementRecord(
                    mapId,
                    binding.ref().kind().name(),
                    binding.ref().id(),
                    binding.clusterId() <= 0L ? null : binding.clusterId(),
                    binding.corridorId() <= 0L ? null : binding.corridorId(),
                    binding.label(),
                    sortOrder++));
        }
        return List.copyOf(result);
    }

    private static DungeonTopologyRef topologyRef(String edgeType, @Nullable Long topologyElementId) {
        if (topologyElementId == null || topologyElementId <= 0L) {
            return DungeonTopologyRef.empty();
        }
        return new DungeonTopologyRef(
                DungeonTopologyElementKind.fromBoundaryKind(edgeType),
                topologyElementId);
    }

    private static DungeonTopologyElementKind topologyKind(String value) {
        if (value == null || value.isBlank()) {
            return DungeonTopologyElementKind.EMPTY;
        }
        try {
            return DungeonTopologyElementKind.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            return DungeonTopologyElementKind.EMPTY;
        }
    }

    private static List<DungeonRoomRecord> toRoomRecords(List<DungeonRoom> rooms) {
        List<DungeonRoomRecord> result = new ArrayList<>();
        for (DungeonRoom room : rooms == null ? List.<DungeonRoom>of() : rooms) {
            int primaryLevel = room.primaryLevel();
            DungeonCell primaryAnchor = room.primaryAnchor();
            result.add(new DungeonRoomRecord(
                    room.roomId(),
                    room.mapId(),
                    room.clusterId(),
                    room.name(),
                    room.narration().visualDescription(),
                    primaryAnchor.q(),
                    primaryAnchor.r(),
                    primaryLevel,
                    toFloorRecords(room.roomId(), room.floorAnchors(), primaryLevel),
                    toExitDescriptionRecords(room.roomId(), room.narration().exitDescriptions())));
        }
        return List.copyOf(result);
    }

    private static List<DungeonRoomFloorRecord> toFloorRecords(
            long roomId,
            Map<Integer, DungeonCell> floorAnchors,
            int primaryLevel
    ) {
        List<DungeonRoomFloorRecord> result = new ArrayList<>();
        for (Map.Entry<Integer, DungeonCell> entry : floorAnchors.entrySet()) {
            if (entry.getKey() == primaryLevel) {
                continue;
            }
            DungeonCell anchor = entry.getValue();
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

    private static Map<Integer, DungeonCell> floorAnchors(DungeonRoomRecord room) {
        Map<Integer, DungeonCell> result = new LinkedHashMap<>();
        result.put(room.levelZ(), new DungeonCell(room.componentX(), room.componentY(), room.levelZ()));
        for (DungeonRoomFloorRecord floor : room.floors()) {
            result.put(floor.levelZ(), new DungeonCell(floor.anchorX(), floor.anchorY(), floor.levelZ()));
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
                    new DungeonCell(record.cellX(), record.cellY(), level),
                    DungeonEdgeDirection.parse(record.edgeDirection()),
                    record.description()));
        }
        return List.copyOf(result);
    }

    private static <T> Map<Integer, List<T>> copyNestedLists(Map<Integer, List<T>> source) {
        Map<Integer, List<T>> result = new LinkedHashMap<>();
        for (Map.Entry<Integer, List<T>> entry : source.entrySet()) {
            result.put(entry.getKey(), List.copyOf(entry.getValue()));
        }
        return Map.copyOf(result);
    }
}
