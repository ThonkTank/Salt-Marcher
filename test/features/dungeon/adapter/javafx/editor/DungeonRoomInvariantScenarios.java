package features.dungeon.adapter.javafx.editor;

import java.util.List;
import java.util.Map;
import java.util.Set;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Direction;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.DungeonMapAuthoring;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import features.dungeon.domain.core.structure.room.DungeonRoom;
import features.dungeon.domain.core.structure.room.DungeonRoomNarration;
import features.dungeon.domain.core.structure.room.Room;
import features.dungeon.domain.core.structure.room.RoomCluster;
import features.dungeon.domain.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryKind;
import features.dungeon.domain.core.structure.room.RoomClusterRoomPartition;

final class DungeonRoomInvariantScenarios {


    private DungeonRoomInvariantScenarios() {
    }

    static void run() {
        assertRoomIdentityAndNarrationSurviveClusterEdits();

        assertRoomPartitionAssignsCellsOnce();

        assertDefaultAndCustomRoomNames();

        assertRoomLabelFloorAndAnchorFacts();

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

        DungeonMap partitioned = DungeonMapAuthoring.empty(new DungeonMapIdentity(11L), "Partitioned Paint Test")
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

        DungeonMap partitioned = DungeonMapAuthoring.empty(new DungeonMapIdentity(12L), "Boundary Coalesce Test")
                .paintRoomRectangle(left, middle);
        long clusterId = firstRoom(partitioned).clusterId();
        DungeonMap split = partitioned.editClusterBoundaries(
                clusterId,
                List.of(EdgeSide.eastOf(0, 0)),
                BoundaryKind.WALL,
                false);
        assertEquals(2L, (long) split.rooms().rooms().size(),
                "DGI-ROOM-002 closed boundary split creates two room components");
        DungeonMap coalesced = split.editClusterBoundaries(
                clusterId,
                List.of(EdgeSide.eastOf(0, 0)),
                BoundaryKind.WALL,
                true);
        assertEquals(1L, (long) coalesced.rooms().rooms().size(),
                "DGI-ROOM-002 removing the separating wall coalesces the open component to one room");
        var coalescedCluster = coalesced.topology().roomClusters().getFirst();
        Map<Long, List<Cell>> coalescedCells = RoomClusterRoomPartition.cellsByRoom(
                coalescedCluster.toCore(coalescedCluster.cellsByLevel()),
                coalesced.rooms().rooms().stream().map(DungeonRoom::toCore).toList(),
                coalescedCluster.closedBoundaryEdgesByLevel());
        assertEquals(List.of(left, middle), coalescedCells.values().iterator().next(),
                "DGI-ROOM-002 coalesced room owns the full open floor component");
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
        return DungeonMapAuthoring.empty(new DungeonMapIdentity(10L), "Room Test")
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
        DungeonEditorTestSupport.assertEquals(expected, actual, message);
    }

    private static final class EdgeSide {
        private EdgeSide() {
        }

        private static features.dungeon.domain.core.geometry.Edge northOf(int q, int r) {
            return features.dungeon.domain.core.geometry.Edge.sideOf(new Cell(q, r, 0),
                    features.dungeon.domain.core.geometry.Direction.NORTH);
        }

        private static features.dungeon.domain.core.geometry.Edge eastOf(int q, int r) {
            return features.dungeon.domain.core.geometry.Edge.sideOf(new Cell(q, r, 0), Direction.EAST);
        }
    }
}
