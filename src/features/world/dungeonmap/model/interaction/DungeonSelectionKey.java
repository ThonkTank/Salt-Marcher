package features.world.dungeonmap.model.interaction;

import java.util.Objects;

public record DungeonSelectionKey(
        DungeonHitKind kind,
        String targetKey,
        String partKey
) {
    public DungeonSelectionKey {
        kind = Objects.requireNonNull(kind, "kind");
        targetKey = targetKey == null ? "" : targetKey;
        partKey = partKey == null ? "" : partKey;
    }
}
