package features.catalog.application;

import java.util.Objects;

public record LocationCatalogRow(long locationId, String displayName, String details) {
    public LocationCatalogRow {
        locationId = Math.max(0L, locationId);
        displayName = Objects.requireNonNullElse(displayName, "");
        details = Objects.requireNonNullElse(details, "");
    }
}
