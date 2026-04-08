package features.world.dungeon.model.interaction;

import features.world.dungeon.geometry.GridPoint;

import java.util.Objects;

/**
 * Canvas-independent label handle for interactive map objects.
 *
 * <p>The model owns the semantic label ref, visible text, and explicit grid anchor. Hit testing, pixel tolerance,
 * selection policy, and drag behavior belong to editor interaction code.</p>
 */
public record InteractiveLabelHandle(
        DungeonSelectionRef ref,
        String label,
        GridPoint anchor
) {
    public InteractiveLabelHandle {
        ref = Objects.requireNonNull(ref, "ref");
        label = normalizeLabel(label);
        anchor = Objects.requireNonNull(anchor, "anchor");
    }

    private static String normalizeLabel(String label) {
        return label == null || label.isBlank() ? "Label" : label.trim();
    }
}
