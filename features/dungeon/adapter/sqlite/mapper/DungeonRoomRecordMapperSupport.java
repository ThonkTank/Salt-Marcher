package features.dungeon.adapter.sqlite.mapper;

import features.dungeon.adapter.sqlite.model.DungeonRoomCellRecord;
import features.dungeon.adapter.sqlite.model.DungeonRoomExitDescriptionRecord;
import features.dungeon.adapter.sqlite.model.DungeonRoomRecord;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.CellOrdering;
import features.dungeon.domain.core.geometry.Direction;
import features.dungeon.domain.core.structure.room.DungeonRoomExitDescription;
import features.dungeon.domain.core.structure.room.DungeonRoomNarration;
import features.dungeon.domain.core.structure.room.RoomRegion;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

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
                    floorCells(record.floorCells()),
                    new DungeonRoomNarration(
                            record.visualDescription(),
                            exitDescriptions(record.exitDescriptions()))));
        }
        return List.copyOf(result);
    }

    static List<DungeonRoomRecord> toRoomRecords(List<RoomRegion> rooms) {
        List<DungeonRoomRecord> result = new ArrayList<>();
        for (RoomRegion room : rooms == null ? List.<RoomRegion>of() : rooms) {
            result.add(new DungeonRoomRecord(
                    room.roomId(),
                    room.mapId(),
                    room.clusterId(),
                    room.name(),
                    room.narration().visualDescription(),
                    toFloorCellRecords(room),
                    toExitDescriptionRecords(room.roomId(), room.narration().exitDescriptions())));
        }
        return List.copyOf(result);
    }

    private static Set<Cell> floorCells(List<DungeonRoomCellRecord> records) {
        Set<Cell> result = new LinkedHashSet<>();
        for (DungeonRoomCellRecord record
                : records == null ? List.<DungeonRoomCellRecord>of() : records) {
            result.add(new Cell(record.cellX(), record.cellY(), record.levelZ()));
        }
        return Set.copyOf(result);
    }

    private static List<DungeonRoomCellRecord> toFloorCellRecords(RoomRegion room) {
        List<DungeonRoomCellRecord> result = new ArrayList<>();
        for (Cell cell : CellOrdering.sortedCells(room.floorCells())) {
            result.add(new DungeonRoomCellRecord(
                    room.roomId(),
                    cell.level(),
                    cell.q(),
                    cell.r()));
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
                    exitDescription.roomCell().level(),
                    exitDescription.roomCell().q(),
                    exitDescription.roomCell().r(),
                    exitDescription.direction().name(),
                    exitDescription.description()));
        }
        return List.copyOf(result);
    }

    private static List<DungeonRoomExitDescription> exitDescriptions(
            List<DungeonRoomExitDescriptionRecord> records
    ) {
        List<DungeonRoomExitDescription> result = new ArrayList<>();
        for (DungeonRoomExitDescriptionRecord record
                : records == null ? List.<DungeonRoomExitDescriptionRecord>of() : records) {
            result.add(new DungeonRoomExitDescription(
                    new Cell(record.cellX(), record.cellY(), record.levelZ()),
                    Direction.parse(record.edgeDirection()),
                    record.description()));
        }
        return List.copyOf(result);
    }
}
