package src.domain.creatures.published;

import org.jspecify.annotations.Nullable;

public record EncounterCandidate(
        long id,
        String name,
        String creatureType,
        String challengeRating,
        int xp,
        int hitPoints,
        @Nullable Integer hitDiceCount,
        @Nullable Integer hitDiceSides,
        @Nullable Integer hitDiceModifier,
        int armorClass,
        int initiativeBonus,
        int legendaryActionCount
) {
}
