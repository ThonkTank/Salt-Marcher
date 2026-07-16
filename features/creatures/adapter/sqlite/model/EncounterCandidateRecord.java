package features.creatures.adapter.sqlite.model;

import org.jspecify.annotations.Nullable;

public record EncounterCandidateRecord(
        Identity identity,
        Challenge challenge,
        Durability durability,
        Combat combat
) {
    public record Identity(long id, String name, String creatureType) {
    }

    public record Challenge(String challengeRating, int xp) {
    }

    public record Durability(
            int hitPoints,
            @Nullable Integer hitDiceCount,
            @Nullable Integer hitDiceSides,
            @Nullable Integer hitDiceModifier
    ) {
    }

    public record Combat(int armorClass, int initiativeBonus, int legendaryActionCount) {
    }
}
