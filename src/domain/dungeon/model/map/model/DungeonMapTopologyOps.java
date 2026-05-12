package src.domain.dungeon.model.map.model;

import java.util.ArrayList;
import java.util.List;

public final class DungeonMapTopologyOps {

    private static final DungeonRoomTopologyEditor ROOM_TOPOLOGY_EDITOR = new DungeonRoomTopologyEditor();
    private static final DungeonTopologyMovementLogic TOPOLOGY_MOVEMENT_SERVICE = new DungeonTopologyMovementLogic();
    private static final DungeonEditorHandleMovementLogic HANDLE_MOVEMENT_SERVICE = new DungeonEditorHandleMovementLogic();

    private DungeonMapTopologyOps() {
    }

    public static DungeonMap moveRoomAnchor(DungeonMap dungeonMap, int deltaQ, int deltaR) {
        return TOPOLOGY_MOVEMENT_SERVICE.moveRoomAnchor(dungeonMap, deltaQ, deltaR);
    }

    public static DungeonMap moveTopologyElement(
            DungeonMap dungeonMap,
            DungeonTopologyRef ref,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        return TOPOLOGY_MOVEMENT_SERVICE.moveTopologyElement(dungeonMap, ref, deltaQ, deltaR, deltaLevel);
    }

    public static DungeonMap moveEditorHandle(
            DungeonMap dungeonMap,
            DungeonEditorHandle handle,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        return HANDLE_MOVEMENT_SERVICE.moveEditorHandle(dungeonMap, handle, deltaQ, deltaR, deltaLevel);
    }

    public static DungeonMap moveBoundaryStretch(
            DungeonMap dungeonMap,
            long clusterId,
            List<DungeonEdge> sourceEdges,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        return ROOM_TOPOLOGY_EDITOR.moveBoundaryStretch(dungeonMap, clusterId, sourceEdges, deltaQ, deltaR, deltaLevel);
    }

    public static DungeonMap saveRoomNarration(DungeonMap dungeonMap, long roomId, DungeonRoomNarration narration) {
        if (roomId <= 0L || narration == null) {
            return dungeonMap;
        }
        List<DungeonRoom> nextRooms = new ArrayList<>();
        boolean changed = false;
        for (DungeonRoom room : dungeonMap.rooms().rooms()) {
            if (room.roomId() == roomId) {
                nextRooms.add(room.withNarration(narration));
                changed = true;
            } else {
                nextRooms.add(room);
            }
        }
        return changed
                ? new DungeonMap(
                        dungeonMap.metadata(),
                        dungeonMap.topology(),
                        dungeonMap.topologyIndex(),
                        dungeonMap.spaces(),
                        new RoomCatalog(nextRooms),
                        dungeonMap.connections(),
                        dungeonMap.features(),
                        dungeonMap.revision() + 1L)
                : dungeonMap;
    }

    public static DungeonMap paintRoomRectangle(DungeonMap dungeonMap, DungeonCell start, DungeonCell end) {
        return ROOM_TOPOLOGY_EDITOR.paintRectangle(dungeonMap, start, end);
    }

    public static DungeonMap deleteRoomRectangle(DungeonMap dungeonMap, DungeonCell start, DungeonCell end) {
        return ROOM_TOPOLOGY_EDITOR.deleteRectangle(dungeonMap, start, end);
    }

    public static DungeonMap editClusterBoundaries(
            DungeonMap dungeonMap,
            long clusterId,
            List<DungeonEdge> edges,
            DungeonClusterBoundaryKind kind,
            boolean deleteBoundary
    ) {
        return ROOM_TOPOLOGY_EDITOR.editBoundaries(dungeonMap, clusterId, edges, kind, deleteBoundary);
    }
}
