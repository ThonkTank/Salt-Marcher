package src.domain.encounter.application;

import org.jspecify.annotations.Nullable;
import src.domain.creatures.api.CreatureDetail;
import src.domain.creatures.api.CreatureDetailResult;
import src.domain.creatures.api.CreatureLookupStatus;
import src.domain.creatures.CreaturesApplicationService;
import src.domain.encounter.api.EncounterCreature;
import src.domain.encounter.api.GeneratedEncounter;
import src.domain.encounter.generation.EncounterDraft;
import src.domain.encounter.generation.EncounterDraftEntry;
import src.domain.encounter.generation.EncounterRoleClassifier;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

final class EncounterResultAssembler {

    private static final int MINIMUM_BLENDED_ROLE_COUNT = 2;
    private static final int ACTION_ECONOMY_CREATURE_COUNT = 5;
    private static final int BASE_HIGHLIGHT_COUNT = 1;

    private final CreaturesApplicationService creatures;

    EncounterResultAssembler(CreaturesApplicationService creatures) {
        this.creatures = creatures;
    }

    List<GeneratedEncounter> assemble(List<EncounterDraft> drafts, int alternativeCount) {
        Map<Long, CreatureDetail> detailCache = new LinkedHashMap<>();
        List<GeneratedEncounter> encounters = new ArrayList<>();
        for (EncounterDraft draft : drafts.stream().limit(alternativeCount).toList()) {
            List<EncounterCreature> creatures = new ArrayList<>();
            for (EncounterDraftEntry entry : draft.entries()) {
                CreatureDetail detail = detailCache.computeIfAbsent(entry.profile().id(), this::loadCreatureDetailOrNull);
                EncounterRoleClassifier.Classification classification = EncounterRoleClassifier.classify(entry.profile().toCandidate(), detail);
                creatures.add(new EncounterCreature(
                        entry.profile().id(),
                        entry.profile().name(),
                        entry.profile().challengeRating(),
                        entry.profile().xp(),
                        entry.quantity(),
                        classification.role(),
                        classification.tags()));
            }
            encounters.add(new GeneratedEncounter(
                    draft.title(),
                    draft.achievedDifficulty(),
                    draft.creatureCount(),
                    draft.totalBaseXp(),
                    draft.adjustedXp(),
                    draft.multiplier(),
                    highlightsFor(draft, creatures),
                    creatures));
        }
        return encounters;
    }

    private @Nullable CreatureDetail loadCreatureDetailOrNull(long creatureId) {
        CreatureDetailResult result = creatures.loadCreatureDetail(creatureId);
        if (result.status() != CreatureLookupStatus.SUCCESS) {
            return null;
        }
        return result.detail();
    }

    private static List<String> highlightsFor(EncounterDraft draft, List<EncounterCreature> creatures) {
        List<String> highlights = new ArrayList<>();
        highlights.add("Adjusted XP " + draft.adjustedXp() + " vs target " + draft.targetAdjustedXp());
        if (creatures.stream().anyMatch(creature -> "Boss".equals(creature.role()))) {
            highlights.add("Includes a boss-style anchor.");
        }
        long distinctRoles = creatures.stream().map(EncounterCreature::role).distinct().count();
        if (distinctRoles >= MINIMUM_BLENDED_ROLE_COUNT) {
            highlights.add("Blends " + distinctRoles + " combat roles.");
        }
        if (draft.creatureCount() >= ACTION_ECONOMY_CREATURE_COUNT) {
            highlights.add("Leans on action economy through numbers.");
        }
        if (highlights.size() == BASE_HIGHLIGHT_COUNT) {
            highlights.add("Compact composition that stays close to the requested band.");
        }
        return highlights;
    }
}
