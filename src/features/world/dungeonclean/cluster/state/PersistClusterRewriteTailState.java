package features.world.dungeonclean.cluster.state;

import features.world.dungeonclean.cluster.input.PersistClusterRewriteTailInput;

import java.sql.Connection;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;

/**
 * Clean cluster-owned persisted room rewrite state.
 */
@SuppressWarnings("unused")
public record PersistClusterRewriteTailState(
        Connection connection,
        long mapId,
        List<ClusterState> rewrittenClusters,
        List<Long> removedRoomIds
) {

    public PersistClusterRewriteTailState {
        rewrittenClusters = rewrittenClusters == null ? List.of() : List.copyOf(rewrittenClusters.stream()
                .filter(java.util.Objects::nonNull)
                .toList());
        LinkedHashSet<Long> normalizedRemovedRoomIds = new LinkedHashSet<>();
        if (removedRoomIds != null) {
            for (Long roomId : removedRoomIds) {
                if (roomId != null && roomId > 0) {
                    normalizedRemovedRoomIds.add(roomId);
                }
            }
        }
        removedRoomIds = normalizedRemovedRoomIds.isEmpty() ? List.of() : List.copyOf(normalizedRemovedRoomIds);
    }

    public static PersistClusterRewriteTailState persistClusterRewriteTail(PersistClusterRewriteTailInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        ArrayList<ClusterState> rewrittenClusters = new ArrayList<>();
        for (PersistClusterRewriteTailInput.ClusterInput cluster : input.rewrittenClusters()) {
            ArrayList<RoomState> rooms = new ArrayList<>();
            for (PersistClusterRewriteTailInput.RoomInput room : cluster.rooms()) {
                ArrayList<LevelAnchorState> anchors = new ArrayList<>();
                for (PersistClusterRewriteTailInput.LevelAnchorInput anchor : room.levelAnchors()) {
                    anchors.add(new LevelAnchorState(anchor.levelZ(), anchor.anchorX2(), anchor.anchorY2()));
                }
                ArrayList<ExitNarrationState> exitNarrations = new ArrayList<>();
                for (PersistClusterRewriteTailInput.ExitNarrationInput exitNarration : room.exitNarrations()) {
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
        return new PersistClusterRewriteTailState(
                input.connection(),
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
            rooms = rooms == null ? List.of() : List.copyOf(rooms.stream()
                    .filter(java.util.Objects::nonNull)
                    .toList());
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
            levelAnchors = levelAnchors == null ? List.of() : List.copyOf(levelAnchors.stream()
                    .filter(java.util.Objects::nonNull)
                    .toList());
            visualDescription = visualDescription == null ? "" : visualDescription.trim();
            exitNarrations = exitNarrations == null ? List.of() : List.copyOf(exitNarrations.stream()
                    .filter(java.util.Objects::nonNull)
                    .toList());
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
}
