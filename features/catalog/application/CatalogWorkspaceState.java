package features.catalog.application;

import java.util.Objects;

public record CatalogWorkspaceState(
        long revision,
        CatalogActiveSection activeSection
) {
    public CatalogWorkspaceState {
        revision = Math.max(0L, revision);
        activeSection = Objects.requireNonNull(activeSection, "activeSection");
    }
}
