package features.dungeon.adapter.sqlite.mapper;

import features.dungeon.adapter.sqlite.model.DungeonClusterBoundaryRecord;
import features.dungeon.adapter.sqlite.model.DungeonRoomClusterRecord;
import features.dungeon.domain.core.component.boundary.BoundaryKind;
import features.dungeon.domain.core.component.boundary.BoundarySegment;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.CellOrdering;
import features.dungeon.domain.core.geometry.Direction;
import features.dungeon.domain.core.geometry.Edge;
import features.dungeon.domain.core.geometry.EdgeKey;
import features.dungeon.domain.core.structure.room.RoomCluster;
import features.dungeon.domain.core.structure.room.RoomRegion;
import java.util.ArrayList;
import java.util.List;

final class DungeonClusterRecordMapperSupport {

    private DungeonClusterRecordMapperSupport() {
    }

    static List<RoomCluster> toClusters(
            List<DungeonRoomClusterRecord> records,
            List<RoomRegion> rooms
    ) {
        List<RoomCluster> result = new ArrayList<>();
        for (DungeonRoomClusterRecord record : records == null ? List.<DungeonRoomClusterRecord>of() : records) {
            result.add(RoomCluster.authored(
                    record.clusterId(),
                    record.mapId(),
                    record.name(),
                    boundaries(record.boundaries())));
        }
        return List.copyOf(result);
    }

    static List<DungeonRoomClusterRecord> toClusterRecords(
            List<RoomCluster> clusters,
            List<RoomRegion> rooms
    ) {
        List<DungeonRoomClusterRecord> result = new ArrayList<>();
        for (RoomCluster cluster : clusters == null ? List.<RoomCluster>of() : clusters) {
            Cell derivedAnchor = derivedAnchor(cluster.clusterId(), rooms);
            result.add(new DungeonRoomClusterRecord(
                    cluster.clusterId(),
                    cluster.mapId(),
                    cluster.name(),
                    derivedAnchor.q(),
                    derivedAnchor.r(),
                    derivedAnchor.level(),
                    toBoundaryRecords(cluster)));
        }
        return List.copyOf(result);
    }

    private static List<BoundarySegment> boundaries(List<DungeonClusterBoundaryRecord> records) {
        List<BoundarySegment> result = new ArrayList<>();
        for (DungeonClusterBoundaryRecord record
                : records == null ? List.<DungeonClusterBoundaryRecord>of() : records) {
            Cell cell = new Cell(record.cellX(), record.cellY(), record.levelZ());
            Edge edge = Direction.parse(record.edgeDirection()).edgeOf(cell);
            result.add(BoundarySegment.fromEdge(
                    edge,
                    boundaryKind(record.edgeType()),
                    DungeonTopologyElementRecordMapperSupport.topologyRef(
                            record.edgeType(),
                            record.topologyElementId())));
        }
        return List.copyOf(result);
    }

    private static Cell derivedAnchor(long clusterId, List<RoomRegion> rooms) {
        List<Cell> cells = new ArrayList<>();
        for (RoomRegion room : rooms == null ? List.<RoomRegion>of() : rooms) {
            if (room.clusterId() == clusterId) {
                cells.addAll(room.floorCells());
            }
        }
        List<Cell> ordered = CellOrdering.sortedCells(cells);
        return ordered.isEmpty() ? new Cell(0, 0, 0) : ordered.getFirst();
    }

    private static List<DungeonClusterBoundaryRecord> toBoundaryRecords(RoomCluster cluster) {
        List<DungeonClusterBoundaryRecord> result = new ArrayList<>();
        for (BoundarySegment boundary : cluster.orderedBoundariesForWriteback()) {
            OrientedEdge oriented = oriented(boundary.edge());
            result.add(new DungeonClusterBoundaryRecord(
                    cluster.clusterId(),
                    boundary.level(),
                    oriented.cell().q(),
                    oriented.cell().r(),
                    oriented.direction().name(),
                    boundary.kind().name(),
                    boundary.kind().renderable() ? boundary.resolvedTopologyRef().id() : null));
        }
        return List.copyOf(result);
    }

    private static OrientedEdge oriented(Edge edge) {
        List<Cell> touchingCells = edge.touchingCells().stream().sorted(CellOrdering::compareCells).toList();
        EdgeKey key = EdgeKey.from(edge);
        for (Cell cell : touchingCells) {
            for (Direction direction : Direction.values()) {
                if (EdgeKey.from(direction.edgeOf(cell)).equals(key)) {
                    return new OrientedEdge(cell, direction);
                }
            }
        }
        throw new IllegalArgumentException("boundary edge must border an authored cell");
    }

    private static BoundaryKind boundaryKind(String value) {
        if (value == null) {
            return BoundaryKind.WALL;
        }
        return switch (value.trim().toUpperCase(java.util.Locale.ROOT)) {
            case "DOOR" -> BoundaryKind.DOOR;
            case "OPEN" -> BoundaryKind.OPEN;
            default -> BoundaryKind.WALL;
        };
    }

    private record OrientedEdge(Cell cell, Direction direction) {
    }
}
