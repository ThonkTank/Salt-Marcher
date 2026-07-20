package features.creatures.api;

import java.util.List;

/** Immutable full creature index for foreign-reference selectors and projections. */
public record CreatureReferenceIndexResult(
        CreatureReferenceIndexStatus status,
        long revision,
        List<CreatureCatalogRow> rows
) {
    public CreatureReferenceIndexResult {
        status = status == null ? CreatureReferenceIndexStatus.STORAGE_ERROR : status;
        revision = Math.max(0L, revision);
        rows = rows == null ? List.of() : List.copyOf(rows);
    }
}
