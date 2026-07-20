package features.dungeon.application.authored.port;

import java.util.List;
import java.util.Optional;

/** At most 256 ordered continuation rows plus an exclusive cursor. */
public record DungeonContinuationPage(
        List<DungeonWindowContinuation> entries,
        Optional<DungeonContinuationCursor> nextCursor
) {
    public DungeonContinuationPage {
        entries = entries == null ? List.of() : List.copyOf(entries);
        nextCursor = nextCursor == null ? Optional.empty() : nextCursor;
        if (entries.size() > DungeonContinuationPageRequest.PAGE_SIZE) {
            throw new IllegalArgumentException("continuation page exceeds its fixed size");
        }
    }

    public static DungeonContinuationPage empty() {
        return new DungeonContinuationPage(List.of(), Optional.empty());
    }
}
