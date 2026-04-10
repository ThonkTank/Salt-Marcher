package features.world.dungeon.dungeonmap.cluster.state;

import features.world.dungeon.dungeonmap.cluster.input.PersistClusterRewriteTailInput;

import java.sql.Connection;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;

/**
 * Passive cluster-owned rewrite-tail state. This slice carries the projected final room rows for one persisted
 * cluster rewrite tail without exposing raw rewrite models to later canonical repository work.
 */
@SuppressWarnings("unused")
public record PersistClusterRewriteTailState(
        Connection connection,
        long mapId,
        List<ClusterState> rewrittenClusters,
        List<Long> removedRoomIds
) {

    public PersistClusterRewriteTailState {
        rewrittenClusters = normalizedClusters(rewrittenClusters);
        removedRoomIds = normalizedRemovedRoomIds(removedRoomIds);
    }

    public static PersistClusterRewriteTailState persistClusterRewriteTail(
            PersistClusterRewriteTailInput input
    ) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        ArrayList<ClusterState> rewrittenClusters = new ArrayList<>();
        for (PersistClusterRewriteTailInput.ClusterInput cluster : input.rewrittenClusters()) {
            ClusterState projectedCluster = projectedCluster(cluster);
            if (projectedCluster != null) {
                rewrittenClusters.add(projectedCluster);
            }
        }
        return new PersistClusterRewriteTailState(
                input.connection(),
                input.mapId(),
                rewrittenClusters,
                input.removedRoomIds());
    }

    public static PersistClusterRewriteTailInput.TailInput persistClusterRewriteTailInput(
            PersistClusterRewriteTailState state
    ) {
        if (state == null) {
            throw new IllegalArgumentException("state");
        }
        ArrayList<PersistClusterRewriteTailInput.ClusterInput> rewrittenClusters = new ArrayList<>();
        for (ClusterState cluster : state.rewrittenClusters()) {
            ArrayList<PersistClusterRewriteTailInput.RoomInput> rooms = new ArrayList<>();
            for (RoomState room : cluster.rooms()) {
                ArrayList<PersistClusterRewriteTailInput.LevelAnchorInput> anchors = new ArrayList<>();
                for (LevelAnchorState anchor : room.levelAnchors()) {
                    anchors.add(new PersistClusterRewriteTailInput.LevelAnchorInput(
                            anchor.levelZ(),
                            anchor.anchorX2(),
                            anchor.anchorY2()));
                }
                ArrayList<PersistClusterRewriteTailInput.ExitNarrationInput> exitNarrations = new ArrayList<>();
                for (ExitNarrationState exitNarration : room.exitNarrations()) {
                    exitNarrations.add(new PersistClusterRewriteTailInput.ExitNarrationInput(
                            exitNarration.levelZ(),
                            exitNarration.roomCellX(),
                            exitNarration.roomCellY(),
                            exitNarration.direction(),
                            exitNarration.description()));
                }
                rooms.add(new PersistClusterRewriteTailInput.RoomInput(
                        room.roomId(),
                        room.name(),
                        anchors.isEmpty() ? List.of() : List.copyOf(anchors),
                        room.visualDescription(),
                        exitNarrations.isEmpty() ? List.of() : List.copyOf(exitNarrations)));
            }
            rewrittenClusters.add(new PersistClusterRewriteTailInput.ClusterInput(
                    cluster.clusterId(),
                    rooms.isEmpty() ? List.of() : List.copyOf(rooms)));
        }
        return new PersistClusterRewriteTailInput.TailInput(
                state.mapId(),
                rewrittenClusters.isEmpty() ? List.of() : List.copyOf(rewrittenClusters),
                state.removedRoomIds());
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
            name = name == null ? "" : name.trim();
            levelAnchors = normalizedAnchors(levelAnchors);
            visualDescription = visualDescription == null ? "" : visualDescription.trim();
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
            direction = direction == null ? "NORTH" : direction.trim();
            description = description == null ? "" : description.trim();
        }
    }

    private static ClusterState projectedCluster(PersistClusterRewriteTailInput.ClusterInput cluster) {
        if (cluster == null) {
            return null;
        }
        long clusterId = cluster.clusterId();
        if (clusterId == null || clusterId <= 0) {
            return null;
        }
        ArrayList<RoomState> rooms = new ArrayList<>();
        for (PersistClusterRewriteTailInput.RoomInput roomValue : cluster.rooms() == null ? List.<PersistClusterRewriteTailInput.RoomInput>of() : cluster.rooms()) {
            RoomState room = projectedRoom(roomValue);
            if (room != null) {
                rooms.add(room);
            }
        }
        return new ClusterState(clusterId, rooms);
    }

    private static RoomState projectedRoom(PersistClusterRewriteTailInput.RoomInput room) {
        if (room == null) {
            return null;
        }
        ArrayList<LevelAnchorState> anchors = new ArrayList<>();
        for (PersistClusterRewriteTailInput.LevelAnchorInput anchor : room.levelAnchors() == null ? List.<PersistClusterRewriteTailInput.LevelAnchorInput>of() : room.levelAnchors()) {
            if (anchor != null) {
                anchors.add(new LevelAnchorState(anchor.levelZ(), anchor.anchorX2(), anchor.anchorY2()));
            }
        }
        ArrayList<ExitNarrationState> exitNarrations = new ArrayList<>();
        for (PersistClusterRewriteTailInput.ExitNarrationInput exitNarration : room.exitNarrations() == null
                ? List.<PersistClusterRewriteTailInput.ExitNarrationInput>of()
                : room.exitNarrations()) {
            if (exitNarration != null) {
                exitNarrations.add(new ExitNarrationState(
                        exitNarration.levelZ(),
                        exitNarration.roomCellX(),
                        exitNarration.roomCellY(),
                        exitNarration.direction(),
                        exitNarration.description()));
            }
        }
        return new RoomState(
                room.roomId(),
                room.name(),
                anchors,
                room.visualDescription(),
                exitNarrations);
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
            return List.of();
        }
        ArrayList<LevelAnchorState> normalizedAnchors = new ArrayList<>();
        for (LevelAnchorState anchor : anchors) {
            if (anchor != null) {
                normalizedAnchors.add(anchor);
            }
        }
        return normalizedAnchors.isEmpty() ? List.of() : List.copyOf(normalizedAnchors);
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

    private static List<Long> normalizedRemovedRoomIds(List<Long> removedRoomIds) {
        if (removedRoomIds == null || removedRoomIds.isEmpty()) {
            return List.of();
        }
        LinkedHashSet<Long> normalizedRoomIds = new LinkedHashSet<>();
        for (Long roomId : removedRoomIds) {
            if (roomId != null && roomId > 0) {
                normalizedRoomIds.add(roomId);
            }
        }
        return normalizedRoomIds.isEmpty() ? List.of() : List.copyOf(normalizedRoomIds);
    }
}
