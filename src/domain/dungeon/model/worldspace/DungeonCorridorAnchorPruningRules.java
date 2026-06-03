package src.domain.dungeon.model.worldspace;

import java.util.List;

/**
 * Transitional topology-ref adapter for core corridor network rules.
 */
public final class DungeonCorridorAnchorPruningRules {

    public List<DungeonCorridor> pruneDetachedAnchors(List<DungeonCorridor> corridors) {
        return DungeonCorridorTopologyIdentityAdapter.fromCoreNetwork(
                corridors,
                DungeonCorridorTopologyIdentityAdapter.toCoreNetwork(corridors).withoutDetachedAnchors());
    }
}
