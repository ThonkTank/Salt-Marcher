package src.data.dungeon.mapper;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import src.data.dungeon.model.DungeonRoomExitDescriptionRecord;
import src.data.dungeon.model.DungeonRoomFloorRecord;
import src.data.dungeon.model.DungeonRoomRecord;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Direction;
import src.domain.dungeon.model.core.structure.room.DungeonRoom;
import src.domain.dungeon.model.core.structure.room.DungeonRoomExitDescription;
import src.domain.dungeon.model.core.structure.room.DungeonRoomNarration;

final class DungeonRoomRecordMapperSupport {

    private DungeonRoomRecordMapperSupport() {
    }

    static List<DungeonRoom> toRooms(List<DungeonRoomRecord> records) {
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

    static List<DungeonRoomRecord> toRoomRecords(List<DungeonRoom> rooms) {
        List<DungeonRoomRecord> result = new ArrayList<>();
        for (DungeonRoom room : rooms == null ? List.<DungeonRoom>of() : rooms) {
            int primaryLevel = room.primaryLevel();
            Cell primaryAnchor = room.primaryAnchor();
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
