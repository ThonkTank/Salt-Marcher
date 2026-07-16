package features.encounter.domain.generation;

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
        return profile.facts().challengeRating();
    }

    public int xp() {
        return profile.xp();
    }

    public EncounterRole role() {
        return profile.role();
    }

    public int selectionWeight() {
        return profile.selectionWeight();
    }

    public EncounterCreatureFacts facts() {
        return profile.facts();
    }
}
