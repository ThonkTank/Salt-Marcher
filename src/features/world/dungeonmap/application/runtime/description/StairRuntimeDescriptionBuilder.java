package features.world.dungeonmap.application.runtime.description;

import features.world.dungeonmap.application.runtime.DungeonRuntimeLocation;
import features.world.dungeonmap.model.structures.stair.DungeonStair;

import java.util.List;

final class StairRuntimeDescriptionBuilder {

    private StairRuntimeDescriptionBuilder() {
        throw new AssertionError("No instances");
    }

    static DungeonRuntimeDescription build(DungeonRuntimeLocation location) {
        DungeonStair stair = location == null ? null : location.stair();
        if (location == null || stair == null || stair.stairId() == null) {
            return null;
        }
        return new DungeonRuntimeDescription(
                stair.label(),
                location.ownerRef(),
                "Eine Treppe verbindet mehrere erschlossene Höhenstufen.",
                List.of());
    }
}
