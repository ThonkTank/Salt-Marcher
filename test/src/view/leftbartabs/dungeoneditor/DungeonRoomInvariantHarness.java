package src.view.leftbartabs.dungeoneditor;

import java.util.List;
import java.util.Map;
import java.util.Set;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Direction;
import src.domain.dungeon.model.core.structure.DungeonMap;
import src.domain.dungeon.model.core.structure.DungeonMapAuthoring;
import src.domain.dungeon.model.core.structure.DungeonMapIdentity;
import src.domain.dungeon.model.core.structure.room.DungeonRoom;
import src.domain.dungeon.model.core.structure.room.DungeonRoomNarration;
import src.domain.dungeon.model.core.structure.room.Room;
import src.domain.dungeon.model.core.structure.room.RoomCluster;
import src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryKind;
import src.domain.dungeon.model.core.structure.room.RoomClusterRoomPartition;

final class DungeonRoomInvariantHarness {

    private static final String OWNER = "RoomInvariantHarness";

    private DungeonRoomInvariantHarness() {
    }

    static void run(List<String> results) {
        assertRoomIdentityAndNarrationSurviveClusterEdits();
        DungeonEditorBehaviorHarnessSupport.recordModelInvariant(
                results,
                OWNER,
                "DGI-ROOM-001",
                "DungeonRoom identity and narration survive aggregate cluster edits while the room remains represented");
        assertRoomPartitionAssignsCellsOnce();
        DungeonEditorBehaviorHarnessSupport.recordModelInvariant(
                results,
                OWNER,
                "DGI-ROOM-002",
                "RoomClusterRoomPartition assigns each floor-owned room cell to exactly one room");
        assertDefaultAndCustomRoomNames();
        DungeonEditorBehaviorHarnessSupport.recordModelInvariant(
                results,
                OWNER,
                "DGI-ROOM-003",
                "DungeonRoom and DungeonMap keep default Raum <roomId> and authored custom room names");
        assertRoomLabelFloorAndAnchorFacts();
        DungeonEditorBehaviorHarnessSupport.recordModelInvariant(
                results,
                OWNER,
                "DGI-ROOM-004",
                "Room label source facts derive from partition-owned room floor cells and sorted room anchors");
    }

    private static void assertRoomIdentityAndNarrationSurviveClusterEdits() {
        DungeonMap map = twoByTwoMap();
        DungeonRoom original = firstRoom(map).withNarration(new DungeonRoomNarration("Quiet room", List.of()));
        DungeonMap narrated = map.saveRoomNarration(original.roomId(), original.narration());
        DungeonMap moved = narrated.moveCluster(original.clusterId(), 1, 0, 0);
        DungeonRoom movedRoom = firstRoom(moved);
        assertEquals(original.roomId(), movedRoom.roomId(), "DGI-ROOM-001 room id survives cluster move");
        assertEquals(original.narration(), movedRoom.narration(), "DGI-ROOM-001 narration survives cluster move");
        DungeonMap stretched = narrated.moveBoundaryStretch(
                original.clusterId(),
                List.of(EdgeSide.northOf(1, 1), EdgeSide.northOf(2, 1)),
                0,
                -1,
                0);
        DungeonRoom stretchedRoom = firstRoom(stretched);
        assertEquals(original.roomId(), stretchedRoom.roomId(), "DGI-ROOM-001 room id survives wall-run stretch");
        assertEquals(original.narration(), stretchedRoom.narration(), "DGI-ROOM-001 narration survives wall-run stretch");

        DungeonMap partitioned = DungeonMapAuthoring.empty(new DungeonMapIdentity(11L), "Partitioned Paint Harness")
                .paintRoomRectangle(new Cell(1, 1, 0), new Cell(2, 1, 0));
        long clusterId = firstRoom(partitioned).clusterId();
        partitioned = partitioned.editClusterBoundaries(
                clusterId,
                List.of(EdgeSide.eastOf(1, 1)),
                BoundaryKind.WALL,
                false);
        DungeonRoom left = roomByAnchor(partitioned, new Cell(1, 1, 0));
        DungeonRoom right = roomByAnchor(partitioned, new Cell(2, 1, 0));
        DungeonRoomNarration leftNarration = new DungeonRoomNarration("Left identity", List.of());
        DungeonRoomNarration rightNarration = new DungeonRoomNarration("Right identity", List.of());
        DungeonMap narratedTwoRooms = partitioned
                .saveRoomNarration(left.roomId(), leftNarration)
                .saveRoomNarration(right.roomId(), rightNarration);
        DungeonMap expanded = narratedTwoRooms.paintRoomRectangle(new Cell(1, 1, 0), new Cell(1, 2, 0));
        assertEquals(leftNarration, roomById(expanded, left.roomId()).narration(),
                "DGI-ROOM-001 partition-preserving paint keeps left room narration");
        assertEquals(rightNarration, roomById(expanded, right.roomId()).narration(),
                "DGI-ROOM-001 partition-preserving paint keeps right room narration");
        assertEquals(2L, (long) expanded.rooms().rooms().size(),
                "DGI-ROOM-001 partition-preserving paint keeps both represented rooms");

        DungeonMap trimmed = expanded.deleteRoomRectangle(new Cell(1, 2, 0), new Cell(1, 2, 0));
        assertEquals(leftNarration, roomById(trimmed, left.roomId()).narration(),
                "DGI-ROOM-001 partition-preserving delete keeps represented left room narration");
        assertEquals(rightNarration, roomById(trimmed, right.roomId()).narration(),
                "DGI-ROOM-001 partition-preserving delete keeps represented right room narration");
        assertEquals(2L, (long) trimmed.rooms().rooms().size(),
                "DGI-ROOM-001 partition-preserving delete keeps both represented rooms");
    }

    private static void assertRoomPartitionAssignsCellsOnce() {
        Cell left = new Cell(0, 0, 0);
        Cell middle = new Cell(1, 0, 0);
        Cell right = new Cell(2, 0, 0);
        RoomCluster cluster = RoomCluster.fromCells(9L, 2L, Set.of(left, middle, right));
        List<Room> rooms = List.of(new Room(7L, 2L, 9L, "Left", Map.of(0, left)));
        Map<Long, List<Cell>> assigned = RoomClusterRoomPartition.cellsByRoom(cluster, rooms, Map.of());
        Set<Cell> assignedCells = assigned.values().stream()
                .flatMap(List::stream)
                .collect(java.util.stream.Collectors.toSet());
        long assignedCount = assigned.values().stream().mapToLong(List::size).sum();
        assertEquals(Set.of(left, middle, right), assignedCells, "DGI-ROOM-002 partition covers floor cells");
        assertEquals(assignedCells.size(), (int) assignedCount, "DGI-ROOM-002 partition assigns each cell once");
    }

    private static void assertDefaultAndCustomRoomNames() {
        DungeonRoom defaultRoom = new DungeonRoom(12L, 4L, 3L, "", Map.of(0, new Cell(1, 1, 0)), null);
        assertEquals("Raum 12", defaultRoom.name(), "DGI-ROOM-003 default room name");
        assertEquals("Library", defaultRoom.withName("  Library  ").name(), "DGI-ROOM-003 custom room name trims");
        DungeonMap map = twoByTwoMap();
        long roomId = firstRoom(map).roomId();
        DungeonMap renamed = map.saveRoomName(roomId, "  Blue Room  ");
        assertEquals("Blue Room", firstRoom(renamed).name(), "DGI-ROOM-003 aggregate saves room name");
    }

    private static void assertRoomLabelFloorAndAnchorFacts() {
        Cell left = new Cell(0, 0, 0);
        Cell middle = new Cell(1, 0, 0);
        Cell right = new Cell(2, 0, 0);
        RoomCluster cluster = RoomCluster.fromCells(9L, 2L, Set.of(left, middle, right));
        Room room = new Room(7L, 2L, 9L, "", Map.of(0, left));
        Map<Long, List<Cell>> cellsByRoom = RoomClusterRoomPartition.cellsByRoom(cluster, List.of(room), Map.of());
        assertEquals(List.of(left, middle, right), cellsByRoom.get(room.roomId()),
                "DGI-ROOM-004 room label source cells come from room partition owner");
        Map<Integer, Cell> anchors = Room.anchorsByLevel(Map.of(0, cellsByRoom.get(room.roomId())));
        assertEquals(left, anchors.get(0), "DGI-ROOM-004 room anchor comes from sorted floor cells");
    }

    private static DungeonMap twoByTwoMap() {
        return DungeonMapAuthoring.empty(new DungeonMapIdentity(10L), "Room Harness")
                .paintRoomRectangle(new Cell(1, 1, 0), new Cell(2, 2, 0));
    }

    private static DungeonRoom firstRoom(DungeonMap map) {
        return map.rooms().rooms().getFirst();
    }

    private static DungeonRoom roomByAnchor(DungeonMap map, Cell anchor) {
        for (DungeonRoom room : map.rooms().rooms()) {
            if (anchor.equals(room.primaryAnchor())) {
                return room;
            }
        }
        throw new IllegalStateException("Expected room at anchor " + anchor);
    }

    private static DungeonRoom roomById(DungeonMap map, long roomId) {
        for (DungeonRoom room : map.rooms().rooms()) {
            if (room.roomId() == roomId) {
                return room;
            }
        }
        throw new IllegalStateException("Expected room id " + roomId);
    }

    private static void assertEquals(Object expected, Object actual, String message) {
        DungeonEditorBehaviorHarnessSupport.assertEquals(expected, actual, message);
    }

    private static final class EdgeSide {
        private EdgeSide() {
        }

        private static src.domain.dungeon.model.core.geometry.Edge northOf(int q, int r) {
            return src.domain.dungeon.model.core.geometry.Edge.sideOf(new Cell(q, r, 0),
                    src.domain.dungeon.model.core.geometry.Direction.NORTH);
        }

        private static src.domain.dungeon.model.core.geometry.Edge eastOf(int q, int r) {
            return src.domain.dungeon.model.core.geometry.Edge.sideOf(new Cell(q, r, 0), Direction.EAST);
        }
    }
}
