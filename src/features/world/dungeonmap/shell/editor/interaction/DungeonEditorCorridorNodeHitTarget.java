package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.corridor.CorridorNode;

import java.util.Objects;

public record DungeonEditorCorridorNodeHitTarget(
        Corridor corridor,
        CorridorNode node,
        Point2i doubledPoint,
        long priority
) implements DungeonEditorHitTarget {

    public DungeonEditorCorridorNodeHitTarget {
        corridor = Objects.requireNonNull(corridor, "corridor");
        node = Objects.requireNonNull(node, "node");
        doubledPoint = Objects.requireNonNull(doubledPoint, "doubledPoint");
    }

    @Override
    public String targetKey() {
        return corridor.targetKey();
    }
}
