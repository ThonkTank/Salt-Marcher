package src.domain.encounter.generation.value;

public record EncounterDraftEntry(
        EncounterCandidateProfile profile,
        int quantity
) {

    public long creatureId() {
        return profile.id();
    }

    public String creatureName() {
        return profile.name();
    }

    public String challengeRating() {
        return profile.challengeRating();
    }

    public int xp() {
        return profile.xp();
    }

    public String role() {
        return profile.role();
    }

    public EncounterCreatureFacts facts() {
        return profile.facts();
    }
}
