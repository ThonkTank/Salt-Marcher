package features.encounter.application.adapter;

import features.creaturecatalog.model.Creature;
import features.creaturecatalog.service.CreatureService;
import features.encounter.application.EncounterApplicationService;

import java.util.List;

public final class StaticCreatureCandidateProvider
        implements EncounterApplicationService.CreatureCandidateProvider {

    @Override
    public List<Creature> getCreaturesForEncounter(
            List<String> types,
            int minXp,
            int maxXp,
            List<String> biomes,
            List<String> subtypes
    ) {
        return CreatureService.getCreaturesForEncounter(types, minXp, maxXp, biomes, subtypes).value();
    }
}
