package features.dungeon.api;

import java.util.List;
import java.util.Optional;

/** Public bounded continuation page for the active viewport. */
public record DungeonViewportContinuationPage(
        List<DungeonViewportContinuation> entries,
        Optional<DungeonViewportContinuationCursor> nextCursor
) {
    public DungeonViewportContinuationPage {
        entries = entries == null ? List.of() : List.copyOf(entries);
        nextCursor = nextCursor == null ? Optional.empty() : nextCursor;
        if (entries.size() > 256) {
            throw new IllegalArgumentException("viewport continuation page exceeds 256 entries");
        }
    }

    public static DungeonViewportContinuationPage empty() {
        return new DungeonViewportContinuationPage(List.of(), Optional.empty());
    }
}
