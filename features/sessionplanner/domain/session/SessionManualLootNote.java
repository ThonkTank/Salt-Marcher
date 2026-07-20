package features.sessionplanner.domain.session;

import java.util.Objects;

public record SessionManualLootNote(long noteId, long sceneId, String authoredText) {

    public SessionManualLootNote {
        if (noteId <= 0L || sceneId <= 0L) {
            throw new IllegalArgumentException("manual loot note identities must be positive");
        }
        authoredText = Objects.requireNonNullElse(authoredText, "").trim();
        if (authoredText.isEmpty()) {
            throw new IllegalArgumentException("manual loot note text must not be blank");
        }
    }
}
