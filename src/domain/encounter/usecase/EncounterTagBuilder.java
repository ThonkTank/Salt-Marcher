package src.domain.encounter.usecase;

import org.jspecify.annotations.Nullable;
import src.domain.creatures.api.CreatureActionDetail;
import src.domain.creatures.api.CreatureDetail;
import src.domain.creatures.api.EncounterCandidate;

import java.util.ArrayList;
import java.util.List;

final class EncounterTagBuilder {

    private EncounterTagBuilder() {
    }

    static List<String> tagsFor(
            EncounterCandidate candidate,
            @Nullable CreatureDetail detail,
            @Nullable String defaultTag
    ) {
        List<String> tags = new ArrayList<>();
        addDefaultTag(tags, defaultTag);
        addCandidateTags(tags, candidate);
        addDetailTags(tags, detail);
        return tags.stream().distinct().limit(3).toList();
    }

    private static void addDefaultTag(List<String> tags, @Nullable String defaultTag) {
        if (defaultTag != null && !defaultTag.isBlank()) {
            tags.add(defaultTag);
        }
    }

    private static void addCandidateTags(List<String> tags, EncounterCandidate candidate) {
        if (candidate.legendaryActionCount() > 0) {
            tags.add("legendary actions");
        }
    }

    private static void addDetailTags(List<String> tags, @Nullable CreatureDetail detail) {
        if (detail == null) {
            return;
        }
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
}
