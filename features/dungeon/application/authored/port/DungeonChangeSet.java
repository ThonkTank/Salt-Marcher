package features.dungeon.application.authored.port;

import features.dungeon.domain.core.structure.DungeonMap;
import java.util.Objects;

/** One authored command crossing the persistence boundary. */
public record DungeonChangeSet(DungeonMap before, DungeonMap after) {
    public DungeonChangeSet {
        before = Objects.requireNonNull(before, "before");
        after = Objects.requireNonNull(after, "after");
        if (!before.metadata().mapId().equals(after.metadata().mapId())) {
            throw new IllegalArgumentException("before and after must identify the same dungeon map");
        }
        if (after.revision() != before.revision() + 1L) {
            throw new IllegalArgumentException("one change set must advance the map revision exactly once");
        }
    }

    public long expectedRevision() {
        return before.revision();
    }

    public long committedRevision() {
        return after.revision();
    }
}
