package features.catalog.application;

import java.util.Objects;

/** Framework-neutral action metadata. */
public record CatalogActionSpec(
        CatalogActionId id,
        String label,
        String tooltip,
        String accessiblePrefix,
        Emphasis emphasis
) {
    public CatalogActionSpec {
        id = Objects.requireNonNull(id, "id");
        label = Objects.requireNonNullElse(label, "");
        tooltip = Objects.requireNonNullElse(tooltip, "");
        accessiblePrefix = Objects.requireNonNullElse(accessiblePrefix, "");
        emphasis = Objects.requireNonNull(emphasis, "emphasis");
    }

    public enum Emphasis {
        PRIMARY,
        SECONDARY
    }
}
