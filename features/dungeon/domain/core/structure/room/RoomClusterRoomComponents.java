package features.dungeon.domain.core.structure.room;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.CellOrdering;
import features.dungeon.domain.core.geometry.Edge;
import features.dungeon.domain.core.geometry.EdgeKey;

final class RoomClusterRoomComponents {

    private RoomClusterRoomComponents() {
    }

    static List<Room> roomsForMutation(
            RoomClusterWork work,
            Map<Integer, ? extends Iterable<Edge>> barriersByLevel,
            long nextRoomId,
            Map<Long, List<Cell>> previousCellsByRoom
    ) {
        List<RoomComponent> components = roomComponents(work, barriersByLevel);
        Map<Long, List<Cell>> resolvedPreviousCellsByRoom = previousCellsByRoom == null
                ? RoomClusterRoomPartition.cellsByRoom(work.cluster(), work.rooms(), barriersByLevel)
                : previousCellsByRoom;
        Map<Long, Set<Cell>> previousCellSetsByRoom = previousCellSetsByRoom(resolvedPreviousCellsByRoom);
        RoomIdCursor idCursor = new RoomIdCursor(nextRoomId);
        Set<Long> usedRoomIds = new LinkedHashSet<>();
        List<Room> rooms = new ArrayList<>();
        for (RoomComponent component : components) {
            Optional<Room> template = RoomComponentTemplateSelection.templateFor(
                    work.rooms(),
                    previousCellSetsByRoom,
                    component,
                    usedRoomIds);
            addRoom(rooms, work, component, template.orElse(null), idCursor, usedRoomIds);
        }
        return List.copyOf(rooms);
    }

    private static Map<Long, Set<Cell>> previousCellSetsByRoom(Map<Long, List<Cell>> previousCellsByRoom) {
        Map<Long, Set<Cell>> result = new LinkedHashMap<>();
        for (Map.Entry<Long, List<Cell>> entry : previousCellsByRoom.entrySet()) {
            result.put(entry.getKey(), Set.copyOf(entry.getValue()));
        }
        return Map.copyOf(result);
    }

    private static void addRoom(
            List<Room> rooms,
            RoomClusterWork work,
            RoomComponent component,
            Room template,
            RoomIdCursor idCursor,
            Set<Long> usedRoomIds
    ) {
        long roomId = template == null ? idCursor.reserveUnusedRoomId(usedRoomIds) : template.roomId();
        usedRoomIds.add(roomId);
        rooms.add(new Room(
                roomId,
                work.cluster().mapId(),
                work.cluster().clusterId(),
                template == null ? "Raum " + roomId : template.name(),
                Map.of(component.level(), anchorFor(component, template))));
    }

    private static Cell anchorFor(RoomComponent component, Room template) {
        if (template == null) {
            return component.anchor();
        }
        Cell anchor = template.floorAnchors().get(component.level());
        return component.cells().contains(anchor) ? anchor : component.anchor();
    }

    private static List<RoomComponent> roomComponents(
            RoomClusterWork work,
            Map<Integer, ? extends Iterable<Edge>> barriersByLevel
    ) {
        List<RoomComponent> result = new ArrayList<>();
        for (Map.Entry<Integer, List<Cell>> entry : work.cellsByLevel().entrySet()) {
            int level = entry.getKey();
            Set<EdgeKey> barriers =
                    RoomClusterBoundaryTraversal.barriersAt(barriersByLevel, level);
            for (Set<Cell> component : RoomClusterBoundaryTraversal.connectedComponents(entry.getValue(), barriers)) {
                List<Cell> cells = RoomClusterCells.sortedCells(component);
                if (!cells.isEmpty()) {
                    result.add(new RoomComponent(level, cells));
                }
            }
        }
        result.sort(RoomClusterRoomComponents::compareRoomComponents);
        return List.copyOf(result);
    }

    private static int compareRoomComponents(RoomComponent left, RoomComponent right) {
        return CellOrdering.compareCells(left.anchor(), right.anchor());
    }

    private static final class RoomIdCursor {
        private long nextRoomId;

        RoomIdCursor(long nextRoomId) {
            this.nextRoomId = Math.max(1L, nextRoomId);
        }

        long reserveUnusedRoomId(Set<Long> usedRoomIds) {
            long roomId = nextRoomId;
            nextRoomId += 1L;
            while (usedRoomIds.contains(roomId)) {
                roomId += 1L;
                nextRoomId = Math.max(nextRoomId, roomId + 1L);
            }
            return roomId;
        }
    }

    record RoomComponent(
            int level,
            List<Cell> cells
    ) {
        RoomComponent {
            cells = cells == null ? List.of() : List.copyOf(cells);
        }

        private Cell anchor() {
            return cells.isEmpty() ? new Cell(0, 0, level) : cells.getFirst();
        }
    }
}
