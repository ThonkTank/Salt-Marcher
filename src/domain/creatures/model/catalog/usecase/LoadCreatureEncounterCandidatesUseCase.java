package src.domain.creatures.model.catalog.usecase;

import java.util.List;
import java.util.Objects;
import src.domain.creatures.model.catalog.helper.CreatureCatalogTextHelper;
import src.domain.creatures.model.catalog.CreatureCatalogData;
import src.domain.creatures.model.catalog.port.CreatureCatalogPort;
import src.domain.creatures.model.catalog.repository.CreaturesPublishedStateRepository;

public final class LoadCreatureEncounterCandidatesUseCase {

    private static final int DEFAULT_ENCOUNTER_CANDIDATE_LIMIT = 250;
    private static final int MAX_ENCOUNTER_CANDIDATE_LIMIT = 1000;

    private final CreatureCatalogPort lookup;
    private final CreaturesPublishedStateRepository publishedStateRepository;

    public LoadCreatureEncounterCandidatesUseCase(
            CreatureCatalogPort lookup,
            CreaturesPublishedStateRepository publishedStateRepository
    ) {
        this.lookup = Objects.requireNonNull(lookup, "lookup");
        this.publishedStateRepository = Objects.requireNonNull(publishedStateRepository, "publishedStateRepository");
    }

    public void execute(
            List<String> creatureTypes,
            List<String> creatureSubtypes,
            List<String> biomes,
            int minimumXp,
            int maximumXp,
            int limit
    ) {
        try {
            CreatureCatalogData.EncounterCandidateSpec spec = new CreatureCatalogData.EncounterCandidateSpec(
                    CreatureCatalogTextHelper.normalizeValues(creatureTypes),
                    CreatureCatalogTextHelper.normalizeValues(creatureSubtypes),
                    CreatureCatalogTextHelper.normalizeValues(biomes),
                    Math.max(0, minimumXp),
                    maximumXp <= 0 ? Integer.MAX_VALUE : maximumXp,
                    normalizeEncounterCandidateLimit(limit));
            if (spec.minimumXp() > spec.maximumXp()) {
                publish(CreaturesPublishedStateRepository.INVALID_QUERY, List.of());
                return;
            }
            publish(CreaturesPublishedStateRepository.SUCCESS, lookup.loadEncounterCandidates(spec));
        } catch (IllegalStateException exception) {
            publish(CreaturesPublishedStateRepository.STORAGE_ERROR, List.of());
        }
    }

    private void publish(String status, List<CreatureCatalogData.EncounterCandidateProfile> candidates) {
        publishedStateRepository.publishEncounterCandidates(
                new CreaturesPublishedStateRepository.EncounterCandidatesPublication(status, candidates));
    }

    private static int normalizeEncounterCandidateLimit(int limit) {
        if (limit <= 0) {
            return DEFAULT_ENCOUNTER_CANDIDATE_LIMIT;
        }
        return Math.min(limit, MAX_ENCOUNTER_CANDIDATE_LIMIT);
    }

}
