package features.world.dungeonmap.ui.workspace.render;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.DungeonRoom;
import features.world.dungeonmap.model.DungeonRoomCluster;
import features.world.dungeonmap.model.Point2i;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

final class ClusterAnchorLayout {

    private final Point2i clusterCenter;
    private final boolean clusterOverlapsRoom;
    private final Map<Long, RoomAnchorGroup> roomGroupsById;

    private ClusterAnchorLayout(
            Point2i clusterCenter,
            boolean clusterOverlapsRoom,
            Map<Long, RoomAnchorGroup> roomGroupsById
    ) {
        this.clusterCenter = clusterCenter;
        this.clusterOverlapsRoom = clusterOverlapsRoom;
        this.roomGroupsById = Map.copyOf(roomGroupsById);
    }

    static ClusterAnchorLayout forCluster(
            DungeonLayout layout,
            DungeonRoomCluster cluster,
            Function<DungeonRoomCluster, Point2i> clusterCenterResolver,
            Function<DungeonRoom, Point2i> roomCenterResolver
    ) {
        Point2i clusterCenter = clusterCenterResolver.apply(cluster);
        List<DungeonRoom> rooms = layout.roomsForCluster(cluster.clusterId());
        Map<Long, RoomAnchorGroup> roomGroupsById = new HashMap<>();
        Map<Point2i, List<DungeonRoom>> roomsByCenter = new HashMap<>();
        for (DungeonRoom room : rooms) {
            roomsByCenter.computeIfAbsent(roomCenterResolver.apply(room), ignored -> new java.util.ArrayList<>()).add(room);
        }
        for (Map.Entry<Point2i, List<DungeonRoom>> entry : roomsByCenter.entrySet()) {
            List<DungeonRoom> groupedRooms = entry.getValue().stream()
                    .sorted(java.util.Comparator.comparing(DungeonRoom::roomId))
                    .toList();
            for (int index = 0; index < groupedRooms.size(); index++) {
                DungeonRoom room = groupedRooms.get(index);
                roomGroupsById.put(room.roomId(), new RoomAnchorGroup(entry.getKey(), index, groupedRooms.size()));
            }
        }
        boolean overlapsRoom = rooms.stream().anyMatch(room -> roomCenterResolver.apply(room).equals(clusterCenter));
        return new ClusterAnchorLayout(clusterCenter, overlapsRoom, roomGroupsById);
    }

    Point2i clusterCenter() {
        return clusterCenter;
    }

    boolean clusterOverlapsRoom() {
        return clusterOverlapsRoom;
    }

    RoomAnchorGroup roomGroup(DungeonRoom room) {
        return room == null || room.roomId() == null ? null : roomGroupsById.get(room.roomId());
    }

    record RoomAnchorGroup(Point2i center, int index, int count) {
        boolean overlapsCluster(Point2i clusterCenter) {
            return center.equals(clusterCenter);
        }
    }
}
