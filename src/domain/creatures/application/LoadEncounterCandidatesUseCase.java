package src.domain.creatures.application;

import src.domain.creatures.catalog.port.CreatureCatalogLookup;

import java.util.List;
import java.util.Objects;

public final class LoadEncounterCandidatesUseCase {

    private final CreatureCatalogLookup lookup;

    public LoadEncounterCandidatesUseCase(CreatureCatalogLookup lookup) {
        this.lookup = Objects.requireNonNull(lookup, "lookup");
    }

    public List<CreatureCatalogLookup.EncounterCandidateProfile> execute(CreatureCatalogLookup.EncounterCandidateSpec query) {
        return List.copyOf(lookup.loadEncounterCandidates(Objects.requireNonNull(query, "query")));
    }
}
