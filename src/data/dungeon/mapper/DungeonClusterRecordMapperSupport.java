package src.data.dungeon.mapper;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import src.data.dungeon.model.DungeonClusterBoundaryRecord;
import src.data.dungeon.model.DungeonRoomClusterRecord;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Direction;
import src.domain.dungeon.model.core.structure.room.DungeonClusterBoundary;
import src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryKind;
import src.domain.dungeon.model.core.structure.room.DungeonRoomCluster;

final class DungeonClusterRecordMapperSupport {

    private DungeonClusterRecordMapperSupport() {
    }

    static List<DungeonRoomCluster> toClusters(List<DungeonRoomClusterRecord> records) {
        List<DungeonRoomCluster> result = new ArrayList<>();
        for (DungeonRoomClusterRecord record : records == null ? List.<DungeonRoomClusterRecord>of() : records) {
            result.add(DungeonRoomCluster.fromCompatibilityInput(
                    record.clusterId(),
                    record.mapId(),
                    record.name(),
                    new Cell(record.centerX(), record.centerY(), record.levelZ()),
                    DungeonClusterFloorCellRecordMapperSupport.compatibleRelativeLoopsByLevel(record),
                    DungeonClusterFloorCellRecordMapperSupport.floorMap(record),
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
                    cluster.name(),
                    cluster.center().q(),
                    cluster.center().r(),
                    cluster.center().level(),
                    List.of(),
                    DungeonClusterFloorCellRecordMapperSupport.toFloorCellRecords(cluster.clusterId(), cluster),
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

    private static List<DungeonClusterBoundaryRecord> toBoundaryRecords(DungeonRoomCluster cluster) {
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
