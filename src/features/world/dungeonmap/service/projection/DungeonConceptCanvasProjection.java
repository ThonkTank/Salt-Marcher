package features.world.dungeonmap.service.projection;

import features.world.dungeonmap.model.projection.DungeonConceptCanvasEdge;
import features.world.dungeonmap.model.projection.DungeonConceptCanvasNode;

import java.util.List;

record DungeonConceptCanvasProjection(
        List<DungeonConceptCanvasNode> nodes,
        List<DungeonConceptCanvasEdge> edges
) {
}
