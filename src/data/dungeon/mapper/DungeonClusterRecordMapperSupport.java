package src.data.dungeon.mapper;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import src.data.dungeon.model.DungeonClusterBoundaryRecord;
import src.data.dungeon.model.DungeonRoomClusterRecord;
import src.data.dungeon.model.DungeonRoomClusterVertexRecord;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Direction;
import src.domain.dungeon.model.worldspace.DungeonClusterBoundary;
import src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryKind;
import src.domain.dungeon.model.worldspace.DungeonRoomCluster;

final class DungeonClusterRecordMapperSupport {

    private DungeonClusterRecordMapperSupport() {
    }

    static List<DungeonRoomCluster> toClusters(List<DungeonRoomClusterRecord> records) {
        List<DungeonRoomCluster> result = new ArrayList<>();
        for (DungeonRoomClusterRecord record : records == null ? List.<DungeonRoomClusterRecord>of() : records) {
            result.add(new DungeonRoomCluster(
                    record.clusterId(),
                    record.mapId(),
                    new Cell(record.centerX(), record.centerY(), record.levelZ()),
                    verticesByLevel(record.vertices()),
                    boundariesByLevel(record.boundaries())));
        }
        return List.copyOf(result);
    }

    static List<DungeonRoomClusterRecord> toClusterRecords(List<DungeonRoomCluster> clusters) {
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

    private static Map<Integer, List<Cell>> verticesByLevel(List<DungeonRoomClusterVertexRecord> records) {
        Map<Integer, List<Cell>> result = new LinkedHashMap<>();
        for (DungeonRoomClusterVertexRecord record
                : records == null ? List.<DungeonRoomClusterVertexRecord>of() : records) {
            result.computeIfAbsent(record.levelZ(), ignored -> new ArrayList<>())
                    .add(new Cell(record.relativeX(), record.relativeY(), record.levelZ()));
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
                            new Cell(record.cellX(), record.cellY(), record.levelZ()),
                            Direction.parse(record.edgeDirection()),
                            BoundaryKind.parse(record.edgeType()),
                            DungeonTopologyElementRecordMapperSupport.topologyRef(
                                    record.edgeType(),
                                    record.topologyElementId())));
        }
        return copyNestedLists(result);
    }

    private static List<DungeonRoomClusterVertexRecord> toVertexRecords(
            long clusterId,
            Map<Integer, List<Cell>> verticesByLevel
    ) {
        List<DungeonRoomClusterVertexRecord> result = new ArrayList<>();
        for (Map.Entry<Integer, List<Cell>> entry
                : (verticesByLevel == null ? Map.<Integer, List<Cell>>of() : verticesByLevel).entrySet()) {
            int index = 0;
            for (Cell vertex : entry.getValue()) {
                result.add(new DungeonRoomClusterVertexRecord(
                        clusterId,
                        entry.getKey(),
                        index,
                        vertex.q(),
                        vertex.r()));
                index++;
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
                        boundary.kind().renderable() ? boundary.resolvedTopologyRef(cluster.center()).id() : null));
            }
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
