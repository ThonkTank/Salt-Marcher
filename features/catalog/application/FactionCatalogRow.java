package features.catalog.application;

import java.util.Objects;

public record FactionCatalogRow(long factionId, String displayName, String details) {
    public FactionCatalogRow {
        factionId = Math.max(0L, factionId);
        displayName = Objects.requireNonNullElse(displayName, "");
        details = Objects.requireNonNullElse(details, "");
    }
}
