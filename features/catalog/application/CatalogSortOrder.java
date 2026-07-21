package features.catalog.application;

import java.util.Objects;

/** Stable column ordering retained independently from a section's query draft. */
public record CatalogSortOrder(String columnId, Direction direction) {

    public CatalogSortOrder {
        columnId = Objects.requireNonNullElse(columnId, "").trim();
        direction = Objects.requireNonNull(direction, "direction");
        if (columnId.isEmpty()) {
            throw new IllegalArgumentException("Catalog sort column id must not be blank.");
        }
    }

    public enum Direction {
        ASCENDING,
        DESCENDING;

        public Direction reversed() {
            return this == ASCENDING ? DESCENDING : ASCENDING;
        }
    }
}
