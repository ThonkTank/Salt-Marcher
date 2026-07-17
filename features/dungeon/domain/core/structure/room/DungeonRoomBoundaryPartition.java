package features.dungeon.domain.core.structure.room;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.jspecify.annotations.Nullable;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Edge;

public final class DungeonRoomBoundaryPartition {

    public List<RoomRegion> roomsForBoundaryEdit(
            DungeonRoomTopologyClusterWork work,
            Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel,
            RoomTopologyWorkCatalog.IdAllocation ids
    ) {
        List<RoomRegion> coreRooms = RoomClusterRoomPartition.roomsForBoundaryEdit(
                work.partitionWork(),
                closedBoundaryEdgesByLevel(DungeonBoundaryRehoming.flatten(boundariesByLevel), work.cluster().center()),
                ids.nextRoomId());
        return authoredRooms(coreRooms, work);
    }

    public List<RoomRegion> roomsForMutation(
            DungeonRoomTopologyClusterWork work,
            Map<Integer, List<Cell>> nextCellsByLevel,
            Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel,
            long nextRoomId,
            Map<Long, List<Cell>> previousCellsByRoom
    ) {
        RoomClusterWork coreWork = new RoomClusterWork(
                work.cluster().geometry(nextCellsByLevel),
                coreRooms(work.rooms(), work.cluster().clusterId()));
        List<RoomRegion> coreRooms = RoomClusterRoomPartition.roomsForMutation(
                coreWork,
                closedBoundaryEdgesByLevel(DungeonBoundaryRehoming.flatten(boundariesByLevel), work.cluster().center()),
                nextRoomId,
                previousCellsByRoom);
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

    private static List<RoomRegion> authoredRooms(
            List<RoomRegion> coreRooms,
            DungeonRoomTopologyClusterWork previous
    ) {
        List<RoomRegion> result = new ArrayList<>();
        for (RoomRegion room : coreRooms == null ? List.<RoomRegion>of() : coreRooms) {
            result.add(room.withNarration(narrationFor(previous, room.roomId())));
        }
        return List.copyOf(result);
    }

    private static DungeonRoomNarration narrationFor(DungeonRoomTopologyClusterWork previous, long roomId) {
        for (RoomRegion room : previous.rooms()) {
            if (room != null && room.roomId() == roomId) {
                return room.narration();
            }
        }
        return DungeonRoomNarration.empty();
    }

    private static List<RoomRegion> coreRooms(List<RoomRegion> rooms, long clusterId) {
        List<RoomRegion> result = new ArrayList<>();
        for (RoomRegion room : rooms == null ? List.<RoomRegion>of() : rooms) {
            if (room != null) {
                result.add(new RoomRegion(
                        room.roomId(),
                        room.mapId(),
                        clusterId,
                        room.name(),
                        room.floorCells(),
                        room.narration()));
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
