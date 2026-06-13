package src.domain.dungeon.model.core.structure.room;

import java.util.ArrayList;
import java.util.Collections;
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
                closedBoundaryEdgesByLevel(flattenBoundaries(boundariesByLevel), work.cluster().center()),
                ids.nextRoomId());
        return authoredRooms(coreRooms, work);
    }

    public static Map<Integer, List<Edge>> closedBoundaryEdgesByLevel(
            Iterable<DungeonClusterBoundary> orderedBoundaries,
            @Nullable Cell center
    ) {
        Map<Integer, List<Edge>> mutable = new LinkedHashMap<>();
        for (DungeonClusterBoundary boundary : orderedBoundaries == null ? List.<DungeonClusterBoundary>of() : orderedBoundaries) {
            Edge edge = closedBoundaryEdge(boundary, center);
            if (edge != null) {
                mutable.computeIfAbsent(boundary.level(), ignored -> new ArrayList<>()).add(edge);
            }
        }
        Map<Integer, List<Edge>> result = new LinkedHashMap<>();
        for (Map.Entry<Integer, List<Edge>> entry : mutable.entrySet()) {
            result.put(entry.getKey(), List.copyOf(entry.getValue()));
        }
        return Collections.unmodifiableMap(result);
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

    private static List<DungeonClusterBoundary> flattenBoundaries(
            @Nullable Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel
    ) {
        if (boundariesByLevel == null || boundariesByLevel.isEmpty()) {
            return List.of();
        }
        List<DungeonClusterBoundary> flattened = new ArrayList<>();
        for (List<DungeonClusterBoundary> boundaries : boundariesByLevel.values()) {
            for (DungeonClusterBoundary boundary : boundaries == null ? List.<DungeonClusterBoundary>of() : boundaries) {
                if (boundary != null) {
                    flattened.add(boundary);
                }
            }
        }
        return List.copyOf(flattened);
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
