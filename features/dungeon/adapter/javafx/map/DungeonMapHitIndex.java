package features.dungeon.adapter.javafx.map;

import java.util.List;
import org.jspecify.annotations.Nullable;
import features.dungeon.adapter.javafx.map.DungeonMapContentModel.RenderScene;
import features.dungeon.adapter.javafx.map.DungeonMapContentModel.PointerTarget;

final class DungeonMapHitIndex {

    private DungeonMapHitAreaIndex hitIndex = DungeonMapHitAreaIndex.empty();

    void update(
            DungeonMapSceneAssembler.SceneBuckets buckets,
            @Nullable DungeonMapRenderState displayModel,
            RenderScene renderScene
    ) {
        hitIndex = renderScene != null && renderScene.containsRenderablePrimitives() && buckets != null
                ? DungeonMapHitAreaIndex.from(
                        DungeonMapHitAreaProjector.project(buckets, displayModel),
                        DungeonMapSemanticTargetIndex.from(displayModel))
                : DungeonMapHitAreaIndex.empty();
    }

    List<CanvasHit> hitsAt(double sceneX, double sceneY, double gridSize) {
        return hitIndex.hitsAt(sceneX, sceneY, gridSize);
    }

    record CanvasHit(
            String hitRef,
            PointerTarget pointerTarget
    ) {

        CanvasHit {
            hitRef = hitRef == null ? "" : hitRef;
            pointerTarget = pointerTarget == null ? PointerTarget.empty() : pointerTarget;
        }
    }
}
