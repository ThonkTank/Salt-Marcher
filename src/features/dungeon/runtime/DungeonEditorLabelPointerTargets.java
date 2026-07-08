package src.features.dungeon.runtime;

import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import src.domain.dungeon.published.DungeonEditorHandleRef;
import src.domain.dungeon.published.DungeonEditorHandleSnapshot;
import src.domain.dungeon.published.DungeonEditorMapSnapshot;
import src.domain.dungeon.published.DungeonEditorMapSurfaceSnapshot;

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
            targets.put(DungeonEditorMapHitRefs.label(
                            ref.ownerId(),
                            ref.clusterId(),
                            ref.topologyRef(),
                            CLUSTER_LABEL_KIND).value(),
                    DungeonEditorRuntimePointerTarget.label(
                            DungeonEditorRuntimePointerTarget.LabelKind.CLUSTER_LABEL,
                            ref.ownerId(),
                            ref.clusterId(),
                            DungeonEditorRuntimePointerTargetCompatibility.legacyTopologyKind(
                                    DungeonEditorMapHitRefs.topologyKind(ref.topologyRef())),
                            DungeonEditorMapHitRefs.topologyId(ref.topologyRef())));
        }
    }
}
