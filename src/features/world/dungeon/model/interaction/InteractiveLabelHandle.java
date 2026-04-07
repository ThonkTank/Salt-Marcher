package features.world.dungeon.model.interaction;

import features.world.dungeon.geometry.GridPoint;

import java.util.Objects;

/**
 * Canvas-independent label handle for interactive map objects.
 *
 * <p>The model owns the semantic label ref, visible text, and explicit 2x-grid anchor. Hit testing, pixel tolerance,
 * selection policy, and drag behavior belong to editor interaction code.</p>
 */
public record InteractiveLabelHandle(
        DungeonSelectionRef ref,
        String label,
        GridPoint anchor2x
) {
    public InteractiveLabelHandle {
        ref = Objects.requireNonNull(ref, "ref");
        label = normalizeLabel(label);
        anchor2x = Objects.requireNonNull(anchor2x, "anchor2x");
    }

    private static String normalizeLabel(String label) {
        return label == null || label.isBlank() ? "Label" : label.trim();
    }
}
