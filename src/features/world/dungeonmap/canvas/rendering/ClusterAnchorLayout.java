package features.world.dungeonmap.canvas.rendering;

import features.world.dungeonmap.layout.model.DungeonLayout;
import features.world.dungeonmap.rooms.model.DungeonRoom;
import features.world.dungeonmap.rooms.model.DungeonRoomCluster;
import features.world.dungeonmap.foundation.geometry.Point2i;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

public final class ClusterAnchorLayout {

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

    public static ClusterAnchorLayout forCluster(
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
            roomsByCenter.computeIfAbsent(roomCenterResolver.apply(room), ignored -> new ArrayList<>()).add(room);
        }
        for (Map.Entry<Point2i, List<DungeonRoom>> entry : roomsByCenter.entrySet()) {
            List<DungeonRoom> groupedRooms = entry.getValue().stream()
                    .sorted(Comparator.comparing(DungeonRoom::roomId))
                    .toList();
            for (int index = 0; index < groupedRooms.size(); index++) {
                DungeonRoom room = groupedRooms.get(index);
                roomGroupsById.put(room.roomId(), new RoomAnchorGroup(entry.getKey(), index, groupedRooms.size()));
            }
        }
        boolean overlapsRoom = rooms.stream().anyMatch(room -> roomCenterResolver.apply(room).equals(clusterCenter));
        return new ClusterAnchorLayout(clusterCenter, overlapsRoom, roomGroupsById);
    }

    public Point2i clusterCenter() {
        return clusterCenter;
    }

    public boolean clusterOverlapsRoom() {
        return clusterOverlapsRoom;
    }

    public RoomAnchorGroup roomGroup(DungeonRoom room) {
        return room == null || room.roomId() == null ? null : roomGroupsById.get(room.roomId());
    }

    public record AnchorPosition(double x, double y) {
    }

    public record RoomAnchorGroup(Point2i center, int index, int count) {
        public boolean overlapsCluster(Point2i clusterCenter) {
            return center.equals(clusterCenter);
        }
    }
}
