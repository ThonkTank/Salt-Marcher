package src.domain.dungeon.model.core.structure.room;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.CellOrdering;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.geometry.EdgeKey;

final class RoomClusterRoomComponents {

    private RoomClusterRoomComponents() {
    }

    static List<Room> roomsForBoundaryEdit(
            RoomClusterWork work,
            Map<Integer, ? extends Iterable<Edge>> barriersByLevel,
            long nextRoomId
    ) {
        List<RoomComponent> components = roomComponents(work, barriersByLevel);
        RoomIdCursor idCursor = new RoomIdCursor(nextRoomId);
        Set<Long> usedRoomIds = new LinkedHashSet<>();
        List<Room> rooms = new ArrayList<>();
        for (RoomComponent component : components) {
            Room template = templateForComponent(work.rooms(), component, usedRoomIds);
            long roomId = template == null ? idCursor.reserveUnusedRoomId(usedRoomIds) : template.roomId();
            usedRoomIds.add(roomId);
            rooms.add(new Room(
                    roomId,
                    work.cluster().mapId(),
                    work.cluster().clusterId(),
                    template == null ? "Raum " + roomId : template.name(),
                    Map.of(component.level(), component.anchor())));
        }
        return List.copyOf(rooms);
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

    private static @Nullable Room templateForComponent(
            List<Room> rooms,
            RoomComponent component,
            Set<Long> usedRoomIds
    ) {
        for (Room room : rooms == null ? List.<Room>of() : rooms) {
            if (room == null) {
                continue;
            }
            Cell anchor = room.floorAnchors().get(component.level());
            if (anchor != null && component.cells().contains(anchor) && !usedRoomIds.contains(room.roomId())) {
                return room;
            }
        }
        return null;
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

    private record RoomComponent(
            int level,
            List<Cell> cells
    ) {
        private RoomComponent {
            cells = cells == null ? List.of() : List.copyOf(cells);
        }

        private Cell anchor() {
            return cells.isEmpty() ? new Cell(0, 0, level) : cells.getFirst();
        }
    }
}
