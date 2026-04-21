package src.domain.encountertable.published;

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
        int weight
) {
    public EncounterTableCandidate {
        name = name == null ? "" : name;
        creatureType = creatureType == null ? "" : creatureType;
        challengeRating = challengeRating == null ? "" : challengeRating;
        xp = Math.max(0, xp);
        hitPoints = Math.max(0, hitPoints);
        armorClass = Math.max(0, armorClass);
        weight = Math.max(1, Math.min(10, weight));
    }
}
