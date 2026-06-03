package src.domain.encountertable.model.catalog;

import org.jspecify.annotations.Nullable;

public record EncounterTableCandidateData(
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
    public EncounterTableCandidateData {
        name = safeText(name);
        creatureType = safeText(creatureType);
        challengeRating = safeText(challengeRating);
        xp = Math.max(0, xp);
        hitPoints = Math.max(0, hitPoints);
        armorClass = Math.max(0, armorClass);
        weight = Math.max(1, Math.min(10, weight));
    }

    private static String safeText(String value) {
        return value == null ? "" : value;
    }
}
