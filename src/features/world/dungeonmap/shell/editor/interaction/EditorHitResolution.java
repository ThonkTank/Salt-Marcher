package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.model.interaction.DungeonSelectionRef;
import features.world.dungeonmap.state.EditorHover;
import features.world.dungeonmap.state.EditorHoverScope;

import java.util.Objects;

public record EditorHitResolution(
        DungeonSelectionRef hitRef,
        DungeonSelectionRef resolvedRef,
        EditorHover hover
) {
    public EditorHitResolution {
        if (hover != null && hitRef == null) {
            throw new IllegalArgumentException("hover requires a hit ref");
        }
    }

    public static EditorHitResolution none() {
        return new EditorHitResolution(null, null, null);
    }

    public static EditorHitResolution ref(DungeonSelectionRef ref) {
        return ref(ref, null);
    }

    public static EditorHitResolution ref(DungeonSelectionRef hitRef, DungeonSelectionRef resolvedRef) {
        DungeonSelectionRef resolvedHitRef = Objects.requireNonNull(hitRef, "hitRef");
        return new EditorHitResolution(
                resolvedHitRef,
                resolvedRef == null ? resolvedHitRef : resolvedRef,
                null);
    }

    public static EditorHitResolution owner(DungeonSelectionRef hitRef) {
        return owner(hitRef, null);
    }

    public static EditorHitResolution owner(DungeonSelectionRef hitRef, DungeonSelectionRef resolvedRef) {
        DungeonSelectionRef resolvedHitRef = Objects.requireNonNull(hitRef, "hitRef");
        DungeonSelectionRef ownerRef = resolvedRef == null ? resolvedHitRef.ownerRef() : resolvedRef;
        return new EditorHitResolution(
                resolvedHitRef,
                ownerRef,
                ownerRef == null ? null : new EditorHover(ownerRef, EditorHoverScope.OWNER));
    }

    public static EditorHitResolution part(DungeonSelectionRef hitRef) {
        return part(hitRef, null);
    }

    public static EditorHitResolution part(DungeonSelectionRef hitRef, DungeonSelectionRef resolvedRef) {
        DungeonSelectionRef resolvedHitRef = Objects.requireNonNull(hitRef, "hitRef");
        return new EditorHitResolution(
                resolvedHitRef,
                resolvedRef == null ? resolvedHitRef : resolvedRef,
                new EditorHover(resolvedHitRef, EditorHoverScope.PART));
    }
}
