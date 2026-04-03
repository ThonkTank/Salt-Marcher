package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.model.interaction.DungeonSelectionKey;
import features.world.dungeonmap.shell.interaction.DungeonHitSubject;
import features.world.dungeonmap.state.EditorHover;
import features.world.dungeonmap.state.EditorHoverScope;

import java.util.Objects;

public record EditorHitResolution(
        DungeonHitSubject subject,
        DungeonSelectionKey resolvedKey,
        EditorHover hover
) {
    public EditorHitResolution {
        if (hover != null && subject == null) {
            throw new IllegalArgumentException("hover requires a subject");
        }
    }

    public static EditorHitResolution none() {
        return new EditorHitResolution(null, null, null);
    }

    public static EditorHitResolution subjectOnly(DungeonHitSubject subject) {
        return subjectOnly(subject, null);
    }

    public static EditorHitResolution subjectOnly(DungeonHitSubject subject, DungeonSelectionKey resolvedKey) {
        return new EditorHitResolution(Objects.requireNonNull(subject, "subject"), resolvedKey, null);
    }

    public static EditorHitResolution owner(DungeonHitSubject subject) {
        return owner(subject, null);
    }

    public static EditorHitResolution owner(DungeonHitSubject subject, DungeonSelectionKey resolvedKey) {
        DungeonHitSubject resolved = Objects.requireNonNull(subject, "subject");
        return new EditorHitResolution(
                resolved,
                resolvedKey,
                new EditorHover(resolved.selectionKey(), EditorHoverScope.OWNER));
    }

    public static EditorHitResolution part(DungeonHitSubject subject) {
        return part(subject, null);
    }

    public static EditorHitResolution part(DungeonHitSubject subject, DungeonSelectionKey resolvedKey) {
        DungeonHitSubject resolved = Objects.requireNonNull(subject, "subject");
        return new EditorHitResolution(
                resolved,
                resolvedKey,
                new EditorHover(resolved.selectionKey(), EditorHoverScope.PART));
    }
}
