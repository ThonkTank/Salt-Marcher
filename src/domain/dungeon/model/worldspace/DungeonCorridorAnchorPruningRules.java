package src.domain.dungeon.model.worldspace;

import java.util.List;

/**
 * Prunes hosted corridor anchors that are no longer referenced by route anchors.
 */
public final class DungeonCorridorAnchorPruningRules {

    public List<DungeonCorridor> pruneDetachedAnchors(List<DungeonCorridor> corridors) {
        return DungeonCorridor.fromCoreNetwork(
                corridors,
                DungeonCorridor.coreNetwork(corridors).withoutDetachedAnchors());
    }
}
