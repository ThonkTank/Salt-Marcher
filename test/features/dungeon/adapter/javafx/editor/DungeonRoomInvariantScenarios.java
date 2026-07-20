package features.dungeon.adapter.javafx.editor;

import java.util.List;
import java.util.Map;
import java.util.Set;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Direction;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.DungeonMapAuthoring;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import features.dungeon.domain.core.structure.room.RoomRegion;
import features.dungeon.domain.core.structure.room.DungeonRoomNarration;
import features.dungeon.domain.core.structure.room.RoomClusterGeometry;
import features.dungeon.domain.core.component.boundary.BoundaryKind;
import features.dungeon.domain.core.structure.room.RoomClusterRoomPartition;
import features.dungeon.domain.core.structure.room.RoomTopologyWorkCatalog;

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
        RoomRegion original = firstRoom(map).withNarration(new DungeonRoomNarration("Quiet room", List.of()));
        DungeonMap narrated = withNarration(map, original.roomId(), original.narration());
        DungeonMap moved = narrated.moveCluster(original.clusterId(), 1, 0, 0);
        RoomRegion movedRoom = firstRoom(moved);
        assertEquals(original.roomId(), movedRoom.roomId(), "DGI-ROOM-001 room id survives cluster move");
        assertEquals(original.narration(), movedRoom.narration(), "DGI-ROOM-001 narration survives cluster move");
        DungeonMap stretched = narrated.moveBoundaryStretch(
                original.clusterId(),
                List.of(EdgeSide.northOf(1, 1), EdgeSide.northOf(2, 1)),
                0,
                -1,
                0,
                roomIds(100L, 100L));
        RoomRegion stretchedRoom = firstRoom(stretched);
        assertEquals(original.roomId(), stretchedRoom.roomId(), "DGI-ROOM-001 room id survives wall-run stretch");
        assertEquals(original.narration(), stretchedRoom.narration(), "DGI-ROOM-001 narration survives wall-run stretch");

        DungeonMap partitioned = DungeonMapAuthoring.empty(new DungeonMapIdentity(11L), "Partitioned Paint Test")
                .paintRoomRectangle(
                        new Cell(1, 1, 0), new Cell(2, 1, 0), roomIds(200L, 200L));
        long clusterId = firstRoom(partitioned).clusterId();
        partitioned = partitioned.editClusterBoundaries(
                clusterId,
                List.of(EdgeSide.eastOf(1, 1)),
                BoundaryKind.WALL,
                false,
                roomIds(300L, 300L));
        RoomRegion left = roomByAnchor(partitioned, new Cell(1, 1, 0));
        RoomRegion right = roomByAnchor(partitioned, new Cell(2, 1, 0));
        DungeonRoomNarration leftNarration = new DungeonRoomNarration("Left identity", List.of());
        DungeonRoomNarration rightNarration = new DungeonRoomNarration("Right identity", List.of());
        DungeonMap narratedTwoRooms = withNarration(
                withNarration(partitioned, left.roomId(), leftNarration),
                right.roomId(),
                rightNarration);
        DungeonMap expanded = narratedTwoRooms.paintRoomRectangle(
                new Cell(1, 1, 0),
                new Cell(1, 2, 0),
                roomIds(400L, 400L));
        assertEquals(leftNarration, roomById(expanded, left.roomId()).narration(),
                "DGI-ROOM-001 partition-preserving paint keeps left room narration");
        assertEquals(rightNarration, roomById(expanded, right.roomId()).narration(),
                "DGI-ROOM-001 partition-preserving paint keeps right room narration");
        assertEquals(2L, (long) expanded.rooms().rooms().size(),
                "DGI-ROOM-001 partition-preserving paint keeps both represented rooms");

        DungeonMap trimmed = expanded.deleteRoomRectangle(
                new Cell(1, 2, 0),
                new Cell(1, 2, 0),
                roomIds(500L, 500L));
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
        RoomClusterGeometry cluster = RoomClusterGeometry.fromCells(9L, 2L, Set.of(left, middle, right));
        List<RoomRegion> rooms = List.of(new RoomRegion(
                7L, 2L, 9L, "Left", Set.of(left), DungeonRoomNarration.empty()));
        Map<Long, List<Cell>> assigned = RoomClusterRoomPartition.cellsByRoom(cluster, rooms, Map.of());
        Set<Cell> assignedCells = assigned.values().stream()
                .flatMap(List::stream)
                .collect(java.util.stream.Collectors.toSet());
        long assignedCount = assigned.values().stream().mapToLong(List::size).sum();
        assertEquals(Set.of(left, middle, right), assignedCells, "DGI-ROOM-002 partition covers floor cells");
        assertEquals(assignedCells.size(), (int) assignedCount, "DGI-ROOM-002 partition assigns each cell once");

        DungeonMap partitioned = DungeonMapAuthoring.empty(new DungeonMapIdentity(12L), "Boundary Coalesce Test")
                .paintRoomRectangle(left, middle, roomIds(600L, 600L));
        long clusterId = firstRoom(partitioned).clusterId();
        DungeonMap split = partitioned.editClusterBoundaries(
                clusterId,
                List.of(EdgeSide.eastOf(0, 0)),
                BoundaryKind.WALL,
                false,
                roomIds(700L, 700L));
        assertEquals(2L, (long) split.rooms().rooms().size(),
                "DGI-ROOM-002 closed boundary split creates two room components");
        DungeonMap coalesced = split.editClusterBoundaries(
                clusterId,
                List.of(EdgeSide.eastOf(0, 0)),
                BoundaryKind.WALL,
                true,
                roomIds(800L, 800L));
        assertEquals(1L, (long) coalesced.rooms().rooms().size(),
                "DGI-ROOM-002 removing the separating wall coalesces the open component to one room");
        assertEquals(java.util.Set.of(left, middle), coalesced.rooms().rooms().getFirst().floorCells(),
                "DGI-ROOM-002 coalesced room owns the full open floor component");
    }

    private static void assertDefaultAndCustomRoomNames() {
        RoomRegion defaultRoom = new RoomRegion(
                12L,
                4L,
                3L,
                "",
                Set.of(new Cell(1, 1, 0)),
                DungeonRoomNarration.empty());
        assertEquals("Raum 12", defaultRoom.name(), "DGI-ROOM-003 default room name");
        assertEquals("Library", defaultRoom.withName("  Library  ").name(), "DGI-ROOM-003 custom room name trims");
    }

    private static void assertRoomLabelFloorAndAnchorFacts() {
        Cell left = new Cell(0, 0, 0);
        Cell middle = new Cell(1, 0, 0);
        Cell right = new Cell(2, 0, 0);
        RoomClusterGeometry cluster = RoomClusterGeometry.fromCells(9L, 2L, Set.of(left, middle, right));
        RoomRegion room = new RoomRegion(
                7L, 2L, 9L, "", Set.of(left), DungeonRoomNarration.empty());
        Map<Long, List<Cell>> cellsByRoom = RoomClusterRoomPartition.cellsByRoom(cluster, List.of(room), Map.of());
        assertEquals(List.of(left, middle, right), cellsByRoom.get(room.roomId()),
                "DGI-ROOM-004 room label source cells come from room partition owner");
        assertEquals(left, cellsByRoom.get(room.roomId()).getFirst(),
                "DGI-ROOM-004 room label source starts at the sorted exact floor cell");
    }

    private static DungeonMap twoByTwoMap() {
        return DungeonMapAuthoring.empty(new DungeonMapIdentity(10L), "Room Test")
                .paintRoomRectangle(
                        new Cell(1, 1, 0), new Cell(2, 2, 0), roomIds(10L, 10L));
    }

    private static RoomTopologyWorkCatalog.ReservedIdentities roomIds(
            long firstClusterId,
            long firstRoomId
    ) {
        return new RoomTopologyWorkCatalog.ReservedIdentities(
                firstClusterId, 64, firstRoomId, 64);
    }

    private static DungeonMap withNarration(
            DungeonMap map,
            long roomId,
            DungeonRoomNarration narration
    ) {
        RoomRegion before = map.rooms().findRoom(roomId).orElseThrow();
        return map.withExactRoomRegionChange(before, before.withNarration(narration));
    }

    private static RoomRegion firstRoom(DungeonMap map) {
        return map.rooms().rooms().getFirst();
    }

    private static RoomRegion roomByAnchor(DungeonMap map, Cell anchor) {
        for (RoomRegion room : map.rooms().rooms()) {
            if (anchor.equals(room.primaryAnchor())) {
                return room;
            }
        }
        throw new IllegalStateException("Expected room at anchor " + anchor);
    }

    private static RoomRegion roomById(DungeonMap map, long roomId) {
        for (RoomRegion room : map.rooms().rooms()) {
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
