package features.encountertable.api;

import org.jspecify.annotations.Nullable;

public record EncounterTableCandidate(
        long creatureId,
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
        int weight,
        String sourceLabel
) {

    public EncounterTableCandidate {
        name = name == null ? "" : name;
        creatureType = creatureType == null ? "" : creatureType;
        challengeRating = challengeRating == null ? "" : challengeRating;
        sourceLabel = sourceLabel == null ? "" : sourceLabel;
    }
}
