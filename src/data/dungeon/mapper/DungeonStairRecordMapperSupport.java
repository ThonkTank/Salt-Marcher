package src.data.dungeon.mapper;

import java.util.ArrayList;
import java.util.List;
import src.data.dungeon.model.DungeonStairExitRecord;
import src.data.dungeon.model.DungeonStairPathNodeRecord;
import src.data.dungeon.model.DungeonStairRecord;
import src.domain.dungeon.model.worldspace.DungeonStair;
import src.domain.dungeon.model.worldspace.DungeonCell;
import src.domain.dungeon.model.worldspace.DungeonEdgeDirection;
import src.domain.dungeon.model.worldspace.DungeonStairExit;
import src.domain.dungeon.model.worldspace.DungeonStairShape;

final class DungeonStairRecordMapperSupport {

    private DungeonStairRecordMapperSupport() {
    }

    static List<DungeonStair> toStairs(List<DungeonStairRecord> records) {
        List<DungeonStair> result = new ArrayList<>();
        for (DungeonStairRecord record : records == null ? List.<DungeonStairRecord>of() : records) {
            result.add(new DungeonStair(
                    record.stairId(),
                    record.mapId(),
                    record.name(),
                    new DungeonStair.Geometry(
                            DungeonStairShape.parse(record.shape()),
                            DungeonEdgeDirection.fromCode(record.direction()),
                            record.dimension1(),
                            record.dimension2(),
                            toStairPath(record.pathNodes()),
                            toStairExits(record.exits()),
                            record.corridorId())));
        }
        return List.copyOf(result);
    }

    static List<DungeonStairRecord> toStairRecords(List<DungeonStair> stairs) {
        List<DungeonStairRecord> result = new ArrayList<>();
        for (DungeonStair stair : stairs == null ? List.<DungeonStair>of() : stairs) {
            result.add(new DungeonStairRecord(
                    stair.stairId(),
                    stair.mapId(),
                    stair.name(),
                    stair.shape().name(),
                    directionCode(stair.direction()),
                    stair.dimension1(),
                    stair.dimension2(),
                    stair.corridorId(),
                    toStairPathRecords(stair.stairId(), stair.path()),
                    toStairExitRecords(stair.stairId(), stair.exits())));
        }
        return List.copyOf(result);
    }

    private static List<DungeonCell> toStairPath(List<DungeonStairPathNodeRecord> records) {
        List<DungeonCell> result = new ArrayList<>();
        for (DungeonStairPathNodeRecord record
                : records == null ? List.<DungeonStairPathNodeRecord>of() : records) {
            result.add(new DungeonCell(record.cellX(), record.cellY(), record.cellZ()));
        }
        return List.copyOf(result);
    }

    private static List<DungeonStairExit> toStairExits(List<DungeonStairExitRecord> records) {
        List<DungeonStairExit> result = new ArrayList<>();
        for (DungeonStairExitRecord record : records == null ? List.<DungeonStairExitRecord>of() : records) {
            result.add(new DungeonStairExit(
                    record.exitId(),
                    new DungeonCell(record.cellX(), record.cellY(), record.cellZ()),
                    record.label()));
        }
        return List.copyOf(result);
    }

    private static List<DungeonStairPathNodeRecord> toStairPathRecords(long stairId, List<DungeonCell> path) {
        List<DungeonStairPathNodeRecord> result = new ArrayList<>();
        for (DungeonCell cell : path == null ? List.<DungeonCell>of() : path) {
            result.add(new DungeonStairPathNodeRecord(stairId, cell.q(), cell.r(), cell.level()));
        }
        return List.copyOf(result);
    }

    private static List<DungeonStairExitRecord> toStairExitRecords(long stairId, List<DungeonStairExit> exits) {
        List<DungeonStairExitRecord> result = new ArrayList<>();
        for (DungeonStairExit exit : exits == null ? List.<DungeonStairExit>of() : exits) {
            result.add(new DungeonStairExitRecord(
                    stairId,
                    exit.exitId(),
                    exit.position().q(),
                    exit.position().r(),
                    exit.position().level(),
                    exit.label()));
        }
        return List.copyOf(result);
    }

    private static int directionCode(DungeonEdgeDirection direction) {
        DungeonEdgeDirection safeDirection = direction == null ? DungeonEdgeDirection.NORTH : direction;
        if (safeDirection == DungeonEdgeDirection.EAST) {
            return 1;
        }
        if (safeDirection == DungeonEdgeDirection.SOUTH) {
            return 2;
        }
        if (safeDirection == DungeonEdgeDirection.WEST) {
            return 3;
        }
        return 0;
    }
}
