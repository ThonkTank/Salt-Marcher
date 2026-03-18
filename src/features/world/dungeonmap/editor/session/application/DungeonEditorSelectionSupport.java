package features.world.dungeonmap.editor.session.application;

import features.world.dungeonmap.layout.model.DungeonLayout;
import features.world.dungeonmap.layout.model.DungeonLayoutEditResult;
import features.world.dungeonmap.view.model.DungeonSelection;

final class DungeonEditorSelectionSupport {

    private DungeonEditorSelectionSupport() {
    }

    static DungeonSelection focusedTarget(DungeonLayout layout, DungeonLayoutEditResult result) {
        if (layout == null || result == null || result.focusSelection() == null) {
            return null;
        }
        if (result.focusSelection() instanceof DungeonSelection.RoomCluster cluster
                && layout.clusterById(cluster.clusterId()) != null) {
            return cluster;
        }
        if (result.focusSelection() instanceof DungeonSelection.Corridor corridor
                && layout.corridorById(corridor.corridorId()) != null) {
            return corridor;
        }
        return null;
    }
}
