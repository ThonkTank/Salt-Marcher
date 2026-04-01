package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.shell.interaction.DungeonHitSubject;
import features.world.dungeonmap.shell.interaction.DungeonSelectionKey;
import features.world.dungeonmap.state.EditorHover;
import features.world.dungeonmap.state.EditorHoverScope;

import java.util.Objects;

public record EditorHitResolution(
        DungeonHitSubject subject,
        EditorHover hover
) {
    public EditorHitResolution {
        if (hover != null && subject == null) {
            throw new IllegalArgumentException("hover requires a subject");
        }
    }

    public static EditorHitResolution none() {
        return new EditorHitResolution(null, null);
    }

    public static EditorHitResolution subjectOnly(DungeonHitSubject subject) {
        return new EditorHitResolution(Objects.requireNonNull(subject, "subject"), null);
    }

    public static EditorHitResolution owner(DungeonHitSubject subject) {
        DungeonHitSubject resolved = Objects.requireNonNull(subject, "subject");
        return new EditorHitResolution(resolved, new EditorHover(resolved.selectionKey(), EditorHoverScope.OWNER));
    }

    public static EditorHitResolution part(DungeonHitSubject subject) {
        DungeonHitSubject resolved = Objects.requireNonNull(subject, "subject");
        return new EditorHitResolution(resolved, new EditorHover(resolved.selectionKey(), EditorHoverScope.PART));
    }

    public DungeonSelectionKey selectionKey() {
        return subject == null ? null : subject.selectionKey();
    }
}
