package features.creatures.adapter.sqlite.mapper;

import java.util.List;
import features.creatures.adapter.sqlite.model.CreatureDetailRecord;

final class CreatureDetailIdentityFields {

    final long id;
    final String name;
    final String size;
    final String creatureType;
    final List<String> subtypes;
    final List<String> biomes;
    final String alignment;
    final String challengeRating;
    final int xp;

    CreatureDetailIdentityFields(CreatureDetailRecord.Identity identity) {
        CreatureDetailRecord.Classification classification = identity.classification();
        id = identity.id();
        name = identity.name();
        size = classification.size();
        creatureType = classification.creatureType();
        subtypes = classification.subtypes();
        biomes = classification.biomes();
        alignment = classification.alignment();
        challengeRating = identity.challengeRating();
        xp = identity.xp();
    }
}
