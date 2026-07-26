package features.party.domain.roster;

import org.jspecify.annotations.Nullable;

public record PartyCharacterCombatProfile(
        @Nullable Integer passivePerception,
        @Nullable Integer armorClass
) {
    public PartyCharacterCombatProfile {
        requireValidWhenPresent(passivePerception, "passivePerception");
        requireValidWhenPresent(armorClass, "armorClass");
    }

    private static void requireValidWhenPresent(@Nullable Integer value, String field) {
        if (value != null && (value < 1 || value > 99)) {
            throw new IllegalArgumentException(field + " must be between 1 and 99 when present.");
        }
    }
}
