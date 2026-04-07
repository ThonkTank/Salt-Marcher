package features.world.dungeon.dungeonmap.corridor.application;

import features.world.dungeon.dungeonmap.model.CorridorResolutionRequest;

import java.util.List;

public record CorridorDraftPlan(
        boolean changed,
        List<CorridorResolutionRequest> requests
) {
    public CorridorDraftPlan {
        requests = requests == null ? List.of() : List.copyOf(requests);
    }

    public static CorridorDraftPlan unchanged() {
        return new CorridorDraftPlan(false, List.of());
    }
}
