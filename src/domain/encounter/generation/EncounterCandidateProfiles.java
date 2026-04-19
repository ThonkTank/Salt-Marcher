package src.domain.encounter.generation;

import org.jspecify.annotations.Nullable;
import src.domain.creatures.api.CreatureDetail;
import src.domain.creatures.api.EncounterCandidate;

public final class EncounterCandidateProfiles {

    private EncounterCandidateProfiles() {
    }

    public static EncounterCandidateProfile fromCandidate(EncounterCandidate candidate, @Nullable CreatureDetail detail) {
        EncounterRoleClassifier.Classification classification = EncounterRoleClassifier.classify(candidate, detail);
        return new EncounterCandidateProfile(
                candidate.id(),
                candidate.name(),
                candidate.challengeRating(),
                EncounterCandidateCombatStats.fromCandidate(candidate),
                classification.role());
    }

    public static EncounterCandidateProfile fromDetail(CreatureDetail detail) {
        EncounterCandidate candidate = new EncounterCandidate(
                detail.id(),
                detail.name(),
                detail.creatureType(),
                detail.challengeRating(),
                detail.xp(),
                detail.hitPoints(),
                detail.hitDiceCount(),
                detail.hitDiceSides(),
                detail.hitDiceModifier(),
                detail.armorClass(),
                detail.initiativeBonus(),
                detail.legendaryActionCount());
        return fromCandidate(candidate, detail);
    }

    static EncounterCandidate toCandidate(EncounterCandidateProfile profile) {
        return new EncounterCandidate(
                profile.id,
                profile.name,
                "",
                profile.challengeRating,
                profile.xp(),
                profile.hitPoints(),
                null,
                null,
                null,
                profile.armorClass(),
                profile.initiativeBonus(),
                profile.legendaryActionCount());
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
