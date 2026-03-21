package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;

import java.util.ArrayList;
import java.util.List;

final class DungeonEditorLabelTargets {

    private final ClusterLabelTargetFactory clusterLabelTargetFactory = new ClusterLabelTargetFactory();

    List<DungeonEditorLabelHitTarget> forLayout(DungeonLayout layout) {
        if (layout == null) {
            return List.of();
        }
        List<DungeonEditorLabelHitTarget> result = new ArrayList<>();
        for (RoomCluster cluster : layout.clusters()) {
            DungeonEditorLabelHitTarget labelTarget = clusterLabelTargetFactory.fromCluster(cluster);
            if (labelTarget != null) {
                result.add(labelTarget);
            }
        }
        return List.copyOf(result);
    }
}
