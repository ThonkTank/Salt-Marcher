package features.dungeon.adapter.javafx.map;

import java.util.List;
import java.util.Map;
import org.jspecify.annotations.Nullable;
import features.dungeon.application.editor.DungeonEditorRuntimePointerTarget;
import features.dungeon.adapter.javafx.map.DungeonMapContentModel.RenderScene;

final class DungeonMapHitIndex {

    private DungeonMapHitAreaIndex hitIndex = DungeonMapHitAreaIndex.empty();

    void update(
            DungeonMapSceneAssembler.SceneBuckets buckets,
            @Nullable DungeonMapRenderState displayModel,
            RenderScene renderScene,
            Map<String, DungeonEditorRuntimePointerTarget> runtimePointerTargets
    ) {
        hitIndex = renderScene != null && renderScene.containsRenderablePrimitives() && buckets != null
                ? DungeonMapHitAreaIndex.from(
                        DungeonMapHitAreaProjector.project(buckets, displayModel),
                        runtimePointerTargets)
                : DungeonMapHitAreaIndex.empty();
    }

    List<CanvasHit> hitsAt(double sceneX, double sceneY, double gridSize) {
        return hitIndex.hitsAt(sceneX, sceneY, gridSize);
    }

    record CanvasHit(
            String hitRef,
            DungeonEditorRuntimePointerTarget runtimePointerTarget
    ) {

        CanvasHit {
            hitRef = hitRef == null ? "" : hitRef;
            runtimePointerTarget = runtimePointerTarget == null
                    ? DungeonEditorRuntimePointerTarget.empty()
                    : runtimePointerTarget;
        }
    }
}
