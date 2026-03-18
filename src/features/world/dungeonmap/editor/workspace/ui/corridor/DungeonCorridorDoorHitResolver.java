package features.world.dungeonmap.editor.workspace.ui.corridor;

import features.world.dungeonmap.editor.workspace.ui.corridor.CorridorDoorHit;

import java.util.LinkedHashSet;
import java.util.List;

final class DungeonCorridorDoorHitResolver {

    private DungeonCorridorDoorHitResolver() {
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
