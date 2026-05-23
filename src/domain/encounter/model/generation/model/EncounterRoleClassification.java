package src.domain.encounter.model.generation.model;

import java.util.ArrayList;
import java.util.List;
import org.jspecify.annotations.Nullable;

public record EncounterRoleClassification(
        EncounterRole role,
        List<String> tags
) {

    private static final int KEEN_SENSES_PASSIVE_PERCEPTION = 15;

    public EncounterRoleClassification {
        role = role == null ? EncounterRole.standardRole() : role;
        tags = tags == null ? List.of() : List.copyOf(tags);
    }

    public EncounterRoleClassification(EncounterRole role) {
        this(role, List.of());
    }

    @Override
    public List<String> tags() {
        return List.copyOf(tags);
    }

    public static EncounterRoleClassification classify(EncounterCreatureFacts candidate) {
        if (isBoss(candidate)) {
            return classification(candidate, EncounterRole.bossRole());
        }
        if (isBrute(candidate)) {
            return classification(candidate, EncounterRole.BRUTE);
        }
        if (isSkirmisher(candidate)) {
            return classification(candidate, EncounterRole.SKIRMISHER);
        }
        if (isElite(candidate)) {
            return classification(candidate, EncounterRole.ELITE);
        }
        if (isMinion(candidate)) {
            return classification(candidate, EncounterRole.MINION);
        }
        return classification(candidate, EncounterRole.standardRole());
    }

    public static List<String> tagsFor(EncounterCreatureFacts candidate, @Nullable String defaultTag) {
        List<String> tags = new ArrayList<>();
        addDefaultTag(tags, defaultTag);
        addCandidateTags(tags, candidate);
        addDetailTags(tags, candidate);
        return tags.stream().distinct().limit(3).toList();
    }

    private static EncounterRoleClassification classification(EncounterCreatureFacts candidate, EncounterRole role) {
        return new EncounterRoleClassification(role, tagsFor(candidate, defaultTag(role)));
    }

    private static @Nullable String defaultTag(EncounterRole role) {
        return switch (role) {
            case BOSS -> "legendary threat";
            case BRUTE -> "durable body";
            case SKIRMISHER -> "fast opener";
            case ELITE -> "hard to remove";
            case MINION -> "light filler";
            case STANDARD -> null;
        };
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

    private static void addDefaultTag(List<String> tags, @Nullable String defaultTag) {
        if (defaultTag != null && !defaultTag.isBlank()) {
            tags.add(defaultTag);
        }
    }

    private static void addCandidateTags(List<String> tags, EncounterCreatureFacts candidate) {
        if (candidate.legendaryActionCount() > 0) {
            tags.add("legendary actions");
        }
    }

    private static void addDetailTags(List<String> tags, EncounterCreatureFacts detail) {
        if (detail.flySpeed() > 0) {
            tags.add("flyer");
        }
        if (detail.swimSpeed() > 0 || detail.climbSpeed() > 0 || detail.burrowSpeed() > 0) {
            tags.add("mobility");
        }
        if (hasResilience(detail)) {
            tags.add("resilient");
        }
        if (hasActionTricks(detail.actions())) {
            tags.add("action tricks");
        }
        if (detail.passivePerception() >= KEEN_SENSES_PASSIVE_PERCEPTION) {
            tags.add("keen senses");
        }
    }

    private static boolean hasResilience(EncounterCreatureFacts detail) {
        return hasText(detail.damageResistances())
                || hasText(detail.damageImmunities())
                || hasText(detail.conditionImmunities());
    }

    private static boolean hasActionTricks(List<EncounterCreatureFacts.ActionFacts> actions) {
        if (actions == null) {
            return false;
        }
        for (EncounterCreatureFacts.ActionFacts action : actions) {
            String type = action.actionType();
            if ("bonus_action".equals(type) || "reaction".equals(type) || "legendary_action".equals(type)) {
                return true;
            }
        }
        return false;
    }

    private static boolean hasText(@Nullable String value) {
        return value != null && !value.isBlank();
    }
}
