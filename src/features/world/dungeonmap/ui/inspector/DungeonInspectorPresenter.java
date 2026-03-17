package features.world.dungeonmap.ui.inspector;

import features.world.dungeonmap.api.DungeonCorridorSummary;
import features.world.dungeonmap.api.DungeonRoomClusterSummary;
import features.world.dungeonmap.api.DungeonRoomSummary;
import features.world.dungeonmap.model.DungeonCorridor;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.DungeonGeometry;
import features.world.dungeonmap.model.DungeonRoom;
import features.world.dungeonmap.model.DungeonRoomCluster;
import features.world.dungeonmap.model.RoomShape;

public final class DungeonInspectorPresenter {

    private DungeonInspectorPresenter() {
    }

    public static DungeonRoomSummary roomSummary(DungeonLayout layout, DungeonRoom room, boolean active) {
        if (room == null) {
            return null;
        }
        if (layout == null || layout.map() == null) {
            throw new IllegalArgumentException("Raum-Inspector braucht ein geladenes Layout");
        }
        RoomShape shape = DungeonGeometry.roomShape(layout, room);
        return new DungeonRoomSummary(
                room.roomId(),
                layout.map().mapId(),
                room.name(),
                shape.center().x(),
                shape.center().y(),
                shape.relativeVertices().size(),
                active);
    }

    public static DungeonRoomClusterSummary clusterSummary(DungeonLayout layout, DungeonRoomCluster cluster, boolean active) {
        if (cluster == null) {
            return null;
        }
        java.util.List<Long> roomIds = layout == null
                ? java.util.List.of()
                : layout.roomsForCluster(cluster.clusterId()).stream()
                        .map(DungeonRoom::roomId)
                        .filter(java.util.Objects::nonNull)
                        .sorted()
                        .toList();
        java.util.List<String> roomNames = roomIds.stream()
                .map(roomId -> {
                    DungeonRoom room = findRoom(layout, roomId);
                    return room == null ? "Raum " + roomId : room.name();
                })
                .toList();
        return new DungeonRoomClusterSummary(
                cluster.clusterId(),
                cluster.mapId(),
                roomIds,
                roomNames,
                corridorIdsForCluster(layout, cluster.clusterId()),
                cluster.center().x(),
                cluster.center().y(),
                active);
    }

    public static DungeonCorridorSummary corridorSummary(DungeonLayout layout, DungeonCorridor corridor, boolean active) {
        if (corridor == null) {
            return null;
        }
        java.util.List<Long> roomIds = corridor.roomIds();
        java.util.List<String> roomNames = roomIds.stream()
                .map(roomId -> {
                    DungeonRoom room = findRoom(layout, roomId);
                    return room == null ? "Raum " + roomId : room.name();
                })
                .toList();
        return new DungeonCorridorSummary(
                corridor.corridorId(),
                corridor.mapId(),
                roomIds,
                roomNames,
                active);
    }

    public static String corridorLabel(DungeonCorridorSummary summary) {
        if (summary == null) {
            return null;
        }
        return String.join(", ", summary.roomNames());
    }

    public static DungeonRoom findRoom(DungeonLayout layout, Long roomId) {
        return findRoom(layout, roomId == null ? null : Long.toString(roomId));
    }

    public static DungeonRoom findRoom(DungeonLayout layout, String roomId) {
        if (layout == null || roomId == null) {
            return null;
        }
        return layout.roomById(Long.parseLong(roomId));
    }

    public static DungeonCorridor findCorridor(DungeonLayout layout, Long corridorId) {
        return findCorridor(layout, corridorId == null ? null : Long.toString(corridorId));
    }

    public static DungeonCorridor findCorridor(DungeonLayout layout, String corridorId) {
        if (layout == null || corridorId == null) {
            return null;
        }
        return layout.corridorById(Long.parseLong(corridorId));
    }

    public static DungeonRoomCluster findCluster(DungeonLayout layout, Long clusterId) {
        if (layout == null || clusterId == null) {
            return null;
        }
        return layout.clusterById(clusterId);
    }

    public static DungeonRoomCluster findCluster(DungeonLayout layout, String clusterId) {
        if (clusterId == null) {
            return null;
        }
        return findCluster(layout, Long.parseLong(clusterId));
    }

    private static java.util.List<Long> corridorIdsForCluster(DungeonLayout layout, Long clusterId) {
        if (layout == null || clusterId == null) {
            return java.util.List.of();
        }
        java.util.LinkedHashSet<Long> corridorIds = new java.util.LinkedHashSet<>();
        for (DungeonCorridor corridor : layout.corridors()) {
            if (corridor == null || corridor.corridorId() == null) {
                continue;
            }
            for (Long roomId : corridor.roomIds()) {
                DungeonRoomCluster cluster = layout.clusterForRoom(roomId);
                if (cluster != null && clusterId.equals(cluster.clusterId())) {
                    corridorIds.add(corridor.corridorId());
                    break;
                }
            }
        }
        return java.util.List.copyOf(corridorIds);
    }
}
