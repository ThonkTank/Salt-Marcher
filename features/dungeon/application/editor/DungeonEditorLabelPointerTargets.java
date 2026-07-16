package features.dungeon.application.editor;

import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import features.dungeon.api.DungeonEditorHandleRef;
import features.dungeon.api.DungeonEditorHandleSnapshot;
import features.dungeon.api.DungeonEditorMapSnapshot;
import features.dungeon.api.DungeonEditorMapSurfaceSnapshot;

final class DungeonEditorLabelPointerTargets {
    private static final String CLUSTER_LABEL_KIND = "CLUSTER_LABEL";

    private DungeonEditorLabelPointerTargets() {
    }

    static void addTargets(
            Map<String, DungeonEditorRuntimePointerTarget> targets,
            DungeonEditorMapSnapshot map,
            DungeonEditorMapSurfaceSnapshot snapshot
    ) {
        addClusterLabelTargets(targets, map, snapshot);
    }

    private static void addClusterLabelTargets(
            Map<String, DungeonEditorRuntimePointerTarget> targets,
            DungeonEditorMapSnapshot map,
            DungeonEditorMapSurfaceSnapshot snapshot
    ) {
        Set<Long> renderedClusterIds = new LinkedHashSet<>();
        for (DungeonEditorHandleSnapshot handle : map.editorHandles()) {
            DungeonEditorHandleRef ref = handle.ref();
            if (!ref.kind().isClusterLabel()
                    || ref.clusterId() <= 0L
                    || !DungeonEditorProjectionLevelInclusion.includes(snapshot, handle.cell().level())
                    || !renderedClusterIds.add(ref.clusterId())) {
                continue;
            }
            targets.put(DungeonEditorLabelHitRefs.label(
                            ref.ownerId(),
                            ref.clusterId(),
                            ref.topologyRef(),
                            CLUSTER_LABEL_KIND).value(),
                    DungeonEditorRuntimePointerTarget.label(
                            DungeonEditorRuntimePointerTarget.LabelKind.CLUSTER_LABEL,
                            ref.ownerId(),
                            ref.clusterId(),
                            DungeonEditorRuntimePointerTarget.TopologyKind.fromPublished(ref.topologyRef().kind()),
                            DungeonEditorTopologyHitRefs.topologyId(ref.topologyRef())));
        }
    }
}
