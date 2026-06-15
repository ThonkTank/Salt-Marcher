package src.domain.dungeon;

import src.domain.dungeon.published.DungeonEditorMapSnapshot;
import src.domain.dungeon.published.DungeonEditorTopologyElementRef;

final class DungeonEditorPreviewFeatureDiffProjectionServiceAssembly {

    private DungeonEditorPreviewFeatureDiffProjectionServiceAssembly() {
    }

    static DungeonEditorPreviewFactDiffProjectionServiceAssembly<DungeonEditorMapSnapshot.Feature> diff(
            DungeonEditorMapSnapshot committedMap,
            DungeonEditorMapSnapshot previewMap
    ) {
        return DungeonEditorPreviewDiffValuesProjectionServiceAssembly.diff(
                committedMap.features(),
                previewMap.features(),
                DungeonEditorPreviewFeatureDiffProjectionServiceAssembly::key);
    }

    private static FeatureKey key(DungeonEditorMapSnapshot.Feature feature) {
        DungeonEditorTopologyElementRef ref = feature.topologyRef();
        return new FeatureKey(feature.kind(), ref.kind(), ref.id(), feature.id());
    }

    private record FeatureKey(String featureKind, String topologyKind, long topologyId, long featureId) {
    }
}
