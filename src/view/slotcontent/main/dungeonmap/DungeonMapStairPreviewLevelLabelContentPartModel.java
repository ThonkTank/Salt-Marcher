package src.view.slotcontent.main.dungeonmap;

import java.util.List;
import src.domain.dungeon.published.DungeonCellRef;

final class DungeonMapStairPreviewLevelLabelContentPartModel {
    private static final String FEATURE_LABEL_KIND = "FEATURE_LABEL";

    private DungeonMapStairPreviewLevelLabelContentPartModel() {
    }

    static void addLevelLabel(
            List<DungeonMapContentModel.DungeonMapRenderState.Label> labels,
            DungeonCellRef cell,
            long featureId,
            DungeonMapContentModel.DungeonMapRenderState.TopologyRef topologyRef
    ) {
        labels.add(new DungeonMapContentModel.DungeonMapRenderState.Label(
                "z=" + cell.level(),
                cell.q() + 0.5,
                cell.r() + 0.5,
                cell.level(),
                featureId,
                0L,
                topologyRef,
                FEATURE_LABEL_KIND,
                false,
                true,
                0.0,
                0.0));
    }
}
