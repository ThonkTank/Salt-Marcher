package features.catalog.application;

import features.creatures.api.CreatureReferenceIndexResult;
import features.creatures.api.CreatureReferenceIndexStatus;
import features.worldplanner.api.WorldFactionSummary;
import features.worldplanner.api.WorldLocationSummary;
import features.worldplanner.api.WorldNpcSummary;
import java.util.List;
import java.util.Objects;

public record WorldReferenceCatalogState(
        ReferenceSectionState<WorldNpcSummary> npcs,
        ReferenceSectionState<WorldFactionSummary> factions,
        ReferenceSectionState<WorldLocationSummary> locations,
        CreatureReferenceIndexResult creatures
) {
    public WorldReferenceCatalogState {
        npcs = Objects.requireNonNull(npcs, "npcs");
        factions = Objects.requireNonNull(factions, "factions");
        locations = Objects.requireNonNull(locations, "locations");
        creatures = Objects.requireNonNull(creatures, "creatures");
    }

    static WorldReferenceCatalogState initial() {
        return new WorldReferenceCatalogState(
                ReferenceSectionState.loading(),
                ReferenceSectionState.loading(),
                ReferenceSectionState.loading(),
                new CreatureReferenceIndexResult(CreatureReferenceIndexStatus.LOADING, 0L, List.of()));
    }

    public record ReferenceSectionState<Row>(CatalogResultState<Row> results, long selectedId, String query) {
        public ReferenceSectionState {
            results = Objects.requireNonNull(results, "results");
            selectedId = Math.max(0L, selectedId);
            query = Objects.requireNonNull(query, "query");
        }

        static <Row> ReferenceSectionState<Row> loading() {
            return new ReferenceSectionState<>(CatalogResultState.loading(), 0L, "");
        }
    }
}
