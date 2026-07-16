package features.encounter.domain.generation;

import java.util.List;

public record GeneratedEncounterCreatureData(
        long creatureId,
        String name,
        String challengeRating,
        int xp,
        int quantity,
        String role,
        List<String> tags
) {

    public GeneratedEncounterCreatureData {
        creatureId = Math.max(0L, creatureId);
        name = name == null ? "" : name;
        challengeRating = challengeRating == null ? "" : challengeRating;
        xp = Math.max(0, xp);
        quantity = Math.max(1, quantity);
        role = role == null ? "" : role;
        tags = tags == null ? List.of() : List.copyOf(tags);
    }
}
