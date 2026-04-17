package src.domain.encounter.api;

import java.util.List;

public record EncounterCreature(
        long creatureId,
        String name,
        String challengeRating,
        int xp,
        int quantity,
        String role,
        List<String> tags
) {

    public EncounterCreature {
        quantity = Math.max(1, quantity);
        tags = tags == null ? List.of() : List.copyOf(tags);
    }
}
