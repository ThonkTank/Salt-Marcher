package features.encounter.builder.application.ports;

import features.creatures.model.Creature;

import java.util.List;

public interface CreatureCandidateProvider {

    List<Creature> getCreaturesForEncounter(
            List<String> types,
            int minXp,
            int maxXp,
            List<String> biomes,
            List<String> subtypes
    );
}
