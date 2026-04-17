package src.domain.encounter.usecase;

import org.jspecify.annotations.Nullable;
import src.domain.creatures.api.CreatureActionDetail;
import src.domain.creatures.api.CreatureDetail;
import src.domain.creatures.api.EncounterCandidate;

import java.util.ArrayList;
import java.util.List;

final class EncounterRoleClassifier {

    private EncounterRoleClassifier() {
    }

    static Classification classify(EncounterCandidate candidate, @Nullable CreatureDetail detail) {
        if (candidate.legendaryActionCount() > 0 || candidate.xp() >= 10_000) {
            return new Classification("Boss", buildTags(candidate, detail, "legendary threat"));
        }
        if (candidate.hitPoints() >= 120 && candidate.armorClass() <= 16) {
            return new Classification("Brute", buildTags(candidate, detail, "durable body"));
        }
        if (candidate.initiativeBonus() >= 5 || hasBonusMovement(detail)) {
            return new Classification("Skirmisher", buildTags(candidate, detail, "fast opener"));
        }
        if (candidate.armorClass() >= 18 || candidate.xp() >= 1_800) {
            return new Classification("Elite", buildTags(candidate, detail, "hard to remove"));
        }
        if (candidate.xp() <= 100 && candidate.hitPoints() <= 30) {
            return new Classification("Minion", buildTags(candidate, detail, "light filler"));
        }
        return new Classification("Standard", buildTags(candidate, detail, null));
    }

    private static List<String> buildTags(
            EncounterCandidate candidate,
            @Nullable CreatureDetail detail,
            @Nullable String defaultTag
    ) {
        List<String> tags = new ArrayList<>();
        if (defaultTag != null && !defaultTag.isBlank()) {
            tags.add(defaultTag);
        }
        if (candidate.legendaryActionCount() > 0) {
            tags.add("legendary actions");
        }
        if (detail != null) {
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
            if (detail.passivePerception() >= 15) {
                tags.add("keen senses");
            }
        }
        return tags.stream().distinct().limit(3).toList();
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

    private static boolean hasResilience(CreatureDetail detail) {
        return hasText(detail.damageResistances())
                || hasText(detail.damageImmunities())
                || hasText(detail.conditionImmunities());
    }

    private static boolean hasActionTricks(List<CreatureActionDetail> actions) {
        if (actions == null) {
            return false;
        }
        for (CreatureActionDetail action : actions) {
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

    record Classification(
            String role,
            List<String> tags
    ) {
    }
}
