package src.domain.encounter.usecase;

import org.jspecify.annotations.Nullable;
import src.domain.creatures.api.CreatureDetail;
import src.domain.creatures.api.EncounterCandidate;

record EncounterCandidateProfile(
        long id,
        String name,
        String challengeRating,
        int xp,
        int hitPoints,
        int armorClass,
        int initiativeBonus,
        int legendaryActionCount,
        String role
) {

    static EncounterCandidateProfile fromCandidate(EncounterCandidate candidate, @Nullable CreatureDetail detail) {
        EncounterRoleClassifier.Classification classification = EncounterRoleClassifier.classify(candidate, detail);
        return new EncounterCandidateProfile(
                candidate.id(),
                candidate.name(),
                candidate.challengeRating(),
                candidate.xp(),
                candidate.hitPoints(),
                candidate.armorClass(),
                candidate.initiativeBonus(),
                candidate.legendaryActionCount(),
                classification.role());
    }

    static EncounterCandidateProfile fromDetail(CreatureDetail detail) {
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

    EncounterCandidate toCandidate() {
        return new EncounterCandidate(
                id,
                name,
                "",
                challengeRating,
                xp,
                hitPoints,
                null,
                null,
                null,
                armorClass,
                initiativeBonus,
                legendaryActionCount);
    }

    int componentDistance(int targetXp) {
        int half = Math.max(1, targetXp / 2);
        int third = Math.max(1, targetXp / 3);
        return Math.min(
                Math.abs(xp - targetXp),
                Math.min(Math.abs(xp - half), Math.abs(xp - third)));
    }
}
