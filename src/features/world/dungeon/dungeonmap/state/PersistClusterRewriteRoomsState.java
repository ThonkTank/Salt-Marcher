package features.world.dungeon.dungeonmap.state;

import features.world.dungeon.dungeonmap.input.PersistClusterRewriteRoomsInput;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;

/**
 * Passive map-owned room rewrite persistence state. This slice carries only the final room rows that must exist after
 * one cluster rewrite commit; it does not expose legacy map/application collaborators or JDBC scope.
 */
@SuppressWarnings("unused")
public record PersistClusterRewriteRoomsState(
        long mapId,
        List<ClusterState> rewrittenClusters,
        List<Long> removedRoomIds
) {

    public PersistClusterRewriteRoomsState {
        if (mapId <= 0) {
            throw new IllegalArgumentException("mapId");
        }
        rewrittenClusters = normalizedClusters(rewrittenClusters);
        removedRoomIds = normalizedRemovedRoomIds(removedRoomIds);
    }

    public static PersistClusterRewriteRoomsState persistClusterRewriteRooms(PersistClusterRewriteRoomsState state) {
        if (state == null) {
            throw new IllegalArgumentException("state");
        }
        return new PersistClusterRewriteRoomsState(
                state.mapId(),
                state.rewrittenClusters(),
                state.removedRoomIds());
    }

    public static PersistClusterRewriteRoomsState persistClusterRewriteRooms(PersistClusterRewriteRoomsInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        ArrayList<ClusterState> rewrittenClusters = new ArrayList<>();
        List<PersistClusterRewriteRoomsInput.ClusterInput> clusterInputs = input.rewrittenClusters() == null
                ? List.of()
                : input.rewrittenClusters();
        for (PersistClusterRewriteRoomsInput.ClusterInput cluster : clusterInputs) {
            if (cluster == null) {
                continue;
            }
            ArrayList<RoomState> rooms = new ArrayList<>();
            List<PersistClusterRewriteRoomsInput.RoomInput> roomInputs = cluster.rooms() == null
                    ? List.of()
                    : cluster.rooms();
            for (PersistClusterRewriteRoomsInput.RoomInput room : roomInputs) {
                if (room == null) {
                    continue;
                }
                ArrayList<LevelAnchorState> anchors = new ArrayList<>();
                List<PersistClusterRewriteRoomsInput.LevelAnchorInput> levelAnchorInputs = room.levelAnchors() == null
                        ? List.of()
                        : room.levelAnchors();
                for (PersistClusterRewriteRoomsInput.LevelAnchorInput anchor : levelAnchorInputs) {
                    if (anchor == null) {
                        continue;
                    }
                    anchors.add(new LevelAnchorState(anchor.levelZ(), anchor.anchorX2(), anchor.anchorY2()));
                }
                ArrayList<ExitNarrationState> exitNarrations = new ArrayList<>();
                List<PersistClusterRewriteRoomsInput.ExitNarrationInput> exitNarrationInputs = room.exitNarrations() == null
                        ? List.of()
                        : room.exitNarrations();
                for (PersistClusterRewriteRoomsInput.ExitNarrationInput exitNarration : exitNarrationInputs) {
                    if (exitNarration == null) {
                        continue;
                    }
                    exitNarrations.add(new ExitNarrationState(
                            exitNarration.levelZ(),
                            exitNarration.roomCellX(),
                            exitNarration.roomCellY(),
                            exitNarration.direction(),
                            exitNarration.description()));
                }
                rooms.add(new RoomState(
                        room.roomId(),
                        room.name(),
                        anchors,
                        room.visualDescription(),
                        exitNarrations));
            }
            rewrittenClusters.add(new ClusterState(cluster.clusterId(), rooms));
        }
        return new PersistClusterRewriteRoomsState(
                input.mapId(),
                rewrittenClusters,
                input.removedRoomIds());
    }

    public record ClusterState(
            long clusterId,
            List<RoomState> rooms
    ) {

        public ClusterState {
            if (clusterId <= 0) {
                throw new IllegalArgumentException("clusterId");
            }
            rooms = normalizedRooms(rooms);
        }
    }

    public record RoomState(
            Long roomId,
            String name,
            List<LevelAnchorState> levelAnchors,
            String visualDescription,
            List<ExitNarrationState> exitNarrations
    ) {

        public RoomState {
            name = normalizedName(name);
            levelAnchors = normalizedAnchors(levelAnchors);
            visualDescription = normalizedDescription(visualDescription);
            exitNarrations = normalizedExitNarrations(exitNarrations);
        }
    }

    public record LevelAnchorState(
            int levelZ,
            int anchorX2,
            int anchorY2
    ) {
    }

    public record ExitNarrationState(
            int levelZ,
            int roomCellX,
            int roomCellY,
            String direction,
            String description
    ) {

        public ExitNarrationState {
            direction = normalizedDirection(direction);
            description = normalizedDescription(description);
        }
    }

    private static List<ClusterState> normalizedClusters(List<ClusterState> clusters) {
        if (clusters == null || clusters.isEmpty()) {
            return List.of();
        }
        ArrayList<ClusterState> normalizedClusters = new ArrayList<>();
        for (ClusterState cluster : clusters) {
            if (cluster != null) {
                normalizedClusters.add(cluster);
            }
        }
        return normalizedClusters.isEmpty() ? List.of() : List.copyOf(normalizedClusters);
    }

    private static List<RoomState> normalizedRooms(List<RoomState> rooms) {
        if (rooms == null || rooms.isEmpty()) {
            return List.of();
        }
        ArrayList<RoomState> normalizedRooms = new ArrayList<>();
        for (RoomState room : rooms) {
            if (room != null) {
                normalizedRooms.add(room);
            }
        }
        return normalizedRooms.isEmpty() ? List.of() : List.copyOf(normalizedRooms);
    }

    private static List<LevelAnchorState> normalizedAnchors(List<LevelAnchorState> anchors) {
        if (anchors == null || anchors.isEmpty()) {
            throw new IllegalArgumentException("levelAnchors");
        }
        ArrayList<LevelAnchorState> normalizedAnchors = new ArrayList<>();
        for (LevelAnchorState anchor : anchors) {
            if (anchor != null) {
                normalizedAnchors.add(anchor);
            }
        }
        if (normalizedAnchors.isEmpty()) {
            throw new IllegalArgumentException("levelAnchors");
        }
        return List.copyOf(normalizedAnchors);
    }

    private static List<ExitNarrationState> normalizedExitNarrations(List<ExitNarrationState> exitNarrations) {
        if (exitNarrations == null || exitNarrations.isEmpty()) {
            return List.of();
        }
        ArrayList<ExitNarrationState> normalizedExitNarrations = new ArrayList<>();
        for (ExitNarrationState exitNarration : exitNarrations) {
            if (exitNarration != null) {
                normalizedExitNarrations.add(exitNarration);
            }
        }
        return normalizedExitNarrations.isEmpty() ? List.of() : List.copyOf(normalizedExitNarrations);
    }

    private static List<Long> normalizedRemovedRoomIds(List<Long> roomIds) {
        if (roomIds == null || roomIds.isEmpty()) {
            return List.of();
        }
        LinkedHashSet<Long> normalizedRoomIds = new LinkedHashSet<>();
        for (Long roomId : roomIds) {
            if (roomId != null && roomId > 0) {
                normalizedRoomIds.add(roomId);
            }
        }
        return normalizedRoomIds.isEmpty() ? List.of() : List.copyOf(normalizedRoomIds);
    }

    private static String normalizedName(String name) {
        return name == null ? "" : name.trim();
    }

    private static String normalizedDescription(String description) {
        return description == null ? "" : description.trim();
    }

    private static String normalizedDirection(String direction) {
        String normalizedDirection = direction == null ? "" : direction.trim().toUpperCase(Locale.ROOT);
        return switch (normalizedDirection) {
            case "", "N", "NORTH" -> "NORTH";
            case "E", "EAST" -> "EAST";
            case "S", "SOUTH" -> "SOUTH";
            case "W", "WEST" -> "WEST";
            default -> throw new IllegalArgumentException("direction");
        };
    }
}
