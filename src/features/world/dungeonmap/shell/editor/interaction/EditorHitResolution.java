package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.model.interaction.DungeonSelectionRef;
import features.world.dungeonmap.shell.interaction.DungeonHitSubject;
import features.world.dungeonmap.state.EditorHover;
import features.world.dungeonmap.state.EditorHoverScope;

import java.util.Objects;

public record EditorHitResolution(
        DungeonHitSubject subject,
        DungeonSelectionRef resolvedRef,
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

    public static EditorHitResolution subjectOnly(DungeonHitSubject subject, DungeonSelectionRef resolvedRef) {
        DungeonHitSubject resolvedSubject = Objects.requireNonNull(subject, "subject");
        return new EditorHitResolution(
                resolvedSubject,
                resolvedRef == null ? resolvedSubject.ref() : resolvedRef,
                null);
    }

    public static EditorHitResolution owner(DungeonHitSubject subject) {
        return owner(subject, null);
    }

    public static EditorHitResolution owner(DungeonHitSubject subject, DungeonSelectionRef resolvedRef) {
        DungeonHitSubject resolved = Objects.requireNonNull(subject, "subject");
        DungeonSelectionRef ownerRef = resolvedRef == null ? resolved.ownerRef() : resolvedRef;
        return new EditorHitResolution(
                resolved,
                ownerRef,
                ownerRef == null ? null : new EditorHover(ownerRef, EditorHoverScope.OWNER));
    }

    public static EditorHitResolution part(DungeonHitSubject subject) {
        return part(subject, null);
    }

    public static EditorHitResolution part(DungeonHitSubject subject, DungeonSelectionRef resolvedRef) {
        DungeonHitSubject resolved = Objects.requireNonNull(subject, "subject");
        return new EditorHitResolution(
                resolved,
                resolvedRef == null ? resolved.ref() : resolvedRef,
                new EditorHover(resolved.ref(), EditorHoverScope.PART));
    }
}
