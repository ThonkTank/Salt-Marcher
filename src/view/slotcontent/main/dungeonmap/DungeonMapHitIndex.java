package src.view.slotcontent.main.dungeonmap;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.RenderScene;

final class DungeonMapHitIndex {

    private DungeonMapHitAreaIndex hitIndex = DungeonMapHitAreaIndex.empty();

    void update(
            DungeonMapSceneAssembler.SceneBuckets buckets,
            @Nullable DungeonMapRenderState displayModel,
            RenderScene renderScene
    ) {
        hitIndex = renderScene != null && renderScene.containsRenderablePrimitives() && buckets != null
                ? DungeonMapHitAreaIndex.from(DungeonMapHitAreaProjector.project(buckets, displayModel))
                : DungeonMapHitAreaIndex.empty();
    }

    List<CanvasHit> hitsAt(double sceneX, double sceneY, double gridSize) {
        return hitIndex.hitsAt(sceneX, sceneY, gridSize);
    }

    record CanvasHit(
            String hitRef
    ) {

        CanvasHit {
            hitRef = hitRef == null ? "" : hitRef;
        }
    }
}
