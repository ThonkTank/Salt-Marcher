package features.world.dungeonclean.cluster.input;

import java.util.List;

@SuppressWarnings("unused")
public record PersistClusterRewriteTailInput(
        long mapId,
        List<ClusterInput> rewrittenClusters,
        List<Long> removedRoomIds
) {

    public record ClusterInput(
            long clusterId,
            List<RoomInput> rooms
    ) {
    }

    public record RoomInput(
            Long roomId,
            String name,
            List<LevelAnchorInput> levelAnchors,
            String visualDescription,
            List<ExitNarrationInput> exitNarrations
    ) {
    }

    public record LevelAnchorInput(
            int levelZ,
            int anchorX2,
            int anchorY2
    ) {
    }

    public record ExitNarrationInput(
            int levelZ,
            int roomCellX,
            int roomCellY,
            String direction,
            String description
    ) {
    }
}
