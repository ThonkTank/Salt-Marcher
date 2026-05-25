package src.domain.creatures.published;

import org.jspecify.annotations.Nullable;

public record CreatureEncounterCandidate(
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
        int legendaryActionCount,
        int selectionWeight
) {

    public CreatureEncounterCandidate {
        name = name == null ? "" : name;
        creatureType = creatureType == null ? "" : creatureType;
        challengeRating = challengeRating == null ? "" : challengeRating;
        selectionWeight = Math.max(1, Math.min(10, selectionWeight));
    }
}
