package features.encounter.internal.wiring;

import features.creatures.catalog.CatalogObject;
import features.creatures.catalog.input.LoadEncounterCandidatesInput;
import features.creatures.model.Creature;
import features.encounter.builder.application.ports.CreatureCandidateProvider;

import java.util.List;

@SuppressWarnings("unused")
public final class DefaultCreatureCandidateProvider implements CreatureCandidateProvider {
    private final CatalogObject catalogObject = new CatalogObject();

    @Override
    public List<Creature> getCreaturesForEncounter(
            List<String> types,
            int minXp,
            int maxXp,
            List<String> biomes,
            List<String> subtypes
    ) {
        return catalogObject.loadEncounterCandidates(
                new LoadEncounterCandidatesInput(types, minXp, maxXp, biomes, subtypes, true))
                .creatures();
    }
}
