package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.corridor.Corridor;

import java.util.Objects;

public record DungeonEditorCorridorSegmentHitTarget(
        Corridor corridor,
        Corridor.CorridorRoute route,
        Point2i doubledPoint,
        long priority
) implements DungeonEditorHitTarget {

    public DungeonEditorCorridorSegmentHitTarget {
        corridor = Objects.requireNonNull(corridor, "corridor");
        route = Objects.requireNonNull(route, "route");
        doubledPoint = Objects.requireNonNull(doubledPoint, "doubledPoint");
    }

    @Override
    public String targetKey() {
        return corridor.targetKey();
    }
}
