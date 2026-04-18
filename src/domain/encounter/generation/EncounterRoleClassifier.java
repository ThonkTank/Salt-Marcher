package src.domain.encounter.generation;

import org.jspecify.annotations.Nullable;
import src.domain.creatures.api.CreatureDetail;
import src.domain.creatures.api.EncounterCandidate;

import java.util.List;

public final class EncounterRoleClassifier {

    private EncounterRoleClassifier() {
    }

    public static Classification classify(EncounterCandidate candidate, @Nullable CreatureDetail detail) {
        if (isBoss(candidate)) {
            return new Classification("Boss", EncounterTagBuilder.tagsFor(candidate, detail, "legendary threat"));
        }
        if (isBrute(candidate)) {
            return new Classification("Brute", EncounterTagBuilder.tagsFor(candidate, detail, "durable body"));
        }
        if (isSkirmisher(candidate, detail)) {
            return new Classification("Skirmisher", EncounterTagBuilder.tagsFor(candidate, detail, "fast opener"));
        }
        if (isElite(candidate)) {
            return new Classification("Elite", EncounterTagBuilder.tagsFor(candidate, detail, "hard to remove"));
        }
        if (isMinion(candidate)) {
            return new Classification("Minion", EncounterTagBuilder.tagsFor(candidate, detail, "light filler"));
        }
        return new Classification("Standard", EncounterTagBuilder.tagsFor(candidate, detail, null));
    }

    private static boolean isBoss(EncounterCandidate candidate) {
        return candidate.legendaryActionCount() > 0 || candidate.xp() >= 10_000;
    }

    private static boolean isBrute(EncounterCandidate candidate) {
        return candidate.hitPoints() >= 120 && candidate.armorClass() <= 16;
    }

    private static boolean isSkirmisher(EncounterCandidate candidate, @Nullable CreatureDetail detail) {
        return candidate.initiativeBonus() >= 5 || hasBonusMovement(detail);
    }

    private static boolean isElite(EncounterCandidate candidate) {
        return candidate.armorClass() >= 18 || candidate.xp() >= 1_800;
    }

    private static boolean isMinion(EncounterCandidate candidate) {
        return candidate.xp() <= 100 && candidate.hitPoints() <= 30;
    }

    private static boolean hasBonusMovement(@Nullable CreatureDetail detail) {
        if (detail == null) {
            return false;
        }
        return detail.flySpeed() > 0
                || detail.climbSpeed() > 0
                || detail.swimSpeed() > 0
                || detail.burrowSpeed() > 0;
    }

    public record Classification(
            String role,
            List<String> tags
    ) {
    }
}
