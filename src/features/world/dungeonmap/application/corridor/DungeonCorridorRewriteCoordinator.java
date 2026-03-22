package features.world.dungeonmap.application.corridor;

import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.corridor.CorridorRewriteContext;

import java.util.LinkedHashMap;
import java.util.Map;

public final class DungeonCorridorRewriteCoordinator {

    public Map<Long, Corridor> rewriteCorridors(
            Map<Long, Corridor> corridorsById,
            CorridorRewriteContext context
    ) {
        if (corridorsById == null || corridorsById.isEmpty()) {
            return Map.of();
        }
        if (context == null || context.affectedCorridorIds().isEmpty()) {
            return Map.copyOf(corridorsById);
        }
        Map<Long, Corridor> result = new LinkedHashMap<>();
        for (Map.Entry<Long, Corridor> entry : corridorsById.entrySet()) {
            Corridor corridor = entry.getValue();
            if (corridor == null) {
                result.put(entry.getKey(), null);
                continue;
            }
            result.put(entry.getKey(), corridor.reanchoredFor(context).replannedFor(context));
        }
        return Map.copyOf(result);
    }
}
