package features.world.dungeonmap.application.runtime.description;

import features.world.dungeonmap.application.runtime.DungeonRuntimeLocation;
import features.world.dungeonmap.model.structures.transition.DungeonTransition;

import java.util.List;

final class TransitionRuntimeDescriptionBuilder {

    private TransitionRuntimeDescriptionBuilder() {
        throw new AssertionError("No instances");
    }

    static DungeonRuntimeDescription build(DungeonRuntimeLocation location) {
        DungeonTransition transition = location == null ? null : location.transition();
        if (transition == null || transition.transitionId() == null) {
            return null;
        }
        return new DungeonRuntimeDescription(
                transition.label(),
                location.ownerRef(),
                transition.description().isBlank() ? transition.label() : transition.description(),
                List.of());
    }
}
