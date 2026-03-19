package features.world.quarantine.dungeonmap.runtime.model;

import features.world.quarantine.dungeonmap.loading.DungeonLoadingState;

public record DungeonRuntimeLoadState(
        DungeonRuntimeState state,
        DungeonLoadingState loadingState
) {
}
