package src.domain.dungeon.model.core.structure.room;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Edge;

public final class DungeonRoomBoundaryPartition {

    public List<DungeonRoom> roomsForBoundaryEdit(
            DungeonRoomTopologyClusterWork work,
            Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel,
            RoomTopologyWorkCatalog.IdAllocation ids
    ) {
        List<Room> coreRooms = RoomClusterRoomPartition.roomsForBoundaryEdit(
                work.toCore(),
                closedBoundaryEdgesByLevel(boundariesByLevel, work.cluster().center()),
                ids.nextRoomId());
        return authoredRooms(coreRooms, work);
    }

    public static Map<Integer, List<Edge>> closedBoundaryEdgesByLevel(
            Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel,
            @Nullable Cell center
    ) {
        Map<Integer, List<Edge>> result = new LinkedHashMap<>();
        for (Map.Entry<Integer, List<DungeonClusterBoundary>> entry : sourceEntries(boundariesByLevel)) {
            List<Edge> edges = closedBoundaryEdges(entry.getValue(), center);
            if (!edges.isEmpty()) {
                result.put(entry.getKey(), edges);
            }
        }
        return Map.copyOf(result);
    }

    private static List<DungeonRoom> authoredRooms(
            List<Room> coreRooms,
            DungeonRoomTopologyClusterWork previous
    ) {
        List<DungeonRoom> result = new ArrayList<>();
        for (Room room : coreRooms == null ? List.<Room>of() : coreRooms) {
            result.add(DungeonRoom.fromCore(room, narrationFor(previous, room.roomId())));
        }
        return List.copyOf(result);
    }

    private static DungeonRoomNarration narrationFor(DungeonRoomTopologyClusterWork previous, long roomId) {
        for (DungeonRoom room : previous.rooms()) {
            if (room != null && room.roomId() == roomId) {
                return room.narration();
            }
        }
        return DungeonRoomNarration.empty();
    }

    private static Iterable<Map.Entry<Integer, List<DungeonClusterBoundary>>> sourceEntries(
            @Nullable Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel
    ) {
        return boundariesByLevel == null
                ? List.<Map.Entry<Integer, List<DungeonClusterBoundary>>>of()
                : boundariesByLevel.entrySet();
    }

    private static List<Edge> closedBoundaryEdges(
            @Nullable List<DungeonClusterBoundary> boundaries,
            @Nullable Cell center
    ) {
        List<Edge> result = new ArrayList<>();
        for (DungeonClusterBoundary boundary : boundaries == null ? List.<DungeonClusterBoundary>of() : boundaries) {
            Edge edge = closedBoundaryEdge(boundary, center);
            if (edge != null) {
                result.add(edge);
            }
        }
        return List.copyOf(result);
    }

    private static @Nullable Edge closedBoundaryEdge(
            @Nullable DungeonClusterBoundary boundary,
            @Nullable Cell center
    ) {
        if (boundary == null || boundary.isOpen() || center == null) {
            return null;
        }
        return boundary.absoluteEdge(center);
    }
}
