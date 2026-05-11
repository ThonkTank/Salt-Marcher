package src.domain.encounter.model.generation.helper;

import java.util.List;
import src.domain.encounter.model.generation.model.EncounterCreatureFacts;

public final class EncounterRoleClassificationHelper {

    private EncounterRoleClassificationHelper() {
    }

    public static Classification classify(EncounterCreatureFacts candidate) {
        if (isBoss(candidate)) {
            return new Classification("Boss", EncounterTagBuildHelper.tagsFor(candidate, "legendary threat"));
        }
        if (isBrute(candidate)) {
            return new Classification("Brute", EncounterTagBuildHelper.tagsFor(candidate, "durable body"));
        }
        if (isSkirmisher(candidate)) {
            return new Classification("Skirmisher", EncounterTagBuildHelper.tagsFor(candidate, "fast opener"));
        }
        if (isElite(candidate)) {
            return new Classification("Elite", EncounterTagBuildHelper.tagsFor(candidate, "hard to remove"));
        }
        if (isMinion(candidate)) {
            return new Classification("Minion", EncounterTagBuildHelper.tagsFor(candidate, "light filler"));
        }
        return new Classification("Standard", EncounterTagBuildHelper.tagsFor(candidate, null));
    }

    private static boolean isBoss(EncounterCreatureFacts candidate) {
        return candidate.legendaryActionCount() > 0 || candidate.xp() >= 10_000;
    }

    private static boolean isBrute(EncounterCreatureFacts candidate) {
        return candidate.hitPoints() >= 120 && candidate.armorClass() <= 16;
    }

    private static boolean isSkirmisher(EncounterCreatureFacts candidate) {
        return candidate.initiativeBonus() >= 5 || hasBonusMovement(candidate);
    }

    private static boolean isElite(EncounterCreatureFacts candidate) {
        return candidate.armorClass() >= 18 || candidate.xp() >= 1_800;
    }

    private static boolean isMinion(EncounterCreatureFacts candidate) {
        return candidate.xp() <= 100 && candidate.hitPoints() <= 30;
    }

    private static boolean hasBonusMovement(EncounterCreatureFacts detail) {
        return detail.flySpeed() > 0
                || detail.climbSpeed() > 0
                || detail.swimSpeed() > 0
                || detail.burrowSpeed() > 0;
    }

    public record Classification(
            String role,
            List<String> tags
    ) {

        public Classification {
            tags = tags == null ? List.of() : List.copyOf(tags);
        }

        @Override
        public List<String> tags() {
            return List.copyOf(tags);
        }
    }
}
