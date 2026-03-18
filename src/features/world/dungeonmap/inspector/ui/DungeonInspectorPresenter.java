package features.world.dungeonmap.inspector.ui;

import features.world.dungeonmap.api.DungeonCorridorSummary;
import features.world.dungeonmap.api.DungeonRoomClusterSummary;
import features.world.dungeonmap.api.DungeonRoomSummary;
import features.world.dungeonmap.corridors.model.CorridorComponent;
import features.world.dungeonmap.corridors.model.CorridorTopology;
import features.world.dungeonmap.corridors.model.DungeonCorridor;
import features.world.dungeonmap.layout.model.DungeonLayout;
import features.world.dungeonmap.rooms.model.DungeonGeometry;
import features.world.dungeonmap.rooms.model.DungeonRoom;
import features.world.dungeonmap.rooms.model.DungeonRoomCluster;
import features.world.dungeonmap.rooms.model.RoomShape;
import features.world.dungeonmap.view.model.DungeonRuntimeLocation;

import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

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
        List<Long> roomIds = layout == null
                ? List.of()
                : layout.roomsForCluster(cluster.clusterId()).stream()
                        .map(DungeonRoom::roomId)
                        .filter(Objects::nonNull)
                        .sorted()
                        .toList();
        List<String> roomNames = roomIds.stream()
                .map(roomId -> {
                    DungeonRoom room = findRoom(layout, roomId);
                    return room == null ? "Raum " + roomId : room.name();
                })
                .toList();
        Set<Long> roomIdSet = new HashSet<>(roomIds);
        return new DungeonRoomClusterSummary(
                cluster.clusterId(),
                cluster.mapId(),
                roomIds,
                roomNames,
                corridorIdsForCluster(layout, roomIdSet),
                cluster.center().x(),
                cluster.center().y(),
                active);
    }

    public static DungeonCorridorSummary corridorSummary(DungeonLayout layout, DungeonCorridor corridor, boolean active) {
        if (corridor == null) {
            return null;
        }
        List<Long> roomIds = corridor.roomIds();
        List<String> roomNames = roomIds.stream()
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

    public static String activeLocationLabel(DungeonLayout layout, DungeonRuntimeLocation location, CorridorTopology corridorTopology) {
        if (location == null || layout == null) {
            return null;
        }
        if (location instanceof DungeonRuntimeLocation.CorridorComponent corridorComponentLocation) {
            CorridorComponent component = corridorTopology == null
                    ? null
                    : corridorTopology.componentById(corridorComponentLocation.componentId());
            if (component == null) {
                return null;
            }
            return component.roomIds().stream()
                    .sorted()
                    .map(roomId -> {
                        DungeonRoom room = findRoom(layout, roomId);
                        return room == null ? "Raum " + roomId : room.name();
                    })
                    .reduce((left, right) -> left + ", " + right)
                    .orElse("Korridor");
        }
        if (location instanceof DungeonRuntimeLocation.Room roomLocation) {
            DungeonRoom room = findRoom(layout, roomLocation.roomId());
            return room == null ? null : room.name();
        }
        return null;
    }

    public static String corridorLabel(DungeonCorridorSummary summary) {
        if (summary == null) {
            return null;
        }
        return String.join(", ", summary.roomNames());
    }

    public static DungeonRoom findRoom(DungeonLayout layout, Long roomId) {
        if (layout == null || roomId == null) {
            return null;
        }
        return layout.roomById(roomId);
    }

    public static DungeonRoom findRoom(DungeonLayout layout, String roomId) {
        return findRoom(layout, roomId == null ? null : Long.parseLong(roomId));
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

    private static List<Long> corridorIdsForCluster(DungeonLayout layout, Set<Long> roomIds) {
        if (layout == null || roomIds.isEmpty()) {
            return List.of();
        }
        return layout.corridors().stream()
                .filter(c -> c != null && c.corridorId() != null)
                .filter(c -> c.roomIds().stream().anyMatch(roomIds::contains))
                .map(DungeonCorridor::corridorId)
                .toList();
    }
}
