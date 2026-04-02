package features.world.dungeonmap.application.room;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

public final class DungeonClusterMoveProjectionApplicationService {

    public DungeonClusterMoveProjectionApplicationService() {
    }

    public DungeonClusterMoveProjection project(
            DungeonLayout layout,
            Long clusterId,
            CellCoord delta,
            int levelDelta
    ) {
        DungeonLayout baseLayout = Objects.requireNonNull(layout, "layout");
        boolean translate = delta != null && (delta.x() != 0 || delta.y() != 0);
        RoomCluster cluster = baseLayout.findCluster(clusterId);
        if (clusterId == null || cluster == null || (!translate && levelDelta == 0)) {
            return new DungeonClusterMoveProjection(baseLayout, cluster);
        }

        RoomCluster movedCluster = cluster.movedBy(delta, levelDelta);
        List<RoomCluster> updatedClusters = baseLayout.clusters().stream()
                .map(existing -> Objects.equals(clusterId, existing.clusterId()) ? movedCluster : existing)
                .toList();
        Map<Long, Integer> updatedClusterLevels = updatedClusterLevels(baseLayout, clusterId, levelDelta);
        DungeonLayout provisionalLayout = new DungeonLayout(
                baseLayout.mapId(),
                baseLayout.name(),
                baseLayout.corridors(),
                updatedClusters,
                baseLayout.stairs(),
                baseLayout.transitions(),
                updatedClusterLevels);
        return new DungeonClusterMoveProjection(
                provisionalLayout,
                provisionalLayout.findCluster(clusterId));
    }

    private static Map<Long, Integer> updatedClusterLevels(DungeonLayout layout, Long clusterId, int levelDelta) {
        LinkedHashMap<Long, Integer> levels = new LinkedHashMap<>();
        for (RoomCluster existing : layout.clusters()) {
            if (existing != null && existing.clusterId() != null) {
                levels.put(existing.clusterId(), layout.levelForCluster(existing.clusterId()));
            }
        }
        if (clusterId != null) {
            levels.put(clusterId, layout.levelForCluster(clusterId) + levelDelta);
        }
        return Map.copyOf(levels);
    }
}
