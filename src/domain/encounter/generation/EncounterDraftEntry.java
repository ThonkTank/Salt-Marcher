package src.domain.encounter.generation;

import src.domain.creatures.api.EncounterCandidate;

public record EncounterDraftEntry(
        EncounterCandidateProfile profile,
        int quantity
) {

    public long creatureId() {
        return profile.id;
    }

    public String creatureName() {
        return profile.name;
    }

    public String challengeRating() {
        return profile.challengeRating;
    }

    public int xp() {
        return profile.xp();
    }

    String role() {
        return profile.role;
    }

    public EncounterCandidate toCandidate() {
        return EncounterCandidateProfiles.toCandidate(profile);
    }
}
