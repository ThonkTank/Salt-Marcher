package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.model.structures.cluster.RoomCluster;

final class ClusterLabelTargetFactory {

    private static final long CLUSTER_LABEL_PRIORITY = 100L;

    DungeonEditorLabelHitTarget fromCluster(RoomCluster cluster) {
        if (cluster == null || cluster.clusterId() == null) {
            return null;
        }
        return new DungeonEditorLabelHitTarget(
                cluster.labelHandle(),
                new DungeonEditorTargetRef.ClusterRef(cluster.clusterId()),
                CLUSTER_LABEL_PRIORITY);
    }
}
