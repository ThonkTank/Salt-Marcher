package src.data.creatures.mapper;

import org.jspecify.annotations.Nullable;
import src.data.creatures.model.EncounterCandidateRecord;
import src.domain.creatures.catalog.port.CreatureCatalogLookup;

public final class EncounterCandidateMapper {

    private EncounterCandidateMapper() {
    }

    public static CreatureCatalogLookup.EncounterCandidateProfile toDomain(EncounterCandidateRecord record) {
        EncounterCandidateRecord.Identity identity = record.identity();
        EncounterCandidateRecord.Challenge challenge = record.challenge();
        EncounterCandidateRecord.Durability durability = record.durability();
        EncounterCandidateRecord.Combat combat = record.combat();
        return new CreatureCatalogLookup.EncounterCandidateProfile(
                identity.id(),
                safeText(identity.name()),
                safeText(identity.creatureType()),
                safeText(challenge.challengeRating()),
                challenge.xp(),
                durability.hitPoints(),
                durability.hitDiceCount(),
                durability.hitDiceSides(),
                durability.hitDiceModifier(),
                combat.armorClass(),
                combat.initiativeBonus(),
                combat.legendaryActionCount());
    }

    private static String safeText(@Nullable String value) {
        return value == null ? "" : value;
    }
}
