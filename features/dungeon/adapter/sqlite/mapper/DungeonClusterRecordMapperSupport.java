package features.dungeon.adapter.sqlite.mapper;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import features.dungeon.adapter.sqlite.model.DungeonClusterBoundaryRecord;
import features.dungeon.adapter.sqlite.model.DungeonRoomClusterRecord;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Direction;
import features.dungeon.domain.core.structure.room.DungeonClusterBoundary;
import features.dungeon.domain.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryKind;
import features.dungeon.domain.core.structure.room.RoomCluster;
import features.dungeon.domain.core.structure.room.RoomRegion;

final class DungeonClusterRecordMapperSupport {

    private DungeonClusterRecordMapperSupport() {
    }

    static List<RoomCluster> toClusters(List<DungeonRoomClusterRecord> records) {
        List<RoomCluster> result = new ArrayList<>();
        for (DungeonRoomClusterRecord record : records == null ? List.<DungeonRoomClusterRecord>of() : records) {
            result.add(RoomCluster.authored(
                    record.clusterId(),
                    record.mapId(),
                    record.name(),
                    new Cell(record.centerX(), record.centerY(), record.levelZ()),
                    boundariesByLevel(record.boundaries())));
        }
        return List.copyOf(result);
    }

    static List<DungeonRoomClusterRecord> toClusterRecords(
            List<RoomCluster> clusters,
            List<RoomRegion> rooms
    ) {
        List<DungeonRoomClusterRecord> result = new ArrayList<>();
        for (RoomCluster cluster : clusters == null ? List.<RoomCluster>of() : clusters) {
            result.add(new DungeonRoomClusterRecord(
                    cluster.clusterId(),
                    cluster.mapId(),
                    cluster.name(),
                    cluster.center().q(),
                    cluster.center().r(),
                    cluster.center().level(),
                    DungeonClusterFloorCellRecordMapperSupport.toFloorCellRecords(cluster.clusterId(), rooms),
                    toBoundaryRecords(cluster)));
        }
        return List.copyOf(result);
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
        return DungeonNestedListMaps.immutableCopy(result);
    }

    private static List<DungeonClusterBoundaryRecord> toBoundaryRecords(RoomCluster cluster) {
        List<DungeonClusterBoundaryRecord> result = new ArrayList<>();
        for (DungeonClusterBoundary boundary : cluster.orderedBoundariesForWriteback()) {
            result.add(new DungeonClusterBoundaryRecord(
                    cluster.clusterId(),
                    boundary.level(),
                    boundary.relativeCell().q(),
                    boundary.relativeCell().r(),
                    boundary.direction().name(),
                    boundary.kind().name(),
                    boundary.kind().renderable() ? boundary.resolvedTopologyRef(cluster.center()).id() : null));
        }
        return List.copyOf(result);
    }

}
