package features.dungeon.domain.core.structure.room;

import features.dungeon.domain.core.component.boundary.BoundarySegment;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Edge;

public final class DungeonRoomBoundaryPartition {

    public List<RoomRegion> roomsForBoundaryEdit(
            DungeonRoomTopologyClusterWork work,
            Map<Integer, List<BoundarySegment>> boundariesByLevel,
            RoomTopologyWorkCatalog.ReservedIdentities ids
    ) {
        List<RoomRegion> coreRooms = RoomClusterRoomPartition.roomsForBoundaryEdit(
                work.partitionWork(),
                closedBoundaryEdgesByLevel(DungeonBoundaryRehoming.flatten(boundariesByLevel)),
                ids);
        return authoredRooms(coreRooms, work);
    }

    public List<RoomRegion> roomsForMutation(
            DungeonRoomTopologyClusterWork work,
            Map<Integer, List<Cell>> nextCellsByLevel,
            Map<Integer, List<BoundarySegment>> boundariesByLevel,
            RoomMutationIdCursor ids,
            Map<Long, List<Cell>> previousCellsByRoom
    ) {
        RoomClusterWork coreWork = new RoomClusterWork(
                work.cluster().geometry(nextCellsByLevel),
                coreRooms(work.rooms(), work.cluster().clusterId()));
        List<RoomRegion> coreRooms = RoomClusterRoomPartition.roomsForMutation(
                coreWork,
                closedBoundaryEdgesByLevel(DungeonBoundaryRehoming.flatten(boundariesByLevel)),
                ids,
                previousCellsByRoom);
        return authoredRooms(coreRooms, work);
    }

    public static Map<Integer, List<Edge>> closedBoundaryEdgesByLevel(
            Iterable<BoundarySegment> orderedBoundaries
    ) {
        Map<Integer, List<Edge>> mutable = new LinkedHashMap<>();
        for (BoundarySegment boundary : orderedBoundaries == null ? List.<BoundarySegment>of() : orderedBoundaries) {
            Edge edge = closedBoundaryEdge(boundary);
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

    private static Edge closedBoundaryEdge(BoundarySegment boundary) {
        if (boundary == null || boundary.isOpen()) {
            return null;
        }
        return boundary.edge();
    }
}
