package src.domain.encounter.generation.policy;

import src.domain.encounter.generation.value.*;

import org.jspecify.annotations.Nullable;

import java.util.ArrayList;
import java.util.List;

final class EncounterTagBuilder {

    private static final int KEEN_SENSES_PASSIVE_PERCEPTION = 15;

    private EncounterTagBuilder() {
    }

    static List<String> tagsFor(
            EncounterCreatureFacts candidate,
            @Nullable String defaultTag
    ) {
        List<String> tags = new ArrayList<>();
        addDefaultTag(tags, defaultTag);
        addCandidateTags(tags, candidate);
        addDetailTags(tags, candidate);
        return tags.stream().distinct().limit(3).toList();
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
