package features.world.dungeon.dungeonmap.model;

import features.world.dungeon.dungeonmap.corridor.model.Corridor;
import features.world.dungeon.dungeonmap.connections.input.DungeonConnection;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Persistable cross-owner side effects of a validated cluster rewrite.
 */
public record ClusterRewriteEffects(
        List<Corridor> reboundCorridors,
        Map<Long, DungeonConnection> reboundTransitionConnectionsById
) {
    public ClusterRewriteEffects {
        reboundCorridors = reboundCorridors == null ? List.of() : List.copyOf(reboundCorridors);
        reboundTransitionConnectionsById = reboundTransitionConnectionsById == null
                ? Map.of()
                : Map.copyOf(new LinkedHashMap<>(reboundTransitionConnectionsById));
    }

    public static ClusterRewriteEffects empty() {
        return new ClusterRewriteEffects(List.of(), Map.of());
    }
}
