package features.world.dungeon.dungeonmap.model;

import features.world.dungeon.dungeonmap.corridor.model.CorridorDraft;
import features.world.dungeon.dungeonmap.structure.model.Structure;

import java.util.Objects;

/**
 * Map-owned request for rehydrating a corridor directly from persisted structure plus corridor metadata.
 */
public record CorridorRehydrationRequest(
        CorridorDraft draft,
        Structure structure
) {
    public CorridorRehydrationRequest {
        draft = Objects.requireNonNull(draft, "draft");
        structure = Objects.requireNonNull(structure, "structure");
    }
}
