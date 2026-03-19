package features.world.quarantine.dungeonmap.editor.workspace.corridor;

import features.world.quarantine.dungeonmap.editor.workspace.corridor.CorridorDoorHit;

import java.util.LinkedHashSet;
import java.util.List;

final class DungeonCorridorDoorHitResolver {

    private DungeonCorridorDoorHitResolver() {
        throw new AssertionError("No instances");
    }

    static CorridorDoorHit resolve(List<Long> corridorIds, Long fallbackCorridorId, long roomId) {
        LinkedHashSet<Long> normalizedCorridorIds = new LinkedHashSet<>();
        if (corridorIds != null) {
            for (Long corridorId : corridorIds) {
                if (corridorId != null) {
                    normalizedCorridorIds.add(corridorId);
                }
            }
        }
        if (fallbackCorridorId != null) {
            normalizedCorridorIds.add(fallbackCorridorId);
        }
        return new CorridorDoorHit(List.copyOf(normalizedCorridorIds), roomId);
    }
}
