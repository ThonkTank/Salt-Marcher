package features.encounter.internal.wiring;

import features.creatures.api.CreatureCatalogService;
import features.creatures.model.Creature;
import features.encounter.builder.application.ports.CreatureCandidateProvider;

import java.util.List;

public final class DefaultCreatureCandidateProvider implements CreatureCandidateProvider {

    @Override
    public List<Creature> getCreaturesForEncounter(
            List<String> types,
            int minXp,
            int maxXp,
            List<String> biomes,
            List<String> subtypes
    ) {
        return CreatureCatalogService.getCreaturesForEncounter(types, minXp, maxXp, biomes, subtypes).value();
    }
}
