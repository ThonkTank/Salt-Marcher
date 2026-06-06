package src.data.dungeon.mapper;

import java.util.ArrayList;
import java.util.List;
import src.data.dungeon.model.DungeonStairExitRecord;
import src.data.dungeon.model.DungeonStairPathNodeRecord;
import src.data.dungeon.model.DungeonStairRecord;
import src.domain.dungeon.model.core.component.StairExit;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Direction;
import src.domain.dungeon.model.core.structure.stair.Stair;
import src.domain.dungeon.model.core.structure.stair.StairCollection;
import src.domain.dungeon.model.core.structure.stair.StairShape;

final class DungeonStairRecordMapperSupport {

    private DungeonStairRecordMapperSupport() {
    }

    static StairCollection toStairs(List<DungeonStairRecord> records) {
        List<Stair> result = new ArrayList<>();
        for (DungeonStairRecord record : records == null ? List.<DungeonStairRecord>of() : records) {
            result.add(new Stair(
                    record.stairId(),
                    record.mapId(),
                    record.name(),
                    StairShape.parse(record.shape()),
                    directionFromCode(record.direction()),
                    record.dimension1(),
                    record.dimension2(),
                    toStairPath(record.pathNodes()),
                    toStairExits(record.exits()),
                    record.corridorId()));
        }
        return new StairCollection(result);
    }

    static List<DungeonStairRecord> toStairRecords(StairCollection stairs) {
        List<DungeonStairRecord> result = new ArrayList<>();
        for (Stair stair : stairs == null ? List.<Stair>of() : stairs.stairs()) {
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

    private static List<Cell> toStairPath(List<DungeonStairPathNodeRecord> records) {
        List<Cell> result = new ArrayList<>();
        for (DungeonStairPathNodeRecord record
                : records == null ? List.<DungeonStairPathNodeRecord>of() : records) {
            result.add(new Cell(record.cellX(), record.cellY(), record.cellZ()));
        }
        return List.copyOf(result);
    }

    private static List<StairExit> toStairExits(List<DungeonStairExitRecord> records) {
        List<StairExit> result = new ArrayList<>();
        for (DungeonStairExitRecord record : records == null ? List.<DungeonStairExitRecord>of() : records) {
            result.add(new StairExit(
                    record.exitId(),
                    new Cell(record.cellX(), record.cellY(), record.cellZ()),
                    record.label()));
        }
        return List.copyOf(result);
    }

    private static List<DungeonStairPathNodeRecord> toStairPathRecords(long stairId, List<Cell> path) {
        List<DungeonStairPathNodeRecord> result = new ArrayList<>();
        for (Cell cell : path == null ? List.<Cell>of() : path) {
            result.add(new DungeonStairPathNodeRecord(stairId, cell.q(), cell.r(), cell.level()));
        }
        return List.copyOf(result);
    }

    private static List<DungeonStairExitRecord> toStairExitRecords(long stairId, List<StairExit> exits) {
        List<DungeonStairExitRecord> result = new ArrayList<>();
        for (StairExit exit : exits == null ? List.<StairExit>of() : exits) {
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

    private static Direction directionFromCode(int code) {
        return switch (code) {
            case 1 -> Direction.EAST;
            case 2 -> Direction.SOUTH;
            case 3 -> Direction.WEST;
            default -> Direction.NORTH;
        };
    }

    private static int directionCode(Direction direction) {
        Direction safeDirection = direction == null ? Direction.NORTH : direction;
        if (safeDirection == Direction.EAST) {
            return 1;
        }
        if (safeDirection == Direction.SOUTH) {
            return 2;
        }
        if (safeDirection == Direction.WEST) {
            return 3;
        }
        return 0;
    }
}
