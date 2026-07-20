package features.encountertable.adapter.sqlite.model;

import org.jspecify.annotations.Nullable;

public record EncounterTableCandidateRecord(
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
}
