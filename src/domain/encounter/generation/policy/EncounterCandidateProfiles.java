package src.domain.encounter.generation.policy;

import src.domain.encounter.generation.value.*;

public final class EncounterCandidateProfiles {

    private EncounterCandidateProfiles() {
    }

    public static EncounterCandidateProfile fromFacts(EncounterCreatureFacts candidate) {
        return fromFacts(candidate, 1);
    }

    public static EncounterCandidateProfile fromFacts(EncounterCreatureFacts candidate, int selectionWeight) {
        EncounterRoleClassifier.Classification classification = EncounterRoleClassifier.classify(candidate);
        return new EncounterCandidateProfile(
                candidate,
                EncounterCandidateCombatStats.fromFacts(candidate),
                classification.role(),
                selectionWeight);
    }

    static int componentDistance(EncounterCandidateProfile profile, int targetXp) {
        int half = Math.max(1, targetXp / 2);
        int third = Math.max(1, targetXp / 3);
        return Math.min(
                Math.abs(profile.xp() - targetXp),
                Math.min(
                        Math.abs(profile.xp() - half),
                        Math.abs(profile.xp() - third)));
    }
}
