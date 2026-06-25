package src.features.dungeon.runtime;

import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import src.domain.dungeon.published.DungeonEditorHandleRef;
import src.domain.dungeon.published.DungeonEditorHandleSnapshot;
import src.domain.dungeon.published.DungeonEditorMapHitRef;
import src.domain.dungeon.published.DungeonEditorMapSnapshot;
import src.domain.dungeon.published.DungeonEditorMapSurfaceSnapshot;

final class DungeonEditorLabelPointerTargets {
    private static final String CLUSTER_LABEL_KIND = "CLUSTER_LABEL";
    private static final String FEATURE_LABEL_KIND = "FEATURE_LABEL";

    private DungeonEditorLabelPointerTargets() {
    }

    static void addTargets(
            Map<String, DungeonEditorRuntimePointerTarget> targets,
            DungeonEditorMapSnapshot map,
            DungeonEditorMapSurfaceSnapshot snapshot
    ) {
        addClusterLabelTargets(targets, map, snapshot);
        addFeatureLabelTargets(targets, map, snapshot);
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
            targets.put(DungeonEditorMapHitRef.label(
                            ref.ownerId(),
                            ref.clusterId(),
                            ref.topologyRef(),
                            CLUSTER_LABEL_KIND).value(),
                    DungeonEditorRuntimePointerTargetFactory.label(
                            CLUSTER_LABEL_KIND,
                            ref.ownerId(),
                            ref.clusterId(),
                            ref.topologyRef()));
        }
    }

    private static void addFeatureLabelTargets(
            Map<String, DungeonEditorRuntimePointerTarget> targets,
            DungeonEditorMapSnapshot map,
            DungeonEditorMapSurfaceSnapshot snapshot
    ) {
        for (DungeonEditorMapSnapshot.Feature feature : map.features()) {
            if (feature.cells().isEmpty()
                    || !DungeonEditorProjectionLevelInclusion.includes(snapshot, feature.cells().getFirst().level())) {
                continue;
            }
            targets.put(DungeonEditorMapHitRef.label(
                            feature.id(),
                            0L,
                            feature.topologyRef(),
                            FEATURE_LABEL_KIND).value(),
                    DungeonEditorRuntimePointerTargetFactory.label(
                            FEATURE_LABEL_KIND,
                            feature.id(),
                            0L,
                            feature.topologyRef()));
        }
    }
}
