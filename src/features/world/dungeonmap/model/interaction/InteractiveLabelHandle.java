package features.world.dungeonmap.model.interaction;

import features.world.dungeonmap.model.geometry.GridAnchor;

import java.util.Objects;

/**
 * Canvas-independent label handle for interactive map objects.
 *
 * <p>The model owns the semantic label key, visible text, and grid anchor. Hit testing, pixel tolerance,
 * selection policy, and drag behavior belong to editor interaction code.</p>
 */
public record InteractiveLabelHandle(
        String key,
        String label,
        GridAnchor anchor
) {
    public InteractiveLabelHandle {
        key = normalizeKey(key);
        label = normalizeLabel(label);
        anchor = Objects.requireNonNull(anchor, "anchor");
    }

    private static String normalizeKey(String key) {
        if (key == null || key.isBlank()) {
            throw new IllegalArgumentException("Interactive label key must not be blank");
        }
        return key.trim();
    }

    private static String normalizeLabel(String label) {
        return label == null || label.isBlank() ? "Label" : label.trim();
    }
}
