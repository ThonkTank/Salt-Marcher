package src.domain.encounter.model.generation.model;

public record EncounterRoleClassification(
        EncounterRole role
) {

    public EncounterRoleClassification {
        role = role == null ? EncounterRole.STANDARD : role;
    }

    public static EncounterRoleClassification classify(EncounterCreatureFacts candidate) {
        if (isBoss(candidate)) {
            return new EncounterRoleClassification(EncounterRole.BOSS);
        }
        if (isBrute(candidate)) {
            return new EncounterRoleClassification(EncounterRole.BRUTE);
        }
        if (isSkirmisher(candidate)) {
            return new EncounterRoleClassification(EncounterRole.SKIRMISHER);
        }
        if (isElite(candidate)) {
            return new EncounterRoleClassification(EncounterRole.ELITE);
        }
        if (isMinion(candidate)) {
            return new EncounterRoleClassification(EncounterRole.MINION);
        }
        return new EncounterRoleClassification(EncounterRole.STANDARD);
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
}
